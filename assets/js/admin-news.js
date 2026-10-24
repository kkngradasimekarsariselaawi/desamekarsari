
  /*
 * admin-news.js — kelola Berita & Kegiatan di dashboard admin.
 * Memakai NewsStore (news-store.js). Harus dimuat SETELAH admin-dashboard.js.
 */
(function () {
  'use strict';

  var S = window.NewsStore;
  if (!S) { console.error('[admin-news] news-store.js belum dimuat'); return; }

  function $(id) { return document.getElementById(id); }

  var view = $('view-berita');
  var tbody = $('newsBody');
  var overlay = $('newsFormOverlay');
  var form = $('newsForm');
  if (!view || !tbody || !overlay || !form) return;

  var items = [];
  var loading = true;
  var loadError = '';

  // Lepas listener pencarian bawaan (data contoh) dengan mengganti node-nya.
  var searchBox = $('searchNews');
  if (searchBox) {
    var fresh = searchBox.cloneNode(true);
    searchBox.parentNode.replaceChild(fresh, searchBox);
    searchBox = fresh;
    searchBox.addEventListener('input', render);
  }

  var CATEGORY = {
    pemerintahan: 'Pemerintahan',
    kegiatan: 'Kegiatan',
    umkm: 'UMKM',
    pembangunan: 'Pembangunan',
    pemberdayaan: 'Pemberdayaan'
};

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function fmtDate(str) {
    if (!str) return '-';
    var d = new Date(str + 'T00:00:00');
    return isNaN(d) ? esc(str) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function toast(message, type) {
    var box = $('toastContainer');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'nw-toast nw-toast--' + (type || 'ok');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  /* ---------- Info mode penyimpanan ---------- */
  /*var notice = $('newsModeNotice');
  if (notice) {
    if (S.getMode() === 'firestore') {
      notice.innerHTML = '<i class="fa-solid fa-cloud"></i> Terhubung ke Database. Berita berstatus Terbit langsung tampil di halaman Berita.';
    } else {
      notice.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Mode uji coba: berita hanya tersimpan di browser ini. Isi <code>assets/js/firebase-config.js</code> agar tampil untuk semua pengunjung.';
    }
  }*/

  /* ---------- Tabel ---------- */
  function render() {
    var q = searchBox ? searchBox.value.trim().toLowerCase() : '';

    if (loading) {
      tbody.innerHTML = '<tr class="nw-empty"><td colspan="5">Memuat berita...</td></tr>';
      return;
    }
    if (loadError) {
      tbody.innerHTML = '<tr class="nw-empty"><td colspan="5">' + esc(loadError) + '</td></tr>';
      return;
    }

    var rows = items.filter(function (n) {
      return !q || n.judul.toLowerCase().indexOf(q) > -1 || (CATEGORY[n.kategori] || n.kategori).toLowerCase().indexOf(q) > -1;
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr class="nw-empty"><td colspan="5">' +
        (items.length ? 'Tidak ada berita yang cocok dengan pencarian.' : 'Belum ada berita. Klik "Tambah Berita" untuk mulai menulis.') +
        '</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (n) {
      var thumb = n.gambar
        ? '<img class="nw-thumb" src="' + esc(n.gambar) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
        : '<span class="nw-thumb nw-thumb--empty"><i class="fa-regular fa-image"></i></span>';
      var published = n.status === 'published';
      return '<tr class="nw-row" data-id="' + esc(n.id) + '">' +
        '<td><div class="nw-title-cell">' + thumb + '<span>' + esc(n.judul) + '</span></div></td>' +
        '<td>' + esc(CATEGORY[n.kategori] || n.kategori) + '</td>' +
        '<td>' + fmtDate(n.tanggal) + '</td>' +
        '<td><span class="nw-pill ' + (published ? 'nw-pill--on' : 'nw-pill--off') + '">' + (published ? 'Terbit' : 'Draf') + '</span></td>' +
        '<td class="nw-actions">' +
          '<button type="button" class="nw-icon-btn" data-act="toggle" title="' + (published ? 'Jadikan draf' : 'Terbitkan') + '" aria-label="' + (published ? 'Jadikan draf' : 'Terbitkan') + '"><i class="fa-solid ' + (published ? 'fa-eye-slash' : 'fa-eye') + '"></i></button>' +
          '<button type="button" class="nw-icon-btn" data-act="edit" title="Edit" aria-label="Edit berita"><i class="fa-solid fa-pen"></i></button>' +
          '<button type="button" class="nw-icon-btn nw-icon-btn--danger" data-act="delete" title="Hapus" aria-label="Hapus berita"><i class="fa-solid fa-trash"></i></button>' +
        '</td></tr>';
    }).join('');
  }

  function load() {
    loading = true; loadError = '';
    render();
    return S.getAll().then(function (list) {
      items = list;
    }).catch(function (err) {
      console.error('[admin-news]', err);
      loadError = 'Gagal memuat berita. Periksa konfigurasi Firebase dan aturan Firestore.';
    }).then(function () {
      loading = false;
      render();
    });
  }

  // Jika kode lama (data contoh) menimpa isi tabel, tampilkan ulang data kita.
  new MutationObserver(function () {
    if (!tbody.querySelector('.nw-row, .nw-empty')) render();
  }).observe(tbody, { childList: true });

  /* ---------- Form ---------- */
  var f = form.elements;
  var errBox = $('newsFormError');
  var preview = $('newsPhotoPreview');
  var saveBtn = $('newsSaveBtn');

  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = !msg;
  }

  function updatePreview() {
    var id = S.extractDriveId(f.foto.value);
    if (!f.foto.value.trim()) {
      preview.innerHTML = '<span class="nw-preview-hint">Foto belum dipilih.</span>';
    } else if (!id) {
      preview.innerHTML = '<span class="nw-preview-hint nw-preview-hint--bad">Link belum dikenali. Tempel link berbagi dari Google Drive.</span>';
    } else {
      preview.innerHTML = '<img src="' + esc(S.imageUrl(id, 600)) + '" alt="Pratinjau foto" ' +
        'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'nw-preview-hint nw-preview-hint--bad\',textContent:\'Foto tidak bisa dimuat. Pastikan akses file: Siapa saja yang memiliki link (Pelihat).\'}))">';
    }
  }

  function openForm(item) {
    form.reset();
    showError('');
    f.newsId.value = item ? item.id : '';
    f.judul.value = item ? item.judul : '';
    f.kategori.value = item ? item.kategori : 'kegiatan';
    f.tanggal.value = item ? item.tanggal : today();
    f.status.value = item ? item.status : 'published';
    f.foto.value = item && item.gambarId ? 'https://drive.google.com/file/d/' + item.gambarId + '/view' : '';
    f.ringkasan.value = item ? item.ringkasan : '';
    f.isi.value = item ? item.isi : '';
    $('newsFormTitle').textContent = item ? 'Edit Berita' : 'Tambah Berita';
    updatePreview();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    f.judul.focus();
  }

  function closeForm() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function setBusy(busy) {
    saveBtn.disabled = busy;
    saveBtn.textContent = busy ? 'Menyimpan...' : 'Simpan berita';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var judul = f.judul.value.trim();
    var ringkasan = f.ringkasan.value.trim();
    var isi = f.isi.value.trim();
    var rawFoto = f.foto.value.trim();
    var gambarId = rawFoto ? S.extractDriveId(rawFoto) : '';

    if (judul.length < 5) return showError('Judul minimal 5 karakter.');
    if (!f.tanggal.value) return showError('Tanggal wajib diisi.');
    if (!ringkasan) return showError('Ringkasan wajib diisi.');
    if (!isi) return showError('Isi berita wajib diisi.');
    if (rawFoto && !gambarId) return showError('Link foto tidak dikenali. Tempel link berbagi dari Google Drive.');
    showError('');

    var editing = !!f.newsId.value;
    setBusy(true);
    S.save({
      id: f.newsId.value || null,
      judul: judul,
      kategori: f.kategori.value,
      tanggal: f.tanggal.value,
      ringkasan: ringkasan,
      isi: isi,
      status: f.status.value,
      gambarId: gambarId
    }).then(function () {
      closeForm();
      toast(editing ? 'Perubahan berita disimpan.' : 'Berita disimpan.');
      return load();
    }).catch(function (err) {
      console.error('[admin-news]', err);
      showError('Gagal menyimpan. Pastikan Anda sudah login dan aturan Firestore mengizinkan penulisan.');
    }).then(function () {
      setBusy(false);
    });
  });

  f.foto.addEventListener('input', updatePreview);
  $('newsAddBtn').addEventListener('click', function () { openForm(null); });
  $('newsCancelBtn').addEventListener('click', closeForm);
  $('newsFormClose').addEventListener('click', closeForm);
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeForm(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeForm();
  });

  /* ---------- Aksi di tabel ---------- */
  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    var row = e.target.closest('.nw-row');
    if (!btn || !row) return;
    var item = items.filter(function (n) { return String(n.id) === row.getAttribute('data-id'); })[0];
    if (!item) return;

    var act = btn.getAttribute('data-act');
    if (act === 'edit') return openForm(item);

    if (act === 'toggle') {
      var next = item.status === 'published' ? 'draft' : 'published';
      S.save(Object.assign({}, item, { status: next })).then(function () {
        toast(next === 'published' ? 'Berita diterbitkan.' : 'Berita dijadikan draf.');
        return load();
      }).catch(function (err) {
        console.error('[admin-news]', err);
        toast('Gagal mengubah status.', 'err');
      });
      return;
    }

    if (act === 'delete') {
      if (!window.confirm('Hapus berita "' + item.judul + '"? Tindakan ini tidak bisa dibatalkan.')) return;
      S.remove(item.id).then(function () {
        toast('Berita dihapus.');
        return load();
      }).catch(function (err) {
        console.error('[admin-news]', err);
        toast('Gagal menghapus berita.', 'err');
      });
    }
  });

  
  /* ---------- Impor Berita dari Excel / CSV ---------- */

  function normalizeHeader(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  function getExcelDate(value) {
    if (value instanceof Date && !isNaN(value)) {
      return value.getFullYear() + '-' +
        String(value.getMonth() + 1).padStart(2, '0') + '-' +
        String(value.getDate()).padStart(2, '0');
    }

    if (typeof value === 'number' && window.XLSX) {
      var parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return parsed.y + '-' +
          String(parsed.m).padStart(2, '0') + '-' +
          String(parsed.d).padStart(2, '0');
      }
    }

    var str = String(value || '').trim();
    if (!str) return '';

    // Format YYYY-MM-DD
    var iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      return iso[1] + '-' +
        String(iso[2]).padStart(2, '0') + '-' +
        String(iso[3]).padStart(2, '0');
    }

    // Format DD/MM/YYYY atau DD-MM-YYYY
    var local = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (local) {
      return local[3] + '-' +
        String(local[2]).padStart(2, '0') + '-' +
        String(local[1]).padStart(2, '0');
    }

    return '';
  }

  
