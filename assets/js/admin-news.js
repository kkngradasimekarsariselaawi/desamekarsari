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

  var CATEGORY = { pemerintahan: 'Pemerintahan', kegiatan: 'Kegiatan', umkm: 'UMKM', pembangunan: 'Pembangunan' };

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
  var notice = $('newsModeNotice');
  if (notice) {
    if (S.getMode() === 'firestore') {
      notice.innerHTML = '<i class="fa-solid fa-cloud"></i> Terhubung ke Database. Berita berstatus Terbit langsung tampil di halaman Berita.';
    } else {
      notice.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Mode uji coba: berita hanya tersimpan di browser ini. Isi <code>assets/js/firebase-config.js</code> agar tampil untuk semua pengunjung.';
    }
  }

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

  load();
})();
