/**
 * MODUL DASHBOARD ADMIN DESA MEKARSARI
 * Statistik, tabel pengajuan surat & pengaduan, filter, drawer mobile,
 * modal detail + update status, ekspor CSV.
 *
 * Data pengajuan surat & pengaduan dibaca realtime dari Firestore lewat
 * SubmissionStore (submission-store.js). Jika Firebase belum aktif,
 * SubmissionStore otomatis memakai localStorage (mode uji coba).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SUBMISSION_STATUSES = [
    ['Diajukan', 'Diajukan'],
    ['Diperiksa', 'Sedang Diperiksa'],
    ['Perlu Perbaikan', 'Perlu Perbaikan'],
    ['Disetujui', 'Disetujui'],
    ['Selesai', 'Selesai']
  ];
  const COMPLAINT_STATUSES = ['Baru', 'Diproses', 'Selesai'];
  const VIEWS = {
    dashboard: ['Dashboard', 'Ringkasan pengajuan surat desa'],
    pengajuan: ['Pengajuan Surat', 'Kelola dan perbarui status pengajuan surat'],
    pengaduan: ['Pengaduan', 'Tanggapi pengaduan warga'],
    berita: ['Berita & Kegiatan', 'Daftar berita dan kegiatan desa'],
    umkm: ['Pengrajin', 'Kelola Pengrajin yang tampil di halaman publik'],
    pengguna: ['Pengguna', 'Akun yang memakai panel admin'],
    pengaturan: ['Pengaturan', 'Pengaturan panel admin']
  };

  /* ---------- Utilitas ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad = (n) => String(n).padStart(2, '0');

  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function formatDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y) return '-';
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Terbaru dulu: pakai ts (ms) bila ada, lalu tanggal, lalu id
  const byDateDesc = (a, b) => ((b.ts || 0) - (a.ts || 0)) || String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id));
  const showDate = (item) => (item.date ? formatDate(item.date) : (item.dateLabel || '-'));

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

  /* ---------- Data contoh (berita; belum dari database). UMKM dikelola di admin-umkm.js ---------- */
  const NEWS = [
    { title: 'Contoh judul berita 1', category: 'Kegiatan Desa', date: isoDaysAgo(3), status: 'Terbit' },
    { title: 'Contoh judul berita 2', category: 'Pengumuman', date: isoDaysAgo(6), status: 'Terbit' },
    { title: 'Contoh judul berita 3', category: 'Kegiatan Desa', date: isoDaysAgo(9), status: 'Draft' }
  ];

  let submissions = [];
  let complaints = [];
  let session = null;
  let tables = [];

  /* ---------- Data dari Firestore (SubmissionStore) ---------- */
  const Store = window.SubmissionStore || null;
  const dataState = { surat: 'loading', pengaduan: 'loading', error: '' };
  const rawById = { surat: {}, pengaduan: {} };
  let unsubs = [];
  let errorToasted = false;

  const toMs = (d) => {
    const ms = Number(d.createdAtMs) || (d.createdAt ? Date.parse(d.createdAt) : NaN);
    return isFinite(ms) && ms > 0 ? ms : null;
  };
  const localDate = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  function maskNik(nik) {
    const n = String(nik == null ? '' : nik).replace(/\D/g, '');
    if (n.length >= 10) return n.slice(0, 6) + '*'.repeat(n.length - 10) + n.slice(-4);
    return n ? '******' : '-';
  }
  function humanize(key) {
    return String(key).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase());
  }
  function stateText(key, fallback) {
    if (dataState[key] === 'loading') return 'Memuat data dari server...';
    if (dataState[key] === 'error') return dataState.error || 'Gagal memuat data.';
    return fallback;
  }

  function mapSurat(d, i, total) {
    const ms = toMs(d);
    return {
      id: d.id, applicant: d.nama || '-', nik: maskNik(d.nik), type: d.jenisSurat || '-',
      date: ms ? localDate(ms) : '', dateLabel: ms ? '' : (d.tanggal || ''), ts: ms || (total - i),
      status: d.status || 'Diajukan', detail: d.keperluan || '', note: d.note || '', raw: d
    };
  }
  function mapPengaduan(d, i, total) {
    const ms = toMs(d);
    return {
      id: d.id, reporter: d.nama || 'Anonim', category: d.kategoriPengaduan || '-',
      date: ms ? localDate(ms) : '', dateLabel: ms ? '' : (d.tanggal || ''), ts: ms || (total - i),
      status: d.status || 'Baru', detail: d.deskripsi || '', response: d.response || '',
      lokasi: d.lokasi || '', kontak: d.kontak || '', raw: d
    };
  }
  function emitData(type) {
    try { document.dispatchEvent(new CustomEvent('admin:data', { detail: { type } })); } catch (e) { /* abaikan */ }
  }
  function applySurat(list) {
    rawById.surat = {};
    list.forEach((d) => { rawById.surat[d.id] = d; });
    submissions = list.map((d, i) => mapSurat(d, i, list.length));
    dataState.surat = 'ready';
    renderAll();
    emitData('surat');
  }
  function applyPengaduan(list) {
    rawById.pengaduan = {};
    list.forEach((d) => { rawById.pengaduan[d.id] = d; });
    complaints = list.map((d, i) => mapPengaduan(d, i, list.length));
    dataState.pengaduan = 'ready';
    renderAll();
    emitData('pengaduan');
  }

  function loadErrorMessage(err) {
    const code = (err && err.code) || '';
    if (code === 'permission-denied') return 'Akses ditolak server. Pastikan sudah login admin dan aturan Firestore mengizinkan admin membaca data.';
    if (code === 'failed-precondition') return 'Firestore meminta indeks. Buka console browser dan ikuti tautan pembuatan indeks.';
    if (code === 'unavailable') return 'Koneksi ke server bermasalah. Periksa internet Anda.';
    return 'Gagal memuat data dari server.';
  }
  function onLoadError(key) {
    return (err) => {
      dataState[key] = 'error';
      dataState.error = loadErrorMessage(err);
      renderAll();
      if (!errorToasted) { errorToasted = true; toast(dataState.error, 'error'); }
    };
  }
  function stopRealtime() {
    unsubs.forEach((u) => { try { u(); } catch (e) { /* abaikan */ } });
    unsubs = [];
  }
  function startRealtime() {
    stopRealtime();
    errorToasted = false;
    dataState.surat = 'loading';
    dataState.pengaduan = 'loading';
    dataState.error = '';
    renderAll();
    unsubs.push(Store.subscribe('surat', applySurat, onLoadError('surat')));
    unsubs.push(Store.subscribe('pengaduan', applyPengaduan, onLoadError('pengaduan')));
  }
  // Mode firestore: tunggu status login Firebase Auth dulu (rules hanya mengizinkan admin membaca)
 
