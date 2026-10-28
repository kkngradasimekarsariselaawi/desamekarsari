/* Admin: pengajuan surat (data dari Firestore lewat SubmissionStore), cetak A4, konfirmasi WhatsApp.
 * Muat SETELAH admin-dashboard.js (memakai window.adminData dan SubmissionStore). */
(function () {
  const $ = id => document.getElementById(id);
  const Store = window.SubmissionStore || null;
  
/* ---------- Pengaturan penanda tangan surat ---------- */
const DAFTAR_PENANDA_TANGAN = [
  {
    nama: 'Ajie Nugraha, SST., M.AP.',
    jabatan: 'Kepala Desa Mekarsari'
  },
  {
    nama: 'Haris Nur Kresna, S.AP.',
    jabatan: 'Sekretaris Desa Mekarsari'
  },
  {
    nama: 'Rusdiman, S.Pd., M.AP.',
    jabatan: 'Kepala Seksi Pelayanan Desa Mekarsari'
  }
];

window.pengaturanSurat = {
  namaPenandaTangan: DAFTAR_PENANDA_TANGAN[0].nama,
  jabatan: DAFTAR_PENANDA_TANGAN[0].jabatan
};

const SIGNER_DOC = 'penandaTangan';

function muatPengaturanSurat() {
  if (!window.firebase || !firebase.firestore) {
    return Promise.resolve(window.pengaturanSurat);
  }

  return firebase.firestore()
    .collection('pengaturanSurat')
    .doc(SIGNER_DOC)
    .get()
    .then(doc => {
      if (doc.exists) {
        window.pengaturanSurat = {
          ...window.pengaturanSurat,
          ...doc.data()
        };
      }

      return window.pengaturanSurat;
    })
    .catch(err => {
      console.error('Gagal memuat pengaturan surat:', err);
      return window.pengaturanSurat;
    });
}

function simpanPengaturanSurat(nama, jabatan) {
  if (!Store || Store.getMode() !== 'firestore') {
    return Promise.reject(
      new Error('Firestore belum aktif. Pengaturan tidak disimpan ke cloud.')
    );
  }

  const data = {
    namaPenandaTangan: nama.trim(),
    jabatan: jabatan.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!data.namaPenandaTangan || !data.jabatan) {
    return Promise.reject(
      new Error('Nama dan jabatan wajib diisi.')
    );
  }

  return firebase.firestore()
    .collection('pengaturanSurat')
    .doc(SIGNER_DOC)
    .set(data, { merge: true })
    .then(() => {
      window.pengaturanSurat = {
        namaPenandaTangan: data.namaPenandaTangan,
        jabatan: data.jabatan
      };
    });
}

  const STATUS = ['Diajukan', 'Diperiksa', 'Perlu Perbaikan', 'Disetujui', 'Selesai'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normStatus = s => (!s || s === 'Menunggu Verifikasi') ? 'Diajukan' : s;
  // Data mentah dokumen Firestore (urut terbaru dulu), dikelola admin-dashboard.js
  const load = () => (window.adminData ? window.adminData.getSubmissions().map(s => s.raw) : []);
  const byId = id => load().find(d => d.id === id) || null;
  const today = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const NAMA = { SKTM: 'Surat Keterangan Tidak Mampu (SKTM)', Domisili: 'Surat Keterangan Domisili', Usaha: 'Surat Keterangan Usaha (SKU)', Pengantar: 'Surat Keterangan Tidak Mampu Anak' };

  /* Templat per jenis surat: judul, kode klasifikasi, baris tambahan, paragraf */
  const TPL = {
    SKTM: { judul: 'SURAT KETERANGAN TIDAK MAMPU', kode: '001', rows: [],
      p1: 'Berdasarkan pengantar dari RT/RW setempat dan data yang ada benar bahwa yang bersangkutan Penduduk Desa MEKARSARI Kecamatan SELAAWI dan :',
      p2: '== yang bersangkutan tergolong keluarga yang tidak mampu (berpenghasilan rendah)<br>karena tidak mempunyai penghasilan tetap ==',
      p3: 'Demikian Keterangan ini, untuk dipergunakan sebagai mestinya.'},
    Domisili: { judul: 'SURAT KETERANGAN DOMISILI', kode: '002', rows: [],
      p1: 'Berdasarkan pengantar dari RT/RW setempat dan data yang ada benar bahwa yang bersangkutan Penduduk Desa MEKARSARI Kecamatan SELAAWI dan sepengetahuan kami bahwa yang bersangkutan :',
      p2: '== benar berdomisili di alamat tersebut. == ',
      p3: 'Demikian keterangan ini, untuk dipergunakan sebagaimana mestinya.'  },
    Usaha: { judul: 'SURAT KETERANGAN USAHA', kode: '003', rows: [['Nama Usaha', 'namaUsaha'], ['Bidang Usaha', 'bidangUsaha']],
      p1: 'Berdasarkan pengetahuan kami dan data yang ada benar bahwa yang bersangkutan Penduduk Desa MEKARSARI Kecamatan SELAAWI dan pada saat ini memiliki usaha :',
      p2: '== PENGRAJIN yang berlokasi di : Alamat tersebut di atas == ',
      p3: 'Demikian keterangan ini, untuk dipergunakan sebagaimana mestinya.'  },
    Pengantar: {
    judul: 'SURAT KETERANGAN TIDAK MAMPU ANAK',
    kode: '004',
    rows: [
        ['Nama Anak', 'namaAnak'],
        ['NIK Anak', 'nikAnak'],
        ['Tempat, Tanggal Lahir', 'ttlAnak'],
        ['Jenis Kelamin', 'jenisKelaminAnak'],
        ['Sekolah/Universitas', 'sekolahAnak'],
        ['Kelas/Tingkat', 'kelasAnak']
    ],

    // Pertahankan p1, p2, dan p3 sesuai struktur template yang kamu gunakan.
      p1: 'Orang tersebut di atas benar warga Desa MEKARSARI Kecamatan SELAAWI yang pada saat ini kondisi ekonominya tidak mampu dan termasuk ke dalam kategori keluarga miskin.',
      p2: '',
      p3: 'Demikian keterangan ini, untuk dipergunakan sebagai mestinya.' }
  };



  function formatTanggalIndonesia(tanggal) {
    if (!tanggal) return '-';

    const date = new Date(tanggal + 'T00:00:00');

    if (isNaN(date.getTime())) return tanggal;

    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
  function suratHTML(d) {
    const t = TPL[d.jenisSurat] || TPL.Pengantar, x = d.extra || {}, st = normStatus(d.status);
    const final = st === 'Disetujui' || st === 'Selesai';
    
    
  const dataUmum = d.jenisSurat === 'Pengantar'
    ? [
        ['Nama Lengkap', (d.nama || '').toUpperCase()],
        ['Nomor Induk Kependudukan', d.nik],
        ['Nomor Kartu Keluarga', d.nomorKK],
        [
          'Tempat, Tanggal Lahir',
          `${(d.tempatLahir || '-').toUpperCase()}, ${formatTanggalIndonesia(d.tanggalLahir)}`
        ],
        ['Jenis Kelamin', d.jenisKelamin],
        ['Agama', d.agama],
        ['Pekerjaan', d.pekerjaan],
        ['Status Perkawinan', d.statusKawin],
        ['Alamat', d.alamat]
      ]
    : [
        ['Nama Lengkap', d.nama],
        ['Nomor Induk Kependudukan', d.nik],
        ['Nomor Kartu Keluarga', d.nomorKK],
        [
          'Tempat, Tanggal Lahir',
          `${(d.tempatLahir || '-').toUpperCase()}, ${formatTanggalIndonesia(d.tanggalLahir)}`
        ],
        ['Jenis Kelamin', d.jenisKelamin],
        ['Agama', d.agama],
        ['Pendidikan', d.pendidikan],
        ['Pekerjaan', d.pekerjaan],
        ['Status Perkawinan', d.statusKawin],
        ['Nama Orang Tua', (d.namaOrangTua || '').toUpperCase()],
        ['Alamat', d.alamat]
      ];

  const rows = [
    ...dataUmum,

    ...(d.jenisSurat === 'Pengantar'
      ? [
          // Kalimat pemisah sebelum data anak
          ['adalah benar orang tua/wali dari', ''],

          // Data anak
          ...TPL.Pengantar.rows.map(([label, key]) => [
  label,
  key === 'namaAnak'
    ? ((d.extra || {})[key] || '').toUpperCase()
    : (d.extra || {})[key]
])
        ]
      : (TPL[d.jenisSurat]?.rows || []).map(([label, key]) => [
          label,
          (d.extra || {})[key] || d[key]
        ]))
  ]
    .map((r, i) => {
      const isPemisah =
        d.jenisSurat === 'Pengantar' &&
        r[0] === 'adalah benar orang tua/wali dari';

      if (isPemisah) {
        return `
          <tr>
            <td colspan="3"
                style="padding-top:8px; padding-bottom:5px;">
              ${esc(r[0])}:
            </td>
          </tr>
        `;
      }

      return `
        <tr>
          <td style="width:55mm; white-space:nowrap;">
            ${esc(r[0])}
          </td>
          <td style="width:6mm; text-align:center;">:</td>
          <td>
            ${(i === 0 || r[0] === 'Nama Anak')
  ? `<b>${esc(r[1] || '-')}</b>`
  : esc(r[1] || '-')}
                  </td>
                </tr>
              `;
    })
    .join('');


    const no = final && d.noSurat ? esc(d.noSurat) : '___ / DRAF / MKS / ' + new Date().getFullYear();
    return `<div class="srt-paper">${final ? '' : '<div class="wm">SURAT - BELUM SAH</div>'}
      <div class="kop">
      <img
    class="kop-logo"
    src="../assets/logo.png"
    alt="Logo Desa Mekarsari"
  >

      <div class="kop-teks">
      <h3 style="font-weight: 400">Pemerintah Kabupaten Garut</h3><h3 style="font-weight: 400">Kecamatan Selaawi</h3><h3>Desa Mekarsari</h3><p style="font-style: normal; font-size: 9pt">Kp. Ciloa RT 01/RW 05 Desa Mekarsari Tlp. (0262) Kec.Selaawi – Garut 44187<br>
      Website : mekarsariawi.id email : info@desamekarsari.com Call Center : 0816242175</p></div></div>


      <div class="jdl"><h2>${t.judul}</h2><p>Nomor: ${no}</p></div>
      <p class="isi">Yang bertanda tangan di bawah ini, ${esc(window.pengaturanSurat?.jabatan || 'Kepala Desa Mekarsari')} Kecamatan Selaawi, Kabupaten Garut, menerangkan bahwa:</p>
      <table>${rows}</table><p class="isi">${t.p1}</p><p class="isi" style="text-align: center; font-weight: bold" >${t.p2}</p><p class="isi" style="text-indent:0px">Surat Keterangan ini dipergunakan untuk : ${d.keperluan || '-'}</p><p class="isi">${t.p3}</p>
      <div class="ttd">
        Mekarsari, ${today()}<br>
        ${esc(window.pengaturanSurat?.jabatan || 'Kepala Desa Mekarsari')}
        <div style="height:22mm"></div>
        <b><u>${esc(window.pengaturanSurat?.namaPenandaTangan || 'Nama Kepala Desa')}</u></b>
      </div>`;
  }

  function cetak(d) {
  let a = $('srtPrint');

  if (!a) {
    a = document.createElement('div');
    a.id = 'srtPrint';
    document.body.appendChild(a);
  }

  a.innerHTML = suratHTML(d);

  const old = document.title;

  const namaJenisSurat = {
    SKTM: 'Surat_Keterangan_Tidak_Mampu',
    Domisili: 'Surat_Keterangan_Domisili',
    Usaha: 'Surat_Keterangan_Usaha',
    Pengantar: 'Surat_Keterangan_Tidak_Mampu_Anak'
  };

  const namaPemohon = (d.nama || 'Pemohon')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_');

  document.title =
    `${namaJenisSurat[d.jenisSurat] || 'Surat'}_${namaPemohon}`;

  window.print();

  document.title = old;
}

  
  const waNum = n => {
    n = String(n || '').replace(/\D/g, '');
    return n.startsWith('0')
      ? '62' + n.slice(1)
      : n.startsWith('8')
        ? '62' + n
        : n;
  };

  function waUrl(d, status = 'Disetujui') {
    const n = waNum(d.wa);

    if (n.length < 10) return null;

    let msg;

    if (status === 'Diperiksa') {
      msg = `Yth. ${d.nama},

  Pengajuan ${NAMA[d.jenisSurat] || 'surat'} Anda (No. ${d.id}) sedang dalam tahap pemeriksaan.

  Mohon melengkapi dan mengirimkan dokumen pendukung yang diperlukan melalui WhatsApp ini agar proses pengajuan dapat dilanjutkan.

  Terima kasih atas perhatian dan kerja samanya.
  Pemerintah Desa Mekarsari`;
    } else {
      msg = `Yth. ${d.nama},

  Pengajuan ${NAMA[d.jenisSurat] || 'surat'} Anda (No. ${d.id}) telah *DISETUJUI* dan surat sudah siap.
  Silakan ambil di Kantor Desa Mekarsari (Senin-Kamis 08.00-15.00, Jumat 08.00-11.30 WIB). Bawa KTP asli dan sebutkan nomor pengajuan Anda.

  Terima kasih.
  *Pemerintah Desa Mekarsari*`;
    }

    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  }

  function kirimWA(d, win, status = 'Disetujui') {
    const u = waUrl(d, status);

    if (!u) {
      if (win) win.close();
      return alert('Nomor WhatsApp pemohon belum valid.');
    }

    if (win) {
      win.location.href = u;
    } else {
      window.open(u, '_blank');
    }
  }


  /* ---------- Tabel & statistik (menimpa render lama) ---------- */
  const filt = (l, q, s) => { q = (q || '').toLowerCase(); return l.filter(d => (s === 'all' || !s || normStatus(d.status) === s) && (!q || (d.id + ' ' + d.nama + ' ' + d.jenisSurat).toLowerCase().includes(q))); };
  
const row = d => {
  const s = normStatus(d.status);

  return `
    <tr>
      <td>${esc(d.id)}</td>
      <td>${esc(d.nama)}</td>
      <td>${esc(NAMA[d.jenisSurat] || d.jenisSurat)}</td>
      <td>${esc(d.tanggal)}</td>
      <td>
        <span class="srt-badge s-${s.replace(' ', '').replace('PerluPerbaikan', 'Perbaikan')}">
          ${esc(s)}
        </span>
      </td>
      <td>
        <div class="srt-table-actions">
          <button
            type="button"
            class="srt-btn primary"
            data-srt="detail"
            data-srt-id="${esc(d.id)}">
            <i class="fa-solid fa-eye"></i> Detail
          </button>

          <button
            type="button"
            class="srt-btn"
            data-srt="print"
            data-srt-id="${esc(d.id)}">
            <i class="fa-solid fa-print"></i> Cetak
          </button>

          <button
            type="button"
            class="srt-btn danger"
            data-srt="delete"
            data-srt-id="${esc(d.id)}">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </div>
      </td>
    </tr>
  `;
};

  let obs, rendering = false;
  function render() {
    if (rendering) return; rendering = true;
    const all = load(), c = s => all.filter(d => normStatus(d.status) === s).length;
    const put = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
    const st = window.adminData ? window.adminData.getState() : { state: 'ready', error: '' };
    const msg = st.state === 'loading' ? 'Memuat data dari server...' : st.state === 'error' ? st.error : 'Belum ada pengajuan.';
    const empty = '<tr><td colspan="6" style="text-align:center;padding:20px">' + esc(msg) + '</td></tr>';
    const a = filt(all, $('searchInput') && $('searchInput').value, $('statusFilter') && $('statusFilter').value);
    const b = filt(all, $('searchInputAll') && $('searchInputAll').value, $('statusFilterAll') && $('statusFilterAll').value);
    put('submissionsTableBody', a.slice(0, 10).map(row).join('') || empty);
    put('submissionsAllBody', b.map(row).join('') || empty);
    if ($('submissionsAllCount')) $('submissionsAllCount').textContent = b.length + ' dari ' + all.length + ' pengajuan';
    put('statNewCount', c('Diajukan')); put('statProcessCount', c('Diperiksa')); put('statRevisionCount', c('Perlu Perbaikan')); put('statCompletedCount', c('Disetujui') + c('Selesai'));
    const dg = $('srtDiag');
    if (dg) dg.textContent = all.length + ' pengajuan · sumber: ' + (Store && Store.getMode() === 'firestore' ? 'Database' : 'browser ini (mode uji coba)');
    if (obs) obs.takeRecords(); rendering = false;
  }

  /* ---------- Modal detail ---------- */
  function openDetail(id) {
    const d = byId(id); if (!d) return;
    let ov = $('srtOverlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'srtOverlay'; ov.className = 'srt-overlay'; document.body.appendChild(ov); ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); }); }
    const x = d.extra || {}, t = TPL[d.jenisSurat] || TPL.Pengantar;
    ov.innerHTML = `<div class="srt-modal"><div class="srt-head"><h3>${esc(d.id)}</h3><button class="srt-close" id="srtX">&times;</button></div><div class="srt-cols">
      <div class="srt-info"><p><b>Jenis surat</b>${esc(NAMA[d.jenisSurat] || d.jenisSurat)}</p>
      
      <p><b>Nama Lengkap</b>${esc(d.nama)}</p>
      <p><b>NIK</b>${esc(d.nik)}</p>
      <p><b>Nomor KK</b>${esc(d.nomorKK || '-')}</p>
      <p><b>Tempat Lahir</b>${esc(d.tempatLahir || '-')}</p>
      <p><b>Tanggal Lahir</b>${esc(d.tanggalLahir || '-')}</p>
      <p><b>Jenis Kelamin</b>${esc(d.jenisKelamin || '-')}</p>
      <p><b>Agama</b>${esc(d.agama || '-')}</p>
      <p><b>Pendidikan</b>${esc(d.pendidikan || '-')}</p>
      <p><b>Pekerjaan</b>${esc(d.pekerjaan || '-')}</p>
      <p><b>Status Perkawinan</b>${esc(d.statusKawin || '-')}</p>
      <p><b>Nama Orang Tua</b>${esc(d.namaOrangTua || '-')}</p>
      <p><b>Alamat</b>${esc(d.alamat)}</p>
      <p><b>WhatsApp</b>${esc(d.wa || '-')}</p>

      ${t.rows.map(r => `<p><b>${r[0]}</b>${esc(x[r[1]] || '-')}</p>`).join('')}<p><b>Keperluan</b>${esc(d.keperluan)}</p><p><b>Dokumen</b>${d.dokumen ? esc(d.dokumen.name) : '-'}</p>
      <label><b style="font-size:.72rem;color:#64748b">NOMOR WHATSAPP</b></label><input id="srtWa" value="${esc(d.wa)}" placeholder="08123456789">
      <label><b style="font-size:.72rem;color:#64748b">STATUS</b></label><select id="srtStatus">${STATUS.map(s => `<option ${s === normStatus(d.status) ? 'selected' : ''}>${s}</option>`).join('')}</select>
      
      <div class="srt-actions">
        <button class="srt-btn primary" id="srtEditBtn" type="button">
          Edit Data Pengajuan
        </button>
        <button class="srt-btn primary" id="srtSave">Simpan status</button>
        <button class="srt-btn" id="srtPrintBtn">
          <i class="fa-solid fa-print"></i> Cetak
        </button>
        <button class="srt-btn wa" id="srtWaBtn">
          <i class="fa-brands fa-whatsapp"></i> Kirim WA
        </button>
      </div>

      <div class="srt-note">Saat status diubah ke <b>Disetujui</b>, WhatsApp terbuka otomatis dengan pesan konfirmasi; petugas tinggal menekan Kirim.<br><br>Watermark akan hilang dan nomor surat akan muncul apabila status telah diperbarui menjadi <b>Disetujui</b></div></div>
      <div class="srt-wrap" id="srtPrev">${suratHTML(d)}</div></div></div>`;
    ov.classList.add('open'); $('srtX').onclick = () => ov.classList.remove('open');
    $('srtEditBtn').onclick = () => openEdit(id);
    $('srtSave').onclick = () => {
      const cur = byId(id); if (!cur) return;
      if (!Store) return alert('SubmissionStore belum dimuat.');
      const btn = $('srtSave'), ns = $('srtStatus').value, was = normStatus(cur.status);
      const patch = { wa: $('srtWa').value.trim(), status: ns };
      
if (ns === 'Disetujui' && !cur.noSurat) {
  const k = load().filter(z => z.noSurat).length + 1;

  const bulanRomawi = [
    'I', 'II', 'III', 'IV', 'V', 'VI',
    'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
  ];

  const sekarang = new Date();
  const nomorUrut = String(k).padStart(3, '0');
  const bulan = bulanRomawi[sekarang.getMonth()];
  const tahun = sekarang.getFullYear();

  patch.noSurat =
    `400.10.2.2/2006/${nomorUrut}/${bulan}/Des.${tahun}`;
}

      
const perluKirimWA =
  ['Diperiksa', 'Disetujui'].includes(ns) && ns !== was;

const pre = perluKirimWA
  ? window.open('about:blank', '_blank')
  : null;

btn.disabled = true;

Store.updateStatus('surat', id, patch)
  .then(() =>
    Store.getMode() === 'local' &&
    window.adminData &&
    window.adminData.reload
      ? window.adminData.reload()
      : null
  )
  .then(() => {
    const upd = Object.assign({}, byId(id) || cur, patch);

    $('srtPrev').innerHTML = suratHTML(upd);

    if (perluKirimWA) {
      kirimWA(upd, pre, ns);
    }
  })
  .catch(err => {
    console.error('[admin-surat] simpan gagal:', err);

    if (pre) pre.close();

    // Pertahankan penanganan error yang sudah ada di sini.
  });

      btn.disabled = true;
      Store.updateStatus('surat', id, patch)
        .then(() => (Store.getMode() === 'local' && window.adminData && window.adminData.reload ? window.adminData.reload() : null))
        .then(() => {
          const upd = Object.assign({}, byId(id) || cur, patch);
          $('srtPrev').innerHTML = suratHTML(upd);
          if (perluKirimWA) {
  kirimWA(upd, pre, ns);
}
        })
        .catch(err => {
          console.error('[admin-surat] simpan gagal:', err);
          if (pre) pre.close();
          alert(err && err.code === 'permission-denied'
            ? 'Perubahan ditolak server. Pastikan akun admin terdaftar di koleksi admins.'
            : 'Perubahan gagal disimpan. Coba lagi.');
        })
        .then(() => { btn.disabled = false; });
    };
    $('srtPrintBtn').onclick = () => { const c = byId(id); if (c) cetak(Object.assign({}, c, { wa: $('srtWa').value.trim() })); };
    $('srtWaBtn').onclick = () => { const c = byId(id); if (c) kirimWA(Object.assign({}, c, { wa: $('srtWa').value.trim() })); };
  }


  
/* ---------- Modal edit data pengajuan ---------- */
function openEdit(id) {
  const d = byId(id);
  if (!d) return alert('Data pengajuan tidak ditemukan.');

  let ov = $('srtEditOverlay');

  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'srtEditOverlay';
    ov.className = 'srt-overlay';
    document.body.appendChild(ov);

    ov.addEventListener('click', e => {
      if (e.target === ov) ov.classList.remove('open');
    });
  }

  const fields = [
    ['nama', 'Nama Lengkap'],
    ['nik', 'NIK'],
    ['nomorKK', 'Nomor Kartu Keluarga'],
    ['tempatLahir', 'Tempat Lahir'],
    ['tanggalLahir', 'Tanggal Lahir', 'date'],
    ['jenisKelamin', 'Jenis Kelamin'],
    ['agama', 'Agama'],
    ['pendidikan', 'Pendidikan'],
    ['pekerjaan', 'Pekerjaan'],
    ['statusKawin', 'Status Perkawinan'],
    ['namaOrangTua', 'Nama Orang Tua / Wali'],
    ['alamat', 'Alamat', 'textarea'],
    ['wa', 'Nomor WhatsApp'],
    ['keperluan', 'Keperluan', 'textarea']
  ];

  const tpl = TPL[d.jenisSurat] || TPL.Pengantar;
  const extra = Object.assign({}, d.extra || {});
  const extraKeys = [...new Set(
    tpl.rows.map(r => r[1]).concat(Object.keys(extra))
  )];

  const extraLabels = {
    namaUsaha: 'Nama Usaha',
    bidangUsaha: 'Bidang Usaha',
    tujuan: 'Ditujukan Kepada',
    pekerjaan: 'Pekerjaan',
    agama: 'Agama',
    statusKawin: 'Status Perkawinan',

    namaAnak: 'Nama Lengkap Anak',
    nikAnak: 'NIK Anak (16 Digit)',
    ttlAnak: 'Tempat, Tanggal Lahir Anak',
    jenisKelaminAnak: 'Jenis Kelamin Anak',
    sekolahAnak: 'Nama Sekolah / Universitas',
    kelasAnak: 'Kelas / Tingkat Pendidikan'
  };

  function fieldHTML(key, label, value, type) {
  const val = value == null ? '' : String(value);
  const isNikAnak = key === 'extra.nikAnak';

  const control = type === 'textarea'
    ? `<textarea class="srt-edit-input"
        name="${esc(key)}"
        rows="3">${esc(val)}</textarea>`
    : `<input
        class="srt-edit-input"
        name="${esc(key)}"
        type="${type || 'text'}"
        ${isNikAnak
          ? 'maxlength="16" inputmode="numeric" pattern="[0-9]{16}"'
          : ''}
        value="${esc(val)}">`;

  return `
    <label class="srt-edit-field">
      <span>${esc(label)}</span>
      ${control}
    </label>`;
}

  ov.innerHTML = `
    <div class="srt-modal"
         style="max-width:760px;max-height:90vh;overflow:auto">

      <div class="srt-head">
        <h3>Edit Pengajuan — ${esc(d.id)}</h3>
        <button class="srt-close" id="srtEditX"
                type="button">&times;</button>
      </div>

      <form id="srtEditForm" style="padding:18px">
        <p style="margin:0 0 14px;color:#64748b;font-size:.9rem">
          Periksa kembali data pemohon sebelum menyimpan perubahan.
        </p>

        <div class="srt-edit-grid">
          ${fields.map(f =>
            fieldHTML(f[0], f[1], d[f[0]], f[2])
          ).join('')}

          ${extraKeys.map(k =>
            fieldHTML(
              'extra.' + k,
              extraLabels[k] ||
                k.replace(/([A-Z])/g, ' $1')
                 .replace(/^./, c => c.toUpperCase()),
              extra[k],
              'text'
            )
          ).join('')}
        </div>

        <div class="srt-actions" style="margin-top:18px">
          <button class="srt-btn primary"
                  id="srtEditSave" type="submit">
            Simpan Perubahan
          </button>
          <button class="srt-btn"
                  id="srtEditCancel" type="button">
            Batal
          </button>
        </div>
      </form>
    </div>`;

  ov.classList.add('open');

  // CSS khusus form edit
  if (!$('srtEditStyles')) {
    const style = document.createElement('style');
    style.id = 'srtEditStyles';

    style.textContent = `
      #srtEditOverlay .srt-edit-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 13px;
      }

      #srtEditOverlay .srt-edit-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: .85rem;
        font-weight: 600;
        color: #334155;
        min-width: 0;
      }

      #srtEditOverlay .srt-edit-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 10px 11px;
        font: inherit;
        font-weight: 400;
        color: #0f172a;
        background: #fff;
      }

      #srtEditOverlay .srt-edit-input:focus {
        outline: 2px solid #93c5fd;
        border-color: #3b82f6;
      }

      @media (max-width: 640px) {
        #srtEditOverlay .srt-edit-grid {
          grid-template-columns: 1fr;
        }

        #srtEditOverlay .srt-modal {
          width: calc(100% - 20px) !important;
          margin: 10px auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  $('srtEditX').onclick = $('srtEditCancel').onclick = () => {
    ov.classList.remove('open');
  };

  // Simpan perubahan ke SubmissionStore
  $('srtEditForm').onsubmit = e => {
    e.preventDefault();

    const current = byId(id);
    if (!current) {
      return alert('Data pengajuan sudah tidak ditemukan.');
    }

    if (!Store || typeof Store.updateStatus !== 'function') {
      return alert('SubmissionStore belum mendukung penyimpanan perubahan.');
    }

    const form = $('srtEditForm');
    const patch = {};
    const updatedExtra = Object.assign({}, current.extra || {});

    Array.from(form.querySelectorAll('[name]')).forEach(input => {
      const key = input.name;
      const value = input.value.trim();

      if (key.startsWith('extra.')) {
        updatedExtra[key.slice(6)] = value;
      } else {
        patch[key] = value;
      }
    });

    patch.extra = updatedExtra;

    const saveBtn = $('srtEditSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    Store.updateStatus('surat', id, patch)
      .then(() => {
        if (
          Store.getMode() === 'local' &&
          window.adminData &&
          window.adminData.reload
        ) {
          return window.adminData.reload();
        }
      })
      .then(() => {
        ov.classList.remove('open');

        const detailOverlay = $('srtOverlay');
        if (detailOverlay) {
          detailOverlay.classList.remove('open');
        }

        render();
        openDetail(id);

        alert('Data pengajuan berhasil diperbarui.');
      })
      .catch(err => {
        console.error('[admin-surat] edit gagal:', err);

        alert(
          err && err.code === 'permission-denied'
            ? 'Perubahan ditolak Firestore. Pastikan rules mengizinkan admin memperbarui pengajuan.'
            : 'Data gagal disimpan. Periksa koneksi lalu coba lagi.'
        );

        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan Perubahan';
      });
  };
}

  

function editPenandaTangan() {
  muatPengaturanSurat().then(() => {
    const lama = window.pengaturanSurat;

    const pilihan = DAFTAR_PENANDA_TANGAN.find(
      p => p.nama === lama.namaPenandaTangan
    );

    const opsi = DAFTAR_PENANDA_TANGAN.map((p, i) =>
      `${i + 1}. ${p.nama} — ${p.jabatan}`
    ).join('\n');

    const jawaban = prompt(
      'Pilih penanda tangan dengan memasukkan nomor:\n\n' + opsi,
      pilihan
        ? String(DAFTAR_PENANDA_TANGAN.indexOf(pilihan) + 1)
        : '1'
    );

    if (jawaban === null) return;

    const index = Number(jawaban) - 1;
    const pejabat = DAFTAR_PENANDA_TANGAN[index];

    if (!pejabat) {
      alert('Pilihan tidak valid. Silakan masukkan nomor yang tersedia.');
      return;
    }

    simpanPengaturanSurat(pejabat.nama, pejabat.jabatan)
      .then(() => {
        alert(
          'Penanda tangan berhasil diubah menjadi:\n' +
          pejabat.nama + '\n' + pejabat.jabatan
        );

        const id = $('srtOverlay')?.classList.contains('open')
          ? $('srtOverlay').querySelector('.srt-head h3')?.textContent
          : null;

        if (id) {
          const d = byId(id);
          if (d) {
            $('srtPrev').innerHTML = suratHTML(d);
          }
        }
      })
      .catch(err => {
        console.error(err);
        alert(err.message || 'Gagal menyimpan pengaturan.');
      });
  });
}


  function hapusPengajuan(id, btn) {
    const d = byId(id);
    if (!d) return;
    if (!Store || typeof Store.delete !== 'function') {
      alert('Fitur hapus belum tersedia. Pastikan submission-store.js sudah diperbarui.');
      return;
    }
    const yakin = window.confirm(
      `Hapus permanen pengajuan ${id} atas nama ${d.nama || 'pemohon'}?\n\nData yang dihapus tidak dapat dipulihkan.`
    );
    if (!yakin) return;
    if (btn) btn.disabled = true;
    Store.delete('surat', id)
      .then(() => (Store.getMode() === 'local' && window.adminData && window.adminData.reload
        ? window.adminData.reload()
        : null))
      .then(() => {
        const ov = $('srtOverlay');
        if (ov) ov.classList.remove('open');
        alert('Pengajuan berhasil dihapus.');
        render();
      })
      .catch(err => {
        console.error('[admin-surat] hapus gagal:', err);
        alert(err && err.code === 'permission-denied'
          ? 'Penghapusan ditolak Firestore. Pastikan akun admin sudah login dan rules mengizinkan admin menghapus data.'
          : 'Pengajuan gagal dihapus. Periksa koneksi lalu coba lagi.');
        if (btn) btn.disabled = false;
      });
  }

  function init() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-srt]');
      if (!b) return;
      const id = b.dataset.srtId;
      const d = byId(id);
      if (b.dataset.srt === 'detail') openDetail(id);
      else if (b.dataset.srt === 'print' && d) cetak(d);
      else if (b.dataset.srt === 'delete') hapusPengajuan(id, b);
    });
    ['searchInput', 'statusFilter', 'searchInputAll', 'statusFilterAll'].forEach(id => { const e = $(id); if (e) { e.addEventListener('input', render); e.addEventListener('change', render); } });
    const csv = $('exportCsvBtn'); if (csv) { const n = csv.cloneNode(true); csv.replaceWith(n); n.addEventListener('click', () => {
      const h = ['No', 'Nama', 'NIK', 'Jenis', 'WhatsApp', 'Status', 'Tanggal'], r = load().map(d => [d.id, d.nama, "'" + d.nik, d.jenisSurat, d.wa || '', normStatus(d.status), d.tanggal]);
      const txt = [h].concat(r).map(a => a.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' })); a.download = 'pengajuan-surat.csv'; a.click(); }); }
    obs = new MutationObserver(() => render());   /* timpa bila admin-dashboard.js merender ulang data lama */
    ['submissionsTableBody', 'submissionsAllBody', 'statNewCount', 'statProcessCount', 'statRevisionCount', 'statCompletedCount'].forEach(id => { const e = $(id); if (e) obs.observe(e, { childList: true, characterData: true, subtree: true }); });
    document.addEventListener('admin:data', render); render();
    const host = document.querySelector('#view-pengajuan .section-card');
    if (host) { const n = document.createElement('p'); n.id = 'srtDiag'; n.style.cssText = 'font-size:.8rem;color:#64748b;margin:0 0 10px';
      host.insertBefore(n, host.querySelector('.filter-bar')); render(); }
    
    
    
const hostPengaturan = document.querySelector(
  '#view-pengajuan .section-header'
);

if (hostPengaturan && !$('btnPenandaTangan')) {
  const btn = document.createElement('button');

  btn.id = 'btnPenandaTangan';
  btn.type = 'button';
  btn.className = 'btn-secondary-admin';
  btn.innerHTML =
    '<i class="fa-solid fa-signature"></i> Pengaturan Penanda Tangan';

  btn.addEventListener('click', editPenandaTangan);

  const exportBtn = $('exportCsvBtn');

  if (exportBtn) {
    exportBtn.insertAdjacentElement('beforebegin', btn);
  } else {
    hostPengaturan.appendChild(btn);
  }
}


muatPengaturanSurat();

    console.info('[admin-surat] aktif, sumber data:', Store ? Store.getMode() : 'tidak ada');
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
