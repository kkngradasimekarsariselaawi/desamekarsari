/* SubmissionStore: penyimpanan pengajuan surat & pengaduan.
 * Pola sama dengan NewsStore: Firestore bila FIREBASE_CONFIG.projectId terisi,
 * jika tidak, localStorage (hanya uji coba; memakai key lama agar dashboard lama tetap jalan).
 * Dipakai oleh layanan.html (add) dan dashboard admin (getAll / subscribe / updateStatus). */
(function () {
  var KEYS = { surat: 'mekarsari_pengajuan_surat', pengaduan: 'mekarsari_pengaduan_warga' };
  var COLS = { surat: 'pengajuanSurat', pengaduan: 'pengaduan' };
  var db = null, mode = 'local';

  try {
    var cfg = window.FIREBASE_CONFIG;
    if (cfg && cfg.projectId && window.firebase && firebase.firestore) {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      if (window.APPCHECK_SITE_KEY && firebase.appCheck) {
        firebase.appCheck().activate(window.APPCHECK_SITE_KEY, true);
      }
      db = firebase.firestore();
      mode = 'firestore';
    }
  } catch (err) { console.error('[SubmissionStore] init gagal:', err); db = null; mode = 'local'; }

  function checkType(type) {
    if (!COLS[type]) throw new Error('Tipe tidak dikenal: ' + type);
  }
  function readLocal(type) {
    try { return JSON.parse(localStorage.getItem(KEYS[type]) || '[]'); } catch (e) { return []; }
  }
  function writeLocal(type, list) { localStorage.setItem(KEYS[type], JSON.stringify(list)); }
  function normalize(doc) {
    var d = doc.data(); d.id = d.id || doc.id;
    if (d.createdAt && d.createdAt.toDate) { d.createdAtMs = d.createdAt.toDate().getTime(); d.createdAt = d.createdAt.toDate().toISOString(); }
    return d;
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { var e = new Error('timeout'); e.code = 'timeout'; rej(e); }, ms);
    })]);
  }

  window.SubmissionStore = {
    getMode: function () { return mode; },

    // Warga: kirim data baru (rules hanya mengizinkan create)
    add: function (type, data) {
      checkType(type);
      if (mode === 'local') {
        var list = readLocal(type); list.unshift(data); writeLocal(type, list);
        return Promise.resolve(data);
      }
      var ref = db.collection(COLS[type]).doc(data.id);
      var doc = Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      // Transaksi tidak diantrekan saat offline -> mencegah kiriman ganda
      return withTimeout(db.runTransaction(function (tx) { tx.set(ref, doc); return Promise.resolve(); }), 15000)
        .then(function () { return data; });
    },

    // Admin: ambil semua (terbaru dulu). Butuh login admin di mode firestore.
    getAll: function (type) {
      checkType(type);
      if (mode === 'local') return Promise.resolve(readLocal(type));
      return db.collection(COLS[type]).orderBy('createdAt', 'desc').get()
        .then(function (snap) { return snap.docs.map(normalize); });
    },

    // Admin: tampilan realtime. Mengembalikan fungsi unsubscribe.
    subscribe: function (type, onData, onError) {
      checkType(type);
      if (mode === 'local') { onData(readLocal(type)); return function () {}; }
      return db.collection(COLS[type]).orderBy('createdAt', 'desc').onSnapshot(
        function (snap) { onData(snap.docs.map(normalize)); },
        function (err) { console.error('[SubmissionStore]', err); if (onError) onError(err); });
    },

    // Admin: ubah status / catatan, mis. updateStatus('surat', id, {status:'Diperiksa'})
    updateStatus: function (type, id, patch) {
      checkType(type);
      if (mode === 'local') {
        var list = readLocal(type).map(function (x) { return x.id === id ? Object.assign({}, x, patch) : x; });
        writeLocal(type, list); return Promise.resolve();
      }
      var upd = Object.assign({}, patch, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return db.collection(COLS[type]).doc(id).update(upd);
    },

    // Admin: hapus permanen satu data pengajuan/pengaduan.
    // Firestore rules tetap harus membatasi operasi ini untuk admin terautentikasi.
    delete: function (type, id) {
      checkType(type);
      if (!id) return Promise.reject(new Error('ID data tidak valid.'));
      if (mode === 'local') {
        var list = readLocal(type).filter(function (x) { return x.id !== id; });
        writeLocal(type, list);
        return Promise.resolve();
      }
      return db.collection(COLS[type]).doc(id).delete();
    }
  };
})();