function connectData() {
  if (!Store) {
    dataState.surat = dataState.pengaduan = 'error';
    dataState.error =
      'submission-store.js belum dimuat. Periksa urutan script.';
    renderAll();
    return;
  }

  if (Store.getMode() !== 'firestore') {
    stopRealtime();
    dataState.surat = dataState.pengaduan = 'error';
    dataState.error =
      'Firebase Firestore tidak aktif. Akses panel admin diblokir.';
    renderAll();
    return;
  }

  if (
    typeof firebase === 'undefined' ||
    typeof firebase.auth !== 'function'
  ) {
    stopRealtime();
    dataState.surat = dataState.pengaduan = 'error';
    dataState.error =
      'Firebase Authentication tidak tersedia.';
    renderAll();
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    const auth = window.adminAuth;
    const session =
      auth && typeof auth.getSession === 'function'
        ? auth.getSession()
        : null;

    let validAdmin = false;

    if (
      user &&
      session &&
      session.uid === user.uid &&
      auth &&
      typeof auth.verifyAdmin === 'function'
    ) {
      validAdmin = await auth.verifyAdmin(user);
    }

    if (validAdmin) {
      startRealtime();
    } else {
      stopRealtime();
      dataState.surat = dataState.pengaduan = 'error';
      dataState.error =
        'Sesi admin tidak valid. Silakan login ulang.';
      renderAll();
    }
  });
}


