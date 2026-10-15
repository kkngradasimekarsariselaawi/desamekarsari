/*
 * news-store.js — penyimpanan berita yang dipakai bersama
 * oleh dashboard admin (admin/index.html) dan halaman publik (berita.html).
 *
 *  - Teks berita : Firebase Firestore (koleksi "berita"), jika FIREBASE_CONFIG diisi
 *  - Foto berita : Google Drive — yang disimpan hanya ID file-nya (gambarId)
 *  - Cadangan    : localStorage, hanya untuk uji coba di satu browser
 */
(function (global) {
  'use strict';

  var COLLECTION = 'berita';
  var LS_KEY = 'mekarsari_berita_v1';
  var db = null;
  var mode = null;

  /* Dipanggil saat pertama dipakai (bukan saat file dimuat) supaya tidak
     bentrok dengan admin-auth.js yang mungkin sudah memanggil initializeApp. */
  function ensureInit() {
    if (mode) return mode;
    var cfg = global.FIREBASE_CONFIG;
    var fb = global.firebase;
    if (cfg && cfg.projectId && fb && typeof fb.firestore === 'function') {
      try {
        if (!fb.apps.length) fb.initializeApp(cfg);
        db = fb.firestore();
        mode = 'firestore';
        return mode;
      } catch (err) {
        console.error('[NewsStore] Gagal memulai Firebase:', err);
      }
    }
    mode = 'local';
    return mode;
  }

  // Menunggu Firebase Auth selesai memulihkan sesi login (hanya bila SDK auth dimuat).
  function authReady() {
    var fb = global.firebase;
    if (!fb || typeof fb.auth !== 'function') return Promise.resolve();
    return new Promise(function (resolve) {
      var off = fb.auth().onAuthStateChanged(function () { off(); resolve(); });
    });
  }

  /* ---------- Google Drive ---------- */

  // Menerima link berbagi Drive atau ID mentah, mengembalikan ID file ('' jika tidak dikenali).
  function extractDriveId(input) {
    if (!input) return '';
    var s = String(input).trim();
    var m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    return '';
  }

  // URL gambar siap pakai untuk <img>. File harus dibagikan "Siapa saja yang memiliki link".
  function imageUrl(id, width) {
    return id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (width || 1000) : '';
  }

  /* ---------- Helper data ---------- */

  function normalize(id, d) {
    d = d || {};
    var gid = d.gambarId || '';
    return {
      id: id,
      judul: d.judul || '',
      kategori: String(d.kategori || 'kegiatan').toLowerCase(),
      tanggal: d.tanggal || '',
      ringkasan: d.ringkasan || '',
      isi: d.isi || '',
      status: d.status === 'draft' ? 'draft' : 'published',
      gambarId: gid,
      gambar: imageUrl(gid)
    };
  }

  function sortNews(list) {
    return list.sort(function (a, b) {
      return String(b.tanggal).localeCompare(String(a.tanggal));
    });
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; }
  }
  function writeLocal(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  /* ---------- API ---------- */

  // opts.publishedOnly = true untuk halaman publik.
  function getAll(opts) {
    var publishedOnly = !!(opts && opts.publishedOnly);

    if (ensureInit() === 'firestore') {
      var ref = db.collection(COLLECTION);
      if (publishedOnly) ref = ref.where('status', '==', 'published');
      return (publishedOnly ? Promise.resolve() : authReady()).then(function () { return ref.get(); }).then(function (snap) {
        var list = [];
        snap.forEach(function (doc) { list.push(normalize(doc.id, doc.data())); });
        return sortNews(list);
      });
    }

    var list = readLocal().map(function (d) { return normalize(d.id, d); });
    if (publishedOnly) list = list.filter(function (n) { return n.status === 'published'; });
    return Promise.resolve(sortNews(list));
  }

  function getById(id) {
    if (ensureInit() === 'firestore') {
      return db.collection(COLLECTION).doc(String(id)).get().then(function (doc) {
        return doc.exists ? normalize(doc.id, doc.data()) : null;
      });
    }
    var found = readLocal().filter(function (d) { return String(d.id) === String(id); })[0];
    return Promise.resolve(found ? normalize(found.id, found) : null);
  }

  // item.id kosong = berita baru. Mengembalikan Promise berisi id.
  function save(item) {
    var data = {
      judul: item.judul,
      kategori: item.kategori,
      tanggal: item.tanggal,
      ringkasan: item.ringkasan,
      isi: item.isi,
      status: item.status === 'draft' ? 'draft' : 'published',
      gambarId: item.gambarId || ''
    };

    if (ensureInit() === 'firestore') {
      var ts = global.firebase.firestore.FieldValue.serverTimestamp();
      data.updatedAt = ts;
      if (item.id) {
        return authReady().then(function () {
          return db.collection(COLLECTION).doc(String(item.id)).set(data, { merge: true });
        }).then(function () { return item.id; });
      }
      data.createdAt = ts;
      return authReady().then(function () { return db.collection(COLLECTION).add(data); })
        .then(function (ref) { return ref.id; });
    }

    var list = readLocal();
    if (item.id) {
      list = list.map(function (d) { return String(d.id) === String(item.id) ? Object.assign({}, d, data) : d; });
      writeLocal(list);
      return Promise.resolve(item.id);
    }
    data.id = 'n' + Date.now();
    list.push(data);
    writeLocal(list);
    return Promise.resolve(data.id);
  }

  function remove(id) {
    if (ensureInit() === 'firestore') {
      return authReady().then(function () { return db.collection(COLLECTION).doc(String(id)).delete(); });
    }
    writeLocal(readLocal().filter(function (d) { return String(d.id) !== String(id); }));
    return Promise.resolve();
  }

  global.NewsStore = {
    getMode: ensureInit,
    getAll: getAll,
    getById: getById,
    save: save,
    remove: remove,
    extractDriveId: extractDriveId,
    imageUrl: imageUrl
  };
})(window);