function downloadNewsTemplate() {
  if (!window.XLSX) {
    toast('Library Excel belum berhasil dimuat.', 'err');
    return;
  }

  // Sheet 1: Data Berita
  var dataRows = [
    [
      'judul',
      'kategori',
      'tanggal',
      'ringkasan',
      'isi',
      'foto',
      'status'
    ],
    [
      'Kegiatan Kerja Bakti Desa Mekarsari',
      'kegiatan',
      today(),
      'Warga bersama perangkat desa melaksanakan kerja bakti.',
      'Kegiatan kerja bakti dilaksanakan untuk menjaga kebersihan lingkungan desa.\n\nWarga dan perangkat desa bekerja sama membersihkan lingkungan sekitar.',
      '',
      'draft'
    ]
  ];

  var wsData = XLSX.utils.aoa_to_sheet(dataRows);

  wsData['!cols'] = [
    { wch: 38 },
    { wch: 18 },
    { wch: 14 },
    { wch: 55 },
    { wch: 70 },
    { wch: 48 },
    { wch: 14 }
  ];

  wsData['!freeze'] = {
    xSplit: 0,
    ySplit: 1
  };

  wsData['!autofilter'] = {
    ref: 'A1:G2'
  };

  // Sheet 2: Petunjuk Pengisian
  var guideRows = [
    ['PETUNJUK PENGISIAN TEMPLATE BERITA & KEGIATAN'],
    ['Website Pemerintah Desa Mekarsari'],
    [''],
    ['NO', 'NAMA KOLOM', 'WAJIB?', 'PETUNJUK PENGISIAN', 'CONTOH'],
    [
      1,
      'judul',
      'Ya',
      'Masukkan judul berita yang jelas dan informatif.',
      'Kegiatan Kerja Bakti Desa Mekarsari'
    ],
    [
      2,
      'kategori',
      'Ya',
      'Gunakan salah satu kategori: pemerintahan, kegiatan, umkm, pembangunan, pemberdayaan.',
      'kegiatan'
    ],
    [
      3,
      'tanggal',
      'Ya',
      'Gunakan format YYYY-MM-DD. Contoh: 16 Oktober 2026 ditulis 2026-10-16.',
      '2026-10-16'
    ],
    [
      4,
      'ringkasan',
      'Ya',
      'Tulis ringkasan singkat berita, maksimal 220 karakter.',
      'Warga bersama perangkat desa melaksanakan kerja bakti.'
    ],
    [
      5,
      'isi',
      'Ya',
      'Tulis isi berita secara lengkap. Gunakan paragraf yang jelas.',
      'Kegiatan kerja bakti dilaksanakan untuk menjaga kebersihan lingkungan desa.'
    ],
    [
      6,
      'foto',
      'Tidak',
      'Masukkan link berbagi foto Google Drive yang dapat diakses oleh pemilik link.',
      'https://drive.google.com/file/d/ID_FILE/view'
    ],
    [
      7,
      'status',
      'Tidak',
      'Gunakan draft agar berita belum tampil ke publik, atau published agar berita diterbitkan. Jika kosong, otomatis draft.',
      'draft'
    ],
    [''],
    ['CATATAN PENTING'],
    ['1.', 'Jangan mengubah nama kolom pada baris pertama Sheet Data Berita.'],
    ['2.', 'Setiap baris setelah header mewakili satu berita atau kegiatan.'],
    ['3.', 'Jangan menghapus kolom yang sudah tersedia.'],
    ['4.', 'Pastikan kategori ditulis sesuai pilihan yang tersedia.'],
    ['5.', 'Periksa tanggal, judul, ringkasan, dan isi sebelum impor.'],
    ['6.', 'Baris dengan data wajib tidak lengkap dapat dilewati saat impor.'],
    ['7.', 'Foto tidak diunggah dari Excel; kolom foto berisi link Google Drive.'],
    ['8.', 'Uji impor dengan beberapa baris terlebih dahulu.']
  ];

  var wsGuide = XLSX.utils.aoa_to_sheet(guideRows);

  wsGuide['!cols'] = [
    { wch: 8 },
    { wch: 20 },
    { wch: 12 },
    { wch: 82 },
    { wch: 48 }
  ];

  wsGuide['!freeze'] = {
    xSplit: 0,
    ySplit: 4
  };

  // Buat workbook
  var wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    wsData,
    'Data Berita'
  );

  XLSX.utils.book_append_sheet(
    wb,
    wsGuide,
    'Petunjuk Pengisian'
  );

  XLSX.writeFile(wb, 'template_import_berita.xlsx');
}
  function readNewsRow(row) {
    var data = {};

    Object.keys(row).forEach(function (key) {
      var k = normalizeHeader(key);

      var aliases = {
        judul: 'judul',
        kategori: 'kategori',
        tanggal: 'tanggal',
        ringkasan: 'ringkasan',
        isi: 'isi',
        isiberita: 'isi',
        foto: 'foto',
        gambar: 'foto',
        linkfoto: 'foto',
        status: 'status'
      };

      if (aliases[k]) data[aliases[k]] = row[key];
    });

    var judul = String(data.judul || '').trim();
    var kategori = String(data.kategori || 'kegiatan')
      .trim().toLowerCase();
    var tanggal = getExcelDate(data.tanggal);
    var ringkasan = String(data.ringkasan || '').trim();
    var isi = String(data.isi || '').trim();
    var foto = String(data.foto || '').trim();
    var status = String(data.status || 'draft').trim().toLowerCase();

    var errors = [];

    if (judul.length < 5) errors.push('judul kosong atau kurang dari 5 karakter');
    if (!tanggal) errors.push('tanggal tidak valid');
    if (!ringkasan) errors.push('ringkasan kosong');
    if (!isi) errors.push('isi berita kosong');

    if (!CATEGORY[kategori]) {
      errors.push('kategori tidak valid');
    }

    if (ringkasan.length > 220) {
      errors.push('ringkasan melebihi 220 karakter');
    }

    if (foto && !S.extractDriveId(foto)) {
      errors.push('link foto Google Drive tidak valid');
    }

    if (status === 'terbit') status = 'published';
    if (status === 'draf') status = 'draft';

    if (status !== 'published' && status !== 'draft') {
      errors.push('status harus published atau draft');
    }

    return {
      data: {
        judul: judul,
        kategori: kategori,
        tanggal: tanggal,
        ringkasan: ringkasan,
        isi: isi,
        gambarId: foto ? S.extractDriveId(foto) : '',
        status: status
      },
      errors: errors
    };
  }

  function importNewsExcel() {
    var input = $('newsExcelInput');
    var result = $('newsImportResult');
    var btn = $('newsImportBtn');
    var file = input && input.files && input.files[0];

    if (!file) {
      toast('Pilih file Excel atau CSV terlebih dahulu.', 'err');
      return;
    }

    if (!window.XLSX) {
      toast('Library Excel belum berhasil dimuat.', 'err');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memproses...';
    result.textContent = 'Membaca file...';

    var reader = new FileReader();

    reader.onerror = function () {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Impor Berita';
      result.textContent = 'File gagal dibaca.';
    };

    reader.onload = function (event) {
      var rows;

      try {
        var workbook = XLSX.read(event.target.result, {
          type: 'array',
          cellDates: true
        });

        var sheet = workbook.Sheets[workbook.SheetNames[0]];

        rows = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: true
        });
      } catch (err) {
        console.error('[Impor Berita]', err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Impor Berita';
        result.textContent = 'Format file tidak dapat dibaca.';
        return;
      }

      if (!rows.length) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Impor Berita';
        result.textContent = 'File tidak memiliki data.';
        return;
      }

      var imported = 0;
      var skipped = 0;
      var errors = [];
      var seen = {};

      // Hindari duplikat dari berita yang sudah ada.
      items.forEach(function (item) {
        seen[
          String(item.judul || '').trim().toLowerCase() +
          '|' + String(item.tanggal || '')
        ] = true;
      });

      var queue = [];

      rows.forEach(function (row, index) {
        var parsed = readNewsRow(row);
        var data = parsed.data;
        var rowNumber = index + 2;

        if (parsed.errors.length) {
          skipped++;
          errors.push('Baris ' + rowNumber + ': ' + parsed.errors.join(', '));
          return;
        }

        var key = data.judul.toLowerCase() + '|' + data.tanggal;

        if (seen[key]) {
          skipped++;
          errors.push('Baris ' + rowNumber + ': judul dan tanggal sudah ada');
          return;
        }

        seen[key] = true;
        queue.push({ rowNumber: rowNumber, data: data });
      });

      // Simpan satu per satu melalui NewsStore yang sudah digunakan admin.
      queue.reduce(function (promise, entry) {
        return promise.then(function () {
          return S.save(entry.data).then(function () {
            imported++;
          }).catch(function (err) {
            console.error('Gagal impor baris ' + entry.rowNumber, err);
            skipped++;
            errors.push('Baris ' + entry.rowNumber + ': gagal disimpan ke database');
          });
        });
      }, Promise.resolve()).then(function () {
        return load();
      }).then(function () {
        var summary = 'Selesai. Berhasil: ' + imported +
          ', dilewati/gagal: ' + skipped + '.';

        result.textContent = summary +
          (errors.length ? '\n' + errors.slice(0, 10).join('\n') : '');

        toast(summary, skipped ? 'err' : 'ok');
      }).catch(function (err) {
        console.error('[Impor Berita]', err);
        result.textContent = 'Impor selesai dengan kendala saat memuat ulang data.';
      }).then(function () {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Impor Berita';
      });
    };

    reader.readAsArrayBuffer(file);
  }

  $('newsTemplateBtn').addEventListener('click', downloadNewsTemplate);
  $('newsImportBtn').addEventListener('click', importNewsExcel);

  load();
})();