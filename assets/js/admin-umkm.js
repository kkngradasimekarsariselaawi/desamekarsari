/**
 * KELOLA UMKM (panel admin)
 * Tambah, ubah, aktif/nonaktifkan, dan hapus UMKM. Data tersimpan di Firestore (koleksi "umkm")
 * lewat UmkmStore dan langsung tampil realtime di halaman publik umkm.html.
 *
 * Harus dimuat setelah umkm-store.js dan admin-dashboard.js.
 */
(function () {
  'use strict';

  const Store = window.UmkmStore || null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  let items = [];
  let state = 'loading'; // loading | ready | error
  let errorText = '';
  let unsub = null;
  let editingId = null;
  let saving = false;
  let lastFocus = null;

  /* ---------- Toast (memakai #toastContainer milik dashboard) ---------- */
  function toast(message, type) {
    const box = $('toastContainer');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-success');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  function errMsg(err, fallback) {
    const code = err && err.code;
    if (code === 'permission-denied') return 'Ditolak server. Pastikan sudah login admin dan aturan Firestore untuk koleksi "umkm" sudah dipasang.';
    if (code === 'unavailable') return 'Koneksi ke server bermasalah. Periksa internet Anda.';
    return fallback;
  }

  /* ---------- Tabel ---------- */
  const badge = (status) => `<span class="badge ${status === 'Nonaktif' ? 'badge-perlu-perbaikan' : 'badge-selesai'}">${esc(status || 'Aktif')}</span>`;

  function rowHtml(u) {
    const aktif = u.status !== 'Nonaktif';
    const thumb = Store.photoUrl(u.foto) || Store.placeholder(u.nama);
    const id = esc(u.id);
    return `
      <tr>
        <td><div class="um-name"><img class="um-thumb" src="${esc(thumb)}" alt="" loading="lazy" data-name="${esc(u.nama)}"><strong>${esc(u.nama)}</strong></div></td>
        <td>${esc(u.kategori)}</td>
        <td>${esc(u.pemilik)}</td>
        <td>${esc(u.telepon)}</td>
        <td>${badge(u.status)}</td>
        <td>
          <div class="um-actions">
            <button type="button" class="um-btn" data-act="edit" data-id="${id}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button type="button" class="um-btn" data-act="toggle" data-id="${id}">${aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button type="button" class="um-btn um-btn-danger" data-act="delete" data-id="${id}"><i class="fa-solid fa-trash"></i> Hapus</button>
          </div>
        </td>
      </tr>`;
  }

  function render() {
    const body = $('umkmBody');
    if (!body) return;
    const q = ($('searchUmkm').value || '').trim().toLowerCase();
    const rows = items.filter((u) => !q || [u.nama, u.pemilik, u.kategori, u.alamat, u.ringkasan]
      .some((v) => String(v || '').toLowerCase().includes(q)));

    let msg = '';
    if (state === 'loading') msg = 'Memuat data dari server...';
    else if (state === 'error') msg = errorText;
    else if (!rows.length) msg = items.length ? 'Tidak ada Pengrajin yang cocok dengan pencarian.' : 'Belum ada Pengrajin. Klik "Tambah Pengrajin" untuk mulai.';

    body.innerHTML = state === 'ready' && rows.length
      ? rows.map(rowHtml).join('')
      : `<tr><td colspan="6"><div class="state-container"><i class="fa-solid ${state === 'error' ? 'fa-triangle-exclamation' : 'fa-folder-open'}"></i><p>${esc(msg)}</p></div></td></tr>`;

    $('umkmCount').textContent = state === 'ready' ? `Menampilkan ${rows.length} dari ${items.length} Pengrajin` : '';
    $('umkmImportBox').hidden = state !== 'ready';
  }

  /* ---------- Data realtime ---------- */
  function stop() {
    if (typeof unsub === 'function') { try { unsub(); } catch (e) { /* abaikan */ } }
    unsub = null;
  }
  function start() {
    stop();
    state = 'loading';
    render();
    unsub = Store.subscribe({ onlyActive: false },
      (list) => { items = list; state = 'ready'; render(); },
      (err) => { state = 'error'; errorText = errMsg(err, 'Gagal memuat data Pengrajin dari server.'); render(); }
    );
  }
  // Mode Firestore: tunggu login Firebase Auth dulu (aturan Firestore hanya mengizinkan admin membaca semua data)
  function connect() {
    if (Store.getMode() !== 'firestore') { start(); return; }
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          start();
        } else {
          stop();
          items = [];
          state = 'error';
          errorText = 'Belum login ke Firebase, data Pengrajin belum bisa dimuat. Silakan login ulang.';
          render();
        }
      });
    } catch (e) {
      console.error('[Admin UMKM] Firebase Auth tidak tersedia:', e);
      start();
    }
  }

  /* ---------- Aksi baris ---------- */
  function toggleStatus(item, btn) {
    const next = item.status === 'Nonaktif' ? 'Aktif' : 'Nonaktif';
    btn.disabled = true;
    Store.setStatus(item.id, next)
      .then(() => toast(next === 'Aktif'
        ? `"${item.nama}" diaktifkan dan tampil di halaman publik.`
        : `"${item.nama}" dinonaktifkan dan disembunyikan dari halaman publik.`))
      .catch((err) => { console.error(err); toast(errMsg(err, 'Status gagal diubah. Coba lagi.'), 'error'); })
      .then(() => { btn.disabled = false; });
  }
  function removeItem(item, btn) {
    if (!confirm(`Hapus "${item.nama}" secara permanen?\nData tidak bisa dikembalikan. Untuk menyembunyikan sementara, pilih Nonaktifkan.`)) return;
    btn.disabled = true;
    Store.remove(item.id)
      .then(() => toast(`"${item.nama}" dihapus.`))
      .catch((err) => { console.error(err); toast(errMsg(err, 'Data gagal dihapus. Coba lagi.'), 'error'); btn.disabled = false; });
  }

  /* ---------- Form tambah / ubah ---------- */
  function showError(msg, fieldName) {
    const box = $('umkmFormError');
    box.textContent = msg;
    box.hidden = false;
    const el = fieldName && $('umkmForm').elements[fieldName];
    if (el) el.focus();
  }

  function updatePreview() {
    const box = $('umkmPhotoPreview');
    const url = Store.photoUrl($('umkmForm').elements.foto.value);
    box.innerHTML = '';
    if (!url) return;
    const img = new Image();
    img.alt = 'Pratinjau foto';
    img.onload = () => { box.innerHTML = ''; box.appendChild(img); };
    img.onerror = () => { box.textContent = 'Foto tidak bisa dimuat. Pastikan link bisa dibuka siapa saja (di Drive: "Siapa saja yang memiliki link").'; };
    img.src = url;
  }

  function openForm(item) {
    editingId = item ? item.id : null;
    const f = $('umkmForm');
    f.reset();
    const v = item || { status: 'Aktif' };
    ['nama', 'kategori', 'pemilik', 'telepon', 'alamat', 'hargaRentang', 'ringkasan', 'deskripsi', 'foto', 'status']
      .forEach((k) => { if (v[k] != null && f.elements[k]) f.elements[k].value = v[k]; });
    $('umkmFormTitle').textContent = item ? 'Edit UMKM' : 'Tambah UMKM';
    $('umkmSaveBtn').textContent = item ? 'Simpan perubahan' : 'Simpan UMKM';
    $('umkmFormError').hidden = true;
    updatePreview();
    lastFocus = document.activeElement;
    const overlay = $('umkmFormOverlay');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    f.elements.nama.focus();
  }
  function closeForm() {
    const overlay = $('umkmFormOverlay');
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    editingId = null;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function validate(d) {
    if (!d.nama) return ['Nama usaha wajib diisi.', 'nama'];
    if (Store.CATEGORIES.indexOf(d.kategori) < 0) return ['Pilih kategori usaha.', 'kategori'];
    if (!d.pemilik) return ['Nama pemilik wajib diisi.', 'pemilik'];
    if (!Store.isValidWa(d.telepon)) return ['Nomor WhatsApp tidak valid. Contoh: 081234567890.', 'telepon'];
    if (!d.alamat) return ['Alamat wajib diisi.', 'alamat'];
    if (!d.ringkasan) return ['Ringkasan produk wajib diisi.', 'ringkasan'];
    if (d.foto && !Store.photoUrl(d.foto)) return ['Link foto harus diawali http:// atau https://.', 'foto'];
    return null;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (saving) return;
    const f = e.target.elements;
    const data = {
      nama: f.nama.value.trim(), kategori: f.kategori.value, pemilik: f.pemilik.value.trim(),
      telepon: f.telepon.value.trim(), alamat: f.alamat.value.trim(), hargaRentang: f.hargaRentang.value.trim(),
      ringkasan: f.ringkasan.value.trim(), deskripsi: f.deskripsi.value.trim(), foto: f.foto.value.trim(),
      status: f.status.value
    };
    const problem = validate(data);
    if (problem) { showError(problem[0], problem[1]); return; }

    const wasEdit = !!editingId;
    const btn = $('umkmSaveBtn');
    saving = true;
    btn.disabled = true;
    Store.save(editingId, data)
      .then(() => {
        toast(wasEdit
          ? 'Data Pengrajin diperbarui.'
          : (data.status === 'Aktif' ? 'UMKM ditambahkan dan langsung tampil di halaman publik.' : 'UMKM ditambahkan sebagai Nonaktif (belum tampil di halaman publik).'));
        closeForm();
      })
      .catch((err) => { console.error('[Admin UMKM] simpan gagal:', err); showError(errMsg(err, 'Data gagal disimpan. Coba lagi.')); })
      .then(() => { saving = false; btn.disabled = false; });
  }
  /* ---------- IMPOR MASSAL EXCEL ---------- */

function downloadExcelTemplate() {
  if (!window.XLSX) {
    toast('Library Excel belum termuat. Muat ulang halaman.', 'error');
    return;
  }

  const headers = [
    'Nama Usaha',
    'Kategori',
    'Nama Pemilik',
    'Nomor WhatsApp',
    'Alamat',
    'Kisaran Harga',
    'Ringkasan Produk',
    'Deskripsi',
    'Link Foto',
    'Status'
  ];

  const contoh = [
    'Contoh Anyaman Bambu',
    Store.CATEGORIES[0] || '',
    'Nama Pengrajin',
    '081234567890',
    'Kp. Mekarsari, RT 01/RW 01',
    'Rp 25.000 - Rp 150.000',
    'Produk anyaman bambu berkualitas.',
    '',
    '',
    'Aktif'
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, contoh]);

  // Pertahankan angka nol di awal nomor WhatsApp pada baris contoh.
  sheet['D2'] = { t: 's', v: '081234567890' };

  sheet['!cols'] = [
    { wch: 28 }, { wch: 22 }, { wch: 25 }, { wch: 20 },
    { wch: 32 }, { wch: 25 }, { wch: 42 }, { wch: 48 },
    { wch: 48 }, { wch: 14 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data Pengrajin');

  const petunjuk = [
    ['PETUNJUK PENGISIAN'],
    ['Satu pengrajin untuk setiap baris.'],
    ['Jangan mengubah nama kolom pada baris pertama.'],
    ['Kolom wajib: Nama Usaha, Kategori, Nama Pemilik, Nomor WhatsApp, Alamat, Ringkasan Produk.'],
    ['Kategori harus sama persis dengan pilihan kategori di website.'],
    ['Status hanya Aktif atau Nonaktif. Jika kosong, default Aktif.'],
    ['Format kolom WhatsApp sebagai Text/Teks agar angka nol di depan tidak hilang.'],
    ['Link Foto boleh dikosongkan, atau isi dengan URL yang dapat diakses publik.'],
    ['Hapus baris contoh sebelum mengisi data sebenarnya.']
  ];

  const sheetPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
  sheetPetunjuk['!cols'] = [{ wch: 110 }];

  XLSX.utils.book_append_sheet(
    workbook,
    sheetPetunjuk,
    'Petunjuk'
  );

  XLSX.writeFile(
    workbook,
    'template-impor-pengrajin-mekarsari.xlsx'
  );
}

function normalizeExcelHeader(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function excelRowToUmkm(row) {
  const aliases = {
    nama: ['namausaha', 'nama', 'usahapengrajin'],
    kategori: ['kategori', 'jenisusaha'],
    pemilik: ['namapemilik', 'pemilik'],
    telepon: [
      'nomorwhatsapp', 'whatsapp', 'telepon',
      'nohp', 'nomorhp', 'notelp'
    ],
    alamat: ['alamat', 'alamatusaha'],
    hargaRentang: ['kisaranharga', 'hargarentang', 'harga'],
    ringkasan: ['ringkasanproduk', 'ringkasan'],
    deskripsi: ['deskripsi', 'deskripsilengkap'],
    foto: ['linkfoto', 'foto', 'urlfoto'],
    status: ['status']
  };

  const mapped = {};

  Object.keys(row).forEach((header) => {
    const normalized = normalizeExcelHeader(header);

    const target = Object.keys(aliases).find((key) =>
      aliases[key].includes(normalized)
    );

    if (target) mapped[target] = row[header];
  });

  const val = (key) =>
    String(mapped[key] == null ? '' : mapped[key]).trim();

  const statusInput = val('status').toLowerCase();

  return {
    nama: val('nama'),
    kategori: val('kategori'),
    pemilik: val('pemilik'),
    telepon: val('telepon')
      .replace(/\.0$/, '')
      .replace(/[\s()-]/g, ''),
    alamat: val('alamat'),
    hargaRentang: val('hargaRentang'),
    ringkasan: val('ringkasan'),
    deskripsi: val('deskripsi'),
    foto: val('foto'),
    status: !statusInput
      ? 'Aktif'
      : statusInput === 'aktif'
        ? 'Aktif'
        : statusInput === 'nonaktif'
          ? 'Nonaktif'
          : val('status')
  };
}

async function importExcelUmkm() {
  const input = $('umkmExcelInput');
  const btn = $('umkmImportRunBtn');
  const file = input.files && input.files[0];

  if (!file) {
    toast('Pilih file Excel terlebih dahulu.', 'error');
    return;
  }

  if (!window.XLSX) {
    toast('Library Excel belum termuat. Periksa koneksi internet.', 'error');
    return;
  }

  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    toast('Gunakan file XLSX, XLS, atau CSV.', 'error');
    return;
  }

  if (
    Store.getMode() === 'firestore' &&
    !(window.firebase && firebase.auth &&
      firebase.auth().currentUser)
  ) {
    toast('Silakan login sebagai petugas terlebih dahulu.', 'error');
    return;
  }

  btn.disabled = true;
  input.disabled = true;

  const originalText = btn.innerHTML;
  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error('Sheet Excel tidak ditemukan.');
    }

    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: '', raw: false }
    );

    if (!rows.length) {
      throw new Error('File tidak berisi data.');
    }

    const existingNames = new Set(
      items.map((item) =>
        String(item.nama || '').trim().toLocaleLowerCase('id-ID')
      )
    );

    const namesInFile = new Set();
    const validRows = [];
    const issues = [];

    rows.forEach((row, index) => {
      const data = excelRowToUmkm(row);

      // Abaikan baris yang benar-benar kosong.
      if (
        !data.nama && !data.pemilik &&
        !data.telepon && !data.alamat
      ) return;

      const rowNumber = index + 2;
      const problem = validate(data);

      if (problem) {
        issues.push(`Baris ${rowNumber}: ${problem[0]}`);
        return;
      }

      const nameKey = data.nama.toLocaleLowerCase('id-ID');

      if (existingNames.has(nameKey) || namesInFile.has(nameKey)) {
        issues.push(
          `Baris ${rowNumber}: "${data.nama}" duplikat, dilewati.`
        );
        return;
      }

      namesInFile.add(nameKey);
      validRows.push({ data, rowNumber });
    });

    if (!validRows.length) {
      alert(
        'Tidak ada data valid untuk diimpor.' +
        (issues.length ? '\n\n' + issues.slice(0, 10).join('\n') : '')
      );
      return;
    }

    const lanjut = confirm(
      `Ada ${validRows.length} data yang siap diimpor.` +
      `\n${issues.length} baris akan dilewati jika tidak valid atau duplikat.` +
      '\n\nLanjutkan menyimpan data ke database?'
    );

    if (!lanjut) return;

    let berhasil = 0;
    const gagal = [];

    // Simpan menggunakan fungsi yang sama dengan formulir UMKM.
    for (const entry of validRows) {
      try {
        await Store.save(null, entry.data);
        berhasil++;
      } catch (error) {
        console.error(
          '[Impor Pengrajin] Gagal pada baris ' + entry.rowNumber,
          error
        );

        gagal.push(
          `Baris ${entry.rowNumber}: ${entry.data.nama}`
        );
      }
    }

    const ringkasan =
      `Impor selesai. Berhasil: ${berhasil}, ` +
      `dilewati: ${issues.length}, gagal simpan: ${gagal.length}.`;

    toast(ringkasan, gagal.length ? 'error' : 'success');

    if (issues.length || gagal.length) {
      alert(
        ringkasan + '\n\n' +
        [...issues, ...gagal].slice(0, 20).join('\n')
      );
    }
  } catch (error) {
    console.error('[Impor UMKM]', error);
    toast(
      error.message || 'File Excel gagal diproses.',
      'error'
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    input.disabled = false;
    input.value = '';
  }
}
  /* ---------- Inisialisasi ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (!$('umkmBody')) return;

    if (!Store) {
      state = 'error';
      errorText = 'umkm-store.js belum dimuat. Periksa urutan script di index.html.';
      render();
      return;
    }

    // Opsi kategori diambil dari satu sumber (UmkmStore) agar sama dengan filter di halaman publik
    $('umkmKategori').innerHTML = '<option value="">Pilih kategori</option>' +
      Store.CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

    $('umkmModeNotice').innerHTML = Store.getMode() === 'firestore'
      ? '<i class="fa-solid fa-circle-info"></i> Data tersimpan di Database. Pengrajin berstatus <strong>Aktif</strong> langsung tampil di halaman publik Pengrajin, yang <strong>Nonaktif</strong> disembunyikan.'
      : '<i class="fa-solid fa-circle-info"></i> Mode uji coba: Firebase belum aktif, data hanya tersimpan di browser ini dan belum tampil bagi pengunjung lain.';

    $('searchUmkm').addEventListener('input', render);
    $('umkmAddBtn').addEventListener('click', () => openForm(null));
    $('umkmFormClose').addEventListener('click', closeForm);
    $('umkmCancelBtn').addEventListener('click', closeForm);
    $('umkmFormOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeForm(); });
    $('umkmForm').addEventListener('submit', onSubmit);
    $('umkmForm').elements.foto.addEventListener('input', updatePreview);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('umkmFormOverlay').classList.contains('active')) closeForm();
    });

    const body = $('umkmBody');
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const item = items.find((u) => u.id === btn.dataset.id);
      if (!item) return;
      if (btn.dataset.act === 'edit') openForm(item);
      else if (btn.dataset.act === 'toggle') toggleStatus(item, btn);
      else if (btn.dataset.act === 'delete') removeItem(item, btn);
    });
    // Foto gagal dimuat -> ganti gambar pengganti (event error tidak bubble, jadi pakai capture)
    body.addEventListener('error', (e) => {
      const img = e.target;
      if (img && img.matches && img.matches('img.um-thumb') && img.src.indexOf('data:') !== 0) {
        img.src = Store.placeholder(img.dataset.name);
      }
    }, true);

    // Unduh template Excel
$('umkmTemplateBtn').addEventListener('click', downloadExcelTemplate);

// Informasi file yang dipilih
$('umkmExcelInput').addEventListener('change', () => {
  const file = $('umkmExcelInput').files[0];

  if (file) {
    toast(`File "${file.name}" dipilih. Klik Impor Data untuk melanjutkan.`);
  }
});

// Jalankan impor massal
$('umkmImportRunBtn').addEventListener('click', importExcelUmkm);
    render();
    connect();
  });
})();