function clearAdminData() {
  submissions = [];
  complaints = [];

  rawById.surat = {};
  rawById.pengaduan = {};

  renderAll();
}

  // Mode uji coba (localStorage) tidak realtime, jadi muat ulang manual setelah simpan
  function reloadLocal() {
    return Promise.all([Store.getAll('surat'), Store.getAll('pengaduan')])
      .then((r) => { applySurat(r[0]); applyPengaduan(r[1]); });
  }
  function persist(type, id, patch, btn, okMessage) {
    if (!Store) { toast('SubmissionStore belum dimuat.', 'error'); return; }
    if (btn) btn.disabled = true;
    Store.updateStatus(type, id, patch)
      .then(() => (Store.getMode() === 'local' ? reloadLocal() : null))
      .then(() => { closeModal(); toast(okMessage); })
      .catch((err) => {
        console.error('[Admin] simpan gagal:', err);
        toast(err && err.code === 'permission-denied'
          ? 'Perubahan ditolak server. Periksa login admin dan aturan Firestore (update).'
          : 'Perubahan gagal disimpan. Coba lagi.', 'error');
        if (btn) btn.disabled = false;
      });
  }

  // Dipakai modul lain (mis. admin-surat.js) untuk mengambil data lengkap dari Firestore
  window.adminData = {
    getSubmissionRaw: (id) => rawById.surat[id] || null,
    getComplaintRaw: (id) => rawById.pengaduan[id] || null,
    getSubmissions: () => submissions.slice(),
    getComplaints: () => complaints.slice(),
    getState: () => ({ state: dataState.surat, error: dataState.error }),
    reload: () => reloadLocal()
  };

  /* ---------- Auth ---------- */
  function initAuth() {
    const auth = window.adminAuth;
    if (auth && typeof auth.checkAuthGuard === 'function') auth.checkAuthGuard(false);
    try { session = auth && typeof auth.getSession === 'function' ? auth.getSession() : null; } catch (e) { session = null; }
    const name = (session && (session.name || session.displayName || session.email)) || 'Admin Desa';
    $('adminUserName').textContent = name;
    $('settingsName').textContent = name;
    return name;
  }
  
