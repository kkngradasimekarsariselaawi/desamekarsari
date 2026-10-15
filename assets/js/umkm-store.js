/**
 * UMKM STORE — koleksi Firestore "umkm"
 * Dipakai bersama oleh:
 *   - halaman publik  : umkm.html            (hanya membaca UMKM berstatus "Aktif")
 *   - panel admin     : admin-umkm.js        (tambah, ubah, aktif/nonaktif, hapus)
 *
 * Jika Firebase belum aktif, modul otomatis memakai localStorage (mode uji coba).
 * Harus dimuat setelah firebase-app-compat, firebase-firestore-compat, dan firebase-config.js.
 */
(function () {
  'use strict';

  const COLLECTION = 'umkm';
  const LOCAL_KEY = 'mekarsari_umkm_local_v1';
  const CATEGORIES = ['Anyaman', 'Kerajinan Rumah', 'Peralatan', 'Aksesoris'];
  const STATUSES = ['Aktif', 'Nonaktif'];
  const FIELDS = ['nama', 'kategori', 'pemilik', 'telepon', 'alamat', 'hargaRentang', 'ringkasan', 'deskripsi', 'foto', 'status'];

  /* ---------- Data contoh (dipindah dari umkm.html) ---------- */
  const SEED = [
    {
      nama: 'Anyaman Jaya', kategori: 'Anyaman', pemilik: 'Bpk. H. Jaelani',
      ringkasan: 'Kerajinan tas bambu, boboko, & tempat bumbu khas Garut',
      alamat: 'Kp. Mekarsari, RT 02/RW 03', telepon: '081223406789', hargaRentang: 'Rp 25.000 - Rp 150.000',
      foto: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Usaha rumahan Anyaman Jaya memproduksi berbagai macam tas rajutan bambu halus dan perlengkapan rumah tangga tradisional dengan ketahanan tinggi.'
    },
    {
      nama: 'Bambu Lestari', kategori: 'Kerajinan Rumah', pemilik: 'Ibu Imas Masitoh',
      ringkasan: 'Kerajinan kap lampu hias & tampah bambu eksklusif',
      alamat: 'Kp. Ciboitu, RT 01/RW 05', telepon: '081234567890', hargaRentang: 'Rp 45.000 - Rp 350.000',
      foto: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Spesialisasi kap lampu dekoratif resto dan hotel bermaterialkan bambu tali asli Selaawi Garut.'
    },
    {
      nama: 'Sari Bambu', kategori: 'Peralatan', pemilik: 'Bpk. Cecep Nurjaman',
      ringkasan: 'Kerajinan tempat buah, baki saji & tudung saji',
      alamat: 'Kp. Mekarsari, RT 04/RW 01', telepon: '085788012345', hargaRentang: 'Rp 15.000 - Rp 85.000',
      foto: 'https://images.unsplash.com/photo-1615865417491-9941019fbc00?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Produsen peralatan dapur berbahan bambu ramah lingkungan, diolah anti jamur dan rayap secara alami.'
    },
    {
      nama: 'Mekar Anyam', kategori: 'Anyaman', pemilik: 'Ibu Eni Sugiarti',
      ringkasan: 'Kerajinan besek parcel & wadah anyaman souvenir',
      alamat: 'Kp. Sukahening, RT 03/RW 02', telepon: '081345670801', hargaRentang: 'Rp 5.000 - Rp 50.000',
      foto: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Penyedia wadah anyaman bambu grosir untuk kebutuhan haatan, besek hampers, dan souvenir pernikahan.'
    },
    {
      nama: 'Bambu Kreatif', kategori: 'Kerajinan Rumah', pemilik: 'Kang Dedi Kurnia',
      ringkasan: 'Kerajinan hiasan dinding & kaligrafi serat bambu',
      alamat: 'Kp. Ciboitu, RT 02/RW 05', telepon: '082253449586', hargaRentang: 'Rp 75.000 - Rp 500.000',
      foto: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Kreasi seni ukir dan hiasan dinding etnik Sunda dari bahan dasar bambu tua bertekstur unik.'
    },
    {
      nama: 'Karya Bambu', kategori: 'Aksesoris', pemilik: 'Bpk. Agus Rahmat',
      ringkasan: 'Kerajinan miniatur Saung, Gazebo & gantungan kunci',
      alamat: 'Kp. Mekarsari, RT 01/RW 02', telepon: '085677889900', hargaRentang: 'Rp 10.000 - Rp 250.000',
      foto: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Spesialis miniatur arsitektur bambu Sunda dan ragam aksesoris unik kerajinan tangan.'
    },
    {
      nama: 'Bambu Indah Selaawi', kategori: 'Peralatan', pemilik: 'Ibu Siti Nurhaliza',
      ringkasan: 'Sedotan bambu ramah lingkungan & tempat sendok',
      alamat: 'Kp. Sukahening, RT 01/RW 02', telepon: '082119882341', hargaRentang: 'Rp 3.000 - Rp 35.000',
      foto: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Pelopor alat makan ramah lingkungan berbahan bambu halus tersertifikasi untuk kafe & restoran.'
    },
    {
      nama: 'Sangkar Bambu Mekar', kategori: 'Kerajinan Rumah', pemilik: 'Mang Ujang Bambu',
      ringkasan: 'Sangkar burung ukir bambu khas Selaawi Garut',
      alamat: 'Kp. Ciboitu, RT 04/RW 05', telepon: '081299881122', hargaRentang: 'Rp 120.000 - Rp 850.000',
      foto: 'https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?auto=format&fit=crop&q=80&w=600',
      deskripsi: 'Sangkar burung kualitas kontes buatan tangan pengrajin berpengalaman lebih dari 15 tahun.'
    }
  ].map((u) => Object.assign({ status: 'Aktif' }, u));

  /* ---------- Inisialisasi Firebase (Firestore) ---------- */
  let db = null;
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      if (!firebase.apps.length) {
        // Jika firebase-config.js belum memanggil initializeApp, coba pakai objek config global
        const cfg = window.firebaseConfig || window.FIREBASE_CONFIG;
        if (cfg && cfg.projectId && !/YOUR|ISI|XXXX/i.test(String(cfg.projectId) + String(cfg.apiKey))) {
          firebase.initializeApp(cfg);
        }
      }
      if (firebase.apps.length) db = firebase.firestore();
    }
  } catch (e) {
    console.warn('[UmkmStore] Firebase tidak aktif, memakai mode uji coba (localStorage):', e);
    db = null;
  }
  const getMode = () => (db ? 'firestore' : 'local');

  /* ---------- Utilitas ---------- */
  const byNewest = (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0);
  const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');

  // 08123456789 / 8123456789 / +62 812-3456-789  ->  628123456789
  function waNumber(tel) {
    let d = digits(tel);
    if (d.indexOf('0') === 0) d = '62' + d.slice(1);
    else if (d.indexOf('8') === 0) d = '62' + d;
    return d;
  }
  const isValidWa = (tel) => /^62\d{8,13}$/.test(waNumber(tel));

  // Link Google Drive -> URL gambar langsung; URL lain dipakai apa adanya (hanya http/https)
  function photoUrl(url) {
    const u = String(url == null ? '' : url).trim();
    if (!/^https?:\/\//i.test(u)) return '';
    const m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
      u.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w800' : u;
  }

  // Gambar pengganti (SVG inline) bila foto kosong atau gagal dimuat
  function placeholder(nama) {
    const t = String(nama || 'UMKM').slice(0, 26).replace(/[<>&"']/g, '');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">' +
      '<rect width="600" height="400" fill="#245a3a"/>' +
      '<text x="300" y="210" font-family="sans-serif" font-size="32" fill="#ffffff" text-anchor="middle">' + t + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function clean(data) {
    const out = {};
    FIELDS.forEach((k) => { out[k] = String(data && data[k] != null ? data[k] : '').trim(); });
    return out;
  }

  /* ---------- Mode uji coba (localStorage) ---------- */
  const listeners = [];
  const localRead = () => {
    try { const r = localStorage.getItem(LOCAL_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  };
  const localWrite = (list) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    listeners.slice().forEach((fn) => fn());
  };
  function localTx(fn) {
    return new Promise((resolve, reject) => {
      try {
        const list = localRead() || [];
        const result = fn(list);
        localWrite(list);
        resolve(result);
      } catch (e) { reject(e); }
    });
  }
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_KEY) listeners.slice().forEach((fn) => fn());
  });

  /* ---------- API ---------- */

  /**
   * Langganan data realtime.
   * opts.onlyActive = true  -> hanya UMKM berstatus "Aktif" (untuk halaman publik)
   * onData(list, meta)      -> meta.demo = true bila yang tampil data contoh (mode uji coba, belum ada data)
   * Mengembalikan fungsi untuk berhenti berlangganan.
   */
  function subscribe(opts, onData, onError) {
    const onlyActive = !!(opts && opts.onlyActive);

    if (db) {
      let q = db.collection(COLLECTION);
      if (onlyActive) q = q.where('status', '==', 'Aktif'); // wajib ada agar lolos aturan Firestore untuk pengunjung
      return q.onSnapshot(
        (snap) => onData(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort(byNewest), { demo: false }),
        (err) => { console.error('[UmkmStore] gagal membaca data:', err); if (onError) onError(err); }
      );
    }

    const push = () => {
      const stored = localRead();
      const demo = stored === null && onlyActive;
      let list = stored !== null
        ? stored
        : (demo ? SEED.map((u, i) => Object.assign({ id: 'demo-' + (i + 1), createdAtMs: Date.now() - i }, u)) : []);
      if (onlyActive) list = list.filter((u) => u.status === 'Aktif');
      onData(list.slice().sort(byNewest), { demo });
    };
    listeners.push(push);
    setTimeout(push, 0);
    return () => { const i = listeners.indexOf(push); if (i > -1) listeners.splice(i, 1); };
  }

  // Tambah (id = null) atau ubah (id terisi). Mengembalikan Promise<id>
  function save(id, data) {
    const now = Date.now();
    const doc = clean(data);
    if (db) {
      const col = db.collection(COLLECTION);
      if (id) return col.doc(id).update(Object.assign(doc, { updatedAtMs: now })).then(() => id);
      const ref = col.doc();
      return ref.set(Object.assign(doc, { createdAtMs: now, updatedAtMs: now })).then(() => ref.id);
    }
    return localTx((list) => {
      if (id) {
        const i = list.findIndex((u) => u.id === id);
        if (i < 0) throw new Error('Data tidak ditemukan');
        list[i] = Object.assign(list[i], doc, { updatedAtMs: now });
        return id;
      }
      const nid = 'local-' + now.toString(36) + Math.random().toString(36).slice(2, 6);
      list.push(Object.assign({ id: nid, createdAtMs: now, updatedAtMs: now }, doc));
      return nid;
    });
  }

  function setStatus(id, status) {
    if (STATUSES.indexOf(status) < 0) return Promise.reject(new Error('Status tidak valid'));
    const now = Date.now();
    if (db) return db.collection(COLLECTION).doc(id).update({ status, updatedAtMs: now });
    return localTx((list) => {
      const item = list.find((u) => u.id === id);
      if (!item) throw new Error('Data tidak ditemukan');
      item.status = status;
      item.updatedAtMs = now;
    });
  }

  function remove(id) {
    if (db) return db.collection(COLLECTION).doc(id).delete();
    return localTx((list) => {
      const i = list.findIndex((u) => u.id === id);
      if (i > -1) list.splice(i, 1);
    });
  }

  // Impor 8 data contoh (untuk admin saat koleksi masih kosong). Mengembalikan Promise<jumlah>
  function seed() {
    const now = Date.now();
    if (db) {
      const batch = db.batch();
      SEED.forEach((u, i) => {
        batch.set(db.collection(COLLECTION).doc(), Object.assign(clean(u), { createdAtMs: now - i, updatedAtMs: now }));
      });
      return batch.commit().then(() => SEED.length);
    }
    return localTx((list) => {
      SEED.forEach((u, i) => {
        list.push(Object.assign({ id: 'local-seed-' + (i + 1), createdAtMs: now - i, updatedAtMs: now }, clean(u)));
      });
      return SEED.length;
    });
  }

  window.UmkmStore = {
    COLLECTION, CATEGORIES, STATUSES,
    getMode, subscribe, save, setStatus, remove, seed,
    waNumber, isValidWa, photoUrl, placeholder
  };
})();