async function doLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari panel admin?')) {
    return;
  }

  const auth = window.adminAuth;

  if (auth && typeof auth.logout === 'function') {
    try {
      await auth.logout();
    } catch (error) {
      console.error('[Admin] Logout gagal:', error);

      if (typeof toast === 'function') {
        toast(
          error.message || 'Logout gagal. Silakan coba lagi.',
          'error'
        );
      }
    }
  } else {
    localStorage.removeItem('mekarsari_admin_session');
    sessionStorage.removeItem('mekarsari_admin_session');
    window.location.replace('login.html');
  }
}


  /* ---------- Statistik ---------- */
  function renderStats() {
    const n = (fn) => submissions.filter(fn).length;
    $('statNewCount').textContent = n((s) => s.status === 'Diajukan');
    $('statProcessCount').textContent = n((s) => s.status === 'Diperiksa');
    $('statRevisionCount').textContent = n((s) => s.status === 'Perlu Perbaikan');
    $('statCompletedCount').textContent = n((s) => s.status === 'Disetujui' || s.status === 'Selesai');
  }

  function badgeClass(status) {
    switch (status) {
      case 'Diajukan': case 'Baru': case 'Draft': return 'badge-diajukan';
      case 'Diperiksa': case 'Diproses': return 'badge-diperiksa';
      case 'Perlu Perbaikan': case 'Nonaktif': return 'badge-perlu-perbaikan';
      case 'Disetujui': return 'badge-disetujui';
      case 'Selesai': case 'Terbit': case 'Aktif': return 'badge-selesai';
      default: return 'badge-diajukan';
    }
  }
  const badge = (status) => `<span class="badge ${badgeClass(status)}">${esc(status)}</span>`;
  const detailBtn = (id) => `<td><button type="button" class="btn-primary-admin btn-sm" data-id="${esc(id)}"><i class="fa-solid fa-eye"></i> Detail</button></td>`;

  /* ---------- Tabel generik ---------- */
  function initTable(cfg) {
    const body = $(cfg.bodyId);
    if (!body) return;
    const search = cfg.searchId ? $(cfg.searchId) : null;
    const status = cfg.statusId ? $(cfg.statusId) : null;

    function render() {
      const q = (search ? search.value : '').trim().toLowerCase();
      const st = status ? status.value : 'all';
      const all = cfg.getData().filter((item) =>
        (st === 'all' || item.status === st) &&
        (!q || cfg.searchFields.some((f) => String(item[f] == null ? '' : item[f]).toLowerCase().includes(q)))
      );
      const rows = cfg.limit ? all.slice(0, cfg.limit) : all;
      body.innerHTML = rows.length
        ? rows.map(cfg.rowHtml).join('')
        : `<tr><td colspan="${cfg.colspan}"><div class="state-container"><i class="fa-solid fa-folder-open"></i><p>${esc(typeof cfg.emptyText === 'function' ? cfg.emptyText() : cfg.emptyText)}</p></div></td></tr>`;
      if (cfg.countId && $(cfg.countId)) $(cfg.countId).textContent = `Menampilkan ${rows.length} data`;
    }

    if (search) search.addEventListener('input', render);
    if (status) status.addEventListener('change', render);
    if (cfg.onOpen) {
      body.addEventListener('click', (e) => {
      // Tombol aksi memiliki handler tersendiri.
      if (e.target.closest('[data-action]')) return;

      const row = e.target.closest('tr[data-id]');
      if (row) cfg.onOpen(row.dataset.id);
    });
      body.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('tr[data-id]')) cfg.onOpen(e.target.dataset.id);
      });
    }
    tables.push({ render });
    render();
  }

  function renderAll() {
    renderStats();
    tables.forEach((t) => t.render());
  }

  /* ---------- Modal ---------- */
  let lastFocus = null;
  function openModal(title, html) {
    const modal = $('detailModal');
    $('modalTitle').textContent = title;
    $('modalDetailBody').innerHTML = html;
    lastFocus = document.activeElement;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const first = $('modalDetailBody').querySelector('select, textarea, input, button');
    if (first) first.focus();
  }
  function closeModal() {
    const modal = $('detailModal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    $('modalDetailBody').innerHTML = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  const field = (label, value) =>
  `<div class="detail-block">
    <span class="detail-label">${esc(label)}</span>
    <p class="detail-value">${esc(value)}</p>
  </div>`;

  function extraHtml(extra) {
    if (!extra || typeof extra !== 'object') return '';
    const rows = Object.keys(extra).map((k) => field(humanize(k), extra[k] || '-')).join('');
    return rows ? `<div class="detail-grid">${rows}</div>` : '';
  }

  function openSubmissionModal(id) {
    const item = submissions.find((s) => s.id === id);
    if (!item) return;
    const options = SUBMISSION_STATUSES.map(([v, l]) => `<option value="${v}"${item.status === v ? ' selected' : ''}>${l}</option>`).join('');
    openModal('Detail Pengajuan Surat', `
      <div class="detail-block"><span class="detail-label">Nomor Pengajuan</span><p class="detail-id">${esc(item.id)}</p></div>
      <div class="detail-grid">${field('Nama Pemohon', item.applicant)}${field('NIK (Disamarkan)', item.nik)}</div>
      <div class="detail-grid">${field('WhatsApp', item.raw.wa || '-')}${field('Alamat', item.raw.alamat || '-')}</div>
      ${field('Jenis Surat & Tanggal', `${item.type} — ${showDate(item)}`)}
      <div class="detail-block"><span class="detail-label">Keperluan</span><p class="detail-text">${esc(item.detail)}</p></div>
      ${extraHtml(item.raw.extra)}
      ${item.raw.dokumen && item.raw.dokumen.name ? field('Dokumen terlampir', item.raw.dokumen.name + ' (nama file saja, file belum diunggah ke server)') : ''}
      <div class="detail-block">
        <label class="detail-label" for="modalStatusSelect">Pembaruan Status Surat</label>
        <select id="modalStatusSelect" class="form-control">${options}</select>
      </div>
      <div class="detail-block">
        <label class="detail-label" for="modalNote">Catatan untuk pemohon (wajib jika status Perlu Perbaikan)</label>
        <textarea id="modalNote" class="form-control" rows="3">${esc(item.note)}</textarea>
      </div>
      <button type="button" class="btn-primary-admin" data-save="submission" data-id="${esc(item.id)}"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan Status</button>
    `);
  }
  function saveSubmission(id, btn) {
    const item = submissions.find((s) => s.id === id);
    if (!item) return;
    const status = $('modalStatusSelect').value;
    const note = $('modalNote').value.trim();
    if (status === 'Perlu Perbaikan' && !note) {
      toast('Isi catatan perbaikan agar pemohon tahu apa yang harus diperbaiki.', 'error');
      $('modalNote').focus();
      return;
    }
    persist('surat', id, { status, note }, btn, `Status pengajuan ${id} diperbarui menjadi "${status}".`);
  }

  function nomorWhatsApp(nomor) {
  let n = String(nomor || '').replace(/\D/g, '');

  if (n.startsWith('0')) {
    n = '62' + n.slice(1);
  } else if (n.startsWith('8')) {
    n = '62' + n;
  }

  return n;
}

function tautanWhatsApp(nomor) {
  const n = nomorWhatsApp(nomor);

  // Hindari membuat tautan untuk nomor yang terlalu pendek.
  if (n.length < 10 || n.length > 15) return '';

  return `https://wa.me/${n}`;
}

  function openComplaintModal(id) {
    const item = complaints.find((c) => c.id === id);
    if (!item) return;
    const options = COMPLAINT_STATUSES.map((s) => `<option value="${s}"${item.status === s ? ' selected' : ''}>${s}</option>`).join('');
    openModal('Detail Pengaduan', `
      <div class="detail-block"><span class="detail-label">Nomor Pengaduan</span><p class="detail-id">${esc(item.id)}</p></div>
      <div class="detail-grid">${field('Pelapor', item.reporter)}${field('Kategori', item.category)}</div>
      <div class="detail-grid">${field('Tanggal', showDate(item))}${field('Lokasi Kejadian', item.lokasi || '-')}</div>
      ${field('Kontak Pelapor', item.kontak || '-')}
      <div class="detail-block"><span class="detail-label">Isi Pengaduan</span><p class="detail-text">${esc(item.detail)}</p></div>
      <div class="detail-block">
        <label class="detail-label" for="modalStatusSelect">Status</label>
        <select id="modalStatusSelect" class="form-control">${options}</select>
      </div>
      <div class="detail-block">
        <label class="detail-label" for="modalNote">Tanggapan petugas</label>
        <textarea id="modalNote" class="form-control" rows="3">${esc(item.response)}</textarea>
      </div>
      <button type="button" class="btn-primary-admin" data-save="complaint" data-id="${esc(item.id)}"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan</button>
    `);
  }
  function saveComplaint(id, btn) {
    const item = complaints.find((c) => c.id === id);
    if (!item) return;
    const status = $('modalStatusSelect').value;
    const response = $('modalNote').value.trim();
    persist('pengaduan', id, { status, response }, btn, `Pengaduan ${id} diperbarui menjadi "${status}".`);
  }

  async function deleteComplaint(id, btn) {
  const item = complaints.find((c) => c.id === id);
  if (!item) return;

  const confirmed = confirm(
    `Yakin ingin menghapus pengaduan ${id} dari ${item.reporter}?\n\n` +
    'Data yang dihapus tidak dapat dipulihkan.'
  );

  if (!confirmed) return;

  if (!Store || typeof Store.delete !== 'function') {
    toast(
      'Fungsi hapus belum tersedia di SubmissionStore.',
      'error'
    );
    return;
  }

  btn.disabled = true;

  try {
    await Store.delete('pengaduan', id);

    if (Store.getMode() === 'local') {
      await reloadLocal();
    }

    closeModalIfNeeded();
    toast(`Pengaduan ${id} berhasil dihapus.`);
  } catch (err) {
    console.error('[Admin] Hapus pengaduan gagal:', err);

    toast(
      err && err.code === 'permission-denied'
        ? 'Penghapusan ditolak server. Periksa hak akses admin.'
        : 'Pengaduan gagal dihapus. Silakan coba lagi.',
      'error'
    );

    btn.disabled = false;
  }
}

function closeModalIfNeeded() {
  // Tidak menutup modal detail jika modal tidak sedang terbuka.
  if ($('detailModal')?.classList.contains('active')) {
    closeModal();
  }
}
  /* ---------- Ekspor CSV (pemisah ; agar terbaca benar di Excel regional Indonesia) ---------- */
  function exportSubmissionsCsv() {
    const header = ['No. Pengajuan', 'Pemohon', 'NIK (disamarkan)', 'WhatsApp', 'Jenis Surat', 'Tanggal', 'Status', 'Keperluan', 'Catatan'];
    const rows = [...submissions].sort(byDateDesc).map((s) => [s.id, s.applicant, s.nik, s.raw.wa || '', s.type, s.date || s.dateLabel, s.status, s.detail, s.note || '']);
    const cell = (v) => {
      let t = String(v == null ? '' : v);
      if (/^[=+\-@]/.test(t)) t = "'" + t; // cegah formula injection
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pengajuan-surat-${isoDaysAgo(0)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('File CSV diunduh.');
  }

  /* ---------- Navigasi antar tampilan ---------- */
  function setSidebar(open) {
    $('adminSidebar').classList.toggle('active', open);
    $('sidebarBackdrop').classList.toggle('active', open);
    $('mobileToggle').setAttribute('aria-expanded', String(open));
  }
  function showView(name) {
    if (!VIEWS[name]) name = 'dashboard';
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    document.querySelectorAll('.menu-link').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    $('pageTitle').textContent = VIEWS[name][0];
    const who = $('adminUserName').textContent;
    $('pageSubtitle').textContent = name === 'dashboard' ? `Selamat datang, ${who}` : VIEWS[name][1];
    document.title = `${VIEWS[name][0]} — Admin Desa Mekarsari`;
    setSidebar(false);
    window.scrollTo(0, 0);
  }

  /* ---------- Inisialisasi ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const userName = initAuth();
    $('footerYear').textContent = new Date().getFullYear();

    const submissionRow = (s) => `
      <tr data-id="${esc(s.id)}" tabindex="0">
        <td><strong>${esc(s.id)}</strong></td><td>${esc(s.applicant)}</td><td>${esc(s.type)}</td>
        <td>${showDate(s)}</td><td>${badge(s.status)}</td>${detailBtn(s.id)}
      </tr>`;
    const submissionCfg = {
      getData: () => [...submissions].sort(byDateDesc),
      searchFields: ['id', 'type', 'applicant', 'status'],
      rowHtml: submissionRow, colspan: 6, onOpen: openSubmissionModal,
      emptyText: () => stateText('surat', 'Tidak ada data pengajuan surat ditemukan.')
    };
    initTable({ ...submissionCfg, bodyId: 'submissionsTableBody', searchId: 'searchInput', statusId: 'statusFilter', limit: 5 });
    initTable({ ...submissionCfg, bodyId: 'submissionsAllBody', searchId: 'searchInputAll', statusId: 'statusFilterAll', countId: 'submissionsAllCount' });

    initTable({
      bodyId: 'complaintsBody', searchId: 'searchComplaints', statusId: 'statusComplaints',
      getData: () => [...complaints].sort(byDateDesc),
      searchFields: ['id', 'reporter', 'category', 'status'], colspan: 6, onOpen: openComplaintModal,
      emptyText: () => stateText('pengaduan', 'Tidak ada pengaduan ditemukan.'),
      rowHtml: (c) => {
  const waUrl = tautanWhatsApp(c.kontak);

  return `
    <tr data-id="${esc(c.id)}" tabindex="0">
      <td><strong>${esc(c.id)}</strong></td>
      <td>${esc(c.reporter)}</td>
      <td>${esc(c.category)}</td>
      <td>${showDate(c)}</td>
      <td>${badge(c.status)}</td>
      <td>
        <div class="complaint-actions">
          <button
            type="button"
            class="btn-primary-admin btn-sm"
            data-id="${esc(c.id)}"
            title="Lihat detail pengaduan"
          >
            <i class="fa-solid fa-eye"></i>
            Detail
          </button>

          ${
            waUrl
              ? `<a
                   href="${esc(waUrl)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn-success-admin btn-sm"
                   data-action="contact"
                   title="Hubungi pelapor melalui WhatsApp"
                 >
                   <i class="fa-brands fa-whatsapp"></i>
                   Hubungi
                 </a>`
              : `<button
                   type="button"
                   class="btn-secondary-admin btn-sm"
                   disabled
                   title="Nomor WhatsApp tidak tersedia atau tidak valid"
                 >
                   <i class="fa-brands fa-whatsapp"></i>
                   Hubungi
                 </button>`
          }

          <button
            type="button"
            class="btn-danger-admin btn-sm"
            data-action="delete"
            data-id="${esc(c.id)}"
            title="Hapus pengaduan"
          >
            <i class="fa-solid fa-trash"></i>
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `;
}
    });


    $('complaintsBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (!btn) return;

  deleteComplaint(btn.dataset.id, btn);
});

    initTable({
      bodyId: 'newsBody', searchId: 'searchNews', getData: () => NEWS,
      searchFields: ['title', 'category'], colspan: 4, emptyText: 'Tidak ada berita ditemukan.',
      rowHtml: (n) => `<tr><td><strong>${esc(n.title)}</strong></td><td>${esc(n.category)}</td><td>${formatDate(n.date)}</td><td>${badge(n.status)}</td></tr>`
    });
    initTable({
      bodyId: 'usersBody', getData: () => [{ name: userName, role: 'Petugas Desa', status: 'Aktif' }],
      searchFields: ['name'], colspan: 3, emptyText: 'Tidak ada pengguna.',
      rowHtml: (u) => `<tr><td><strong>${esc(u.name)}</strong> (Anda)</td><td>${esc(u.role)}</td><td>${badge(u.status)}</td></tr>`
    });
    renderStats();
    connectData();

    // Modal
    $('modalCloseBtn').addEventListener('click', closeModal);
    $('detailModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
    $('modalDetailBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-save]');
      if (!btn) return;
      if (btn.dataset.save === 'submission') saveSubmission(btn.dataset.id, btn);
      else saveComplaint(btn.dataset.id, btn);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('detailModal').classList.contains('active')) closeModal();
      else setSidebar(false);
    });

    // Sidebar mobile
    $('mobileToggle').addEventListener('click', () => setSidebar(!$('adminSidebar').classList.contains('active')));
    $('sidebarBackdrop').addEventListener('click', () => setSidebar(false));
    document.querySelectorAll('.menu-link').forEach((a) => a.addEventListener('click', () => setSidebar(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 992) setSidebar(false); });

    // Lain-lain
    $('logoutBtn').addEventListener('click', doLogout);
    $('exportCsvBtn').addEventListener('click', exportSubmissionsCsv);
    // Data asli dari database: tombol "Reset Data Contoh" tidak dipakai lagi
    const resetBtn = $('resetDataBtn');
    if (resetBtn) resetBtn.hidden = true;
    const settingsNotice = document.querySelector('#view-pengaturan .notice');
    if (settingsNotice) {
      settingsNotice.textContent = Store && Store.getMode() === 'firestore'
        ? 'Data pengajuan surat dan pengaduan tersimpan di Database dan tampil realtime di semua perangkat admin.'
        : 'Mode uji coba: Firebase belum aktif, data hanya ada di browser ini.';
    }

    // Router berbasis hash
    window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
    showView(location.hash.slice(1));
  });
})();
