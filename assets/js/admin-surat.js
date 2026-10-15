/* Admin: pengajuan surat (data dari Firestore lewat SubmissionStore), cetak A4, konfirmasi WhatsApp.
 * Muat SETELAH admin-dashboard.js (memakai window.adminData dan SubmissionStore). */
(function () {
  const $ = id => document.getElementById(id);
  const Store = window.SubmissionStore || null;
  const STATUS = ['Diajukan', 'Diperiksa', 'Perlu Perbaikan', 'Disetujui', 'Selesai'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normStatus = s => (!s || s === 'Menunggu Verifikasi') ? 'Diajukan' : s;
  // Data mentah dokumen Firestore (urut terbaru dulu), dikelola admin-dashboard.js
  const load = () => (window.adminData ? window.adminData.getSubmissions().map(s => s.raw) : []);
  const byId = id => load().find(d => d.id === id) || null;
  const today = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const NAMA = { SKTM: 'Surat Keterangan Tidak Mampu (SKTM)', Domisili: 'Surat Keterangan Domisili', Usaha: 'Surat Keterangan Usaha (SKU)', Pengantar: 'Surat Pengantar Umum' };

  /* Templat per jenis surat: judul, kode klasifikasi, baris tambahan, paragraf */
  const TPL = {
    SKTM: { judul: 'SURAT KETERANGAN TIDAK MAMPU', kode: '001', rows: [['Pekerjaan', 'pekerjaan']],
      p1: 'Berdasarkan keterangan dan hasil verifikasi data administrasi desa, nama tersebut di atas adalah benar warga Desa Mekarsari dan saat ini tergolong dalam keluarga kurang mampu (ekonomi lemah).',
      p2: 'Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.' },
    Domisili: { judul: 'SURAT KETERANGAN DOMISILI', kode: '002', rows: [['Agama', 'agama'], ['Status Perkawinan', 'statusKawin']],
      p1: 'Berdasarkan pendataan kependudukan Desa Mekarsari, nama tersebut di atas benar-benar berdomisili dan tinggal di alamat tersebut di wilayah Desa Mekarsari, Kecamatan Selaawi, Kabupaten Garut.',
      p2: 'Demikian surat keterangan domisili ini dibuat untuk dipergunakan sebagaimana mestinya.' },
    Usaha: { judul: 'SURAT KETERANGAN USAHA', kode: '003', rows: [['Nama Usaha', 'namaUsaha'], ['Bidang Usaha', 'bidangUsaha']],
      p1: 'Berdasarkan pengamatan dan data di lapangan, nama tersebut di atas benar memiliki dan menjalankan usaha tersebut yang berlokasi di wilayah Desa Mekarsari, Kecamatan Selaawi.',
      p2: 'Demikian surat keterangan usaha ini dibuat agar dapat dipergunakan sebagai kelengkapan administrasi.' },
    Pengantar: { judul: 'SURAT PENGANTAR', kode: '004', rows: [['Ditujukan kepada', 'tujuan']],
      p1: 'Orang tersebut di atas adalah benar warga Desa Mekarsari dan bermaksud mengurus keperluan sebagaimana tersebut di atas. Mohon bantuan dan kebijaksanaan Bapak/Ibu untuk dapat membantu seperlunya.',
      p2: 'Demikian surat pengantar ini dibuat untuk dipergunakan sebagaimana mestinya.' }
  };

  function suratHTML(d) {
    const t = TPL[d.jenisSurat] || TPL.Pengantar, x = d.extra || {}, st = normStatus(d.status);
    const final = st === 'Disetujui' || st === 'Selesai';
    const rows = [['Nama', d.nama], ['NIK', d.nik], ['Alamat', d.alamat]]
      .concat(t.rows.map(r => [r[0], x[r[1]] || '-'])).concat([['Keperluan', d.keperluan]])
      .map(r => `<tr><td style="width:42mm">${esc(r[0])}</td><td>:</td><td><b>${esc(r[1])}</b></td></tr>`).join('');
    const no = final && d.noSurat ? esc(d.noSurat) : '___ / DRAF / MKS / ' + new Date().getFullYear();
    return `<div class="srt-paper">${final ? '' : '<div class="wm">DRAF - BELUM SAH</div>'}
      <div class="kop"><h4>Pemerintah Kabupaten Garut</h4><h5>Kecamatan Selaawi</h5><h3>Pemerintah Desa Mekarsari</h3><p>Jl. Raya Mekarsari No. 01, Selaawi, Garut, Jawa Barat 44187</p></div>
      <div class="jdl"><h2>${t.judul}</h2><p>Nomor: ${no}</p></div>
      <p class="isi" style="text-indent:0">Yang bertanda tangan di bawah ini, Kepala Desa Mekarsari, Kecamatan Selaawi, Kabupaten Garut, menerangkan bahwa:</p>
      <table>${rows}</table><p class="isi">${t.p1}</p><p class="isi">${t.p2}</p>
      <div class="ttd">Garut, ${today()}<br><b>Kepala Desa Mekarsari</b><div style="height:22mm"></div><b><u>Ajie Nugraha, SST., M.AP.</u></b></div></div>`;
  }

  function cetak(d) {
    let a = $('srtPrint'); if (!a) { a = document.createElement('div'); a.id = 'srtPrint'; document.body.appendChild(a); }
    a.innerHTML = suratHTML(d); const old = document.title; document.title = 'Surat_' + d.jenisSurat + '_' + d.nama.replace(/\s+/g, '_');
    window.print(); document.title = old;
  }

  const waNum = n => { n = String(n || '').replace(/\D/g, ''); return n.startsWith('0') ? '62' + n.slice(1) : n.startsWith('8') ? '62' + n : n; };
  function waUrl(d) {
    const n = waNum(d.wa); if (n.length < 10) return null;
    const msg = `Yth. ${d.nama},\n\nPengajuan ${NAMA[d.jenisSurat] || 'surat'} Anda (No. ${d.id}) telah *DISETUJUI* dan surat sudah siap.\nSilakan ambil di Kantor Desa Mekarsari (Senin-Kamis 08.00-15.00, Jumat 08.00-11.30 WIB). Bawa KTP asli dan sebutkan nomor pengajuan Anda.\n\nTerima kasih.\n*Pemerintah Desa Mekarsari*`;
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  }
  /* win = jendela kosong yang dibuka lebih dulu (saat klik) agar tidak diblokir popup-blocker setelah proses simpan */
  function kirimWA(d, win) {
    const u = waUrl(d);
    if (!u) { if (win) win.close(); return alert('Nomor WhatsApp pemohon belum valid.'); }
    if (win) win.location.href = u; else window.open(u, '_blank');
  }

  /* ---------- Tabel & statistik (menimpa render lama) ---------- */
  const filt = (l, q, s) => { q = (q || '').toLowerCase(); return l.filter(d => (s === 'all' || !s || normStatus(d.status) === s) && (!q || (d.id + ' ' + d.nama + ' ' + d.jenisSurat).toLowerCase().includes(q))); };
  const row = d => { const s = normStatus(d.status);
    return `<tr><td>${esc(d.id)}</td><td>${esc(d.nama)}</td><td>${esc(NAMA[d.jenisSurat] || d.jenisSurat)}</td><td>${esc(d.tanggal)}</td><td><span class="srt-badge s-${s.replace(' ', '').replace('PerluPerbaikan', 'Perbaikan')}">${s}</span></td>
    <td><button type="button" class="srt-btn primary" data-srt="detail" data-srt-id="${esc(d.id)}">Detail</button>
    <button type="button" class="srt-btn" data-srt="print" data-srt-id="${esc(d.id)}"><i class="fa-solid fa-print"></i> Cetak</button>
    <button type="button" class="srt-btn danger" data-srt="delete" data-srt-id="${esc(d.id)}"><i class="fa-solid fa-trash"></i> Hapus</button></td></tr>`; };
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
      <div class="srt-info"><p><b>Jenis surat</b>${esc(NAMA[d.jenisSurat] || d.jenisSurat)}</p><p><b>Pemohon / NIK</b>${esc(d.nama)} / ${esc(d.nik)}</p><p><b>Alamat</b>${esc(d.alamat)}</p>
      ${t.rows.map(r => `<p><b>${r[0]}</b>${esc(x[r[1]] || '-')}</p>`).join('')}<p><b>Keperluan</b>${esc(d.keperluan)}</p><p><b>Dokumen</b>${d.dokumen ? esc(d.dokumen.name) : '-'}</p>
      <label><b style="font-size:.72rem;color:#64748b">NOMOR WHATSAPP</b></label><input id="srtWa" value="${esc(d.wa)}" placeholder="08123456789">
      <label><b style="font-size:.72rem;color:#64748b">STATUS</b></label><select id="srtStatus">${STATUS.map(s => `<option ${s === normStatus(d.status) ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <div class="srt-actions"><button class="srt-btn primary" id="srtSave">Simpan status</button><button class="srt-btn" id="srtPrintBtn"><i class="fa-solid fa-print"></i> Cetak A4</button><button class="srt-btn wa" id="srtWaBtn"><i class="fa-brands fa-whatsapp"></i> Kirim WA</button></div>
      <div class="srt-note">Saat status diubah ke <b>Disetujui</b>, WhatsApp terbuka otomatis dengan pesan konfirmasi; petugas tinggal menekan Kirim.</div></div>
      <div class="srt-wrap" id="srtPrev">${suratHTML(d)}</div></div></div>`;
    ov.classList.add('open'); $('srtX').onclick = () => ov.classList.remove('open');
    $('srtSave').onclick = () => {
      const cur = byId(id); if (!cur) return;
      if (!Store) return alert('SubmissionStore belum dimuat.');
      const btn = $('srtSave'), ns = $('srtStatus').value, was = normStatus(cur.status);
      const patch = { wa: $('srtWa').value.trim(), status: ns };
      if (ns === 'Disetujui' && !cur.noSurat) {
        const k = load().filter(z => z.noSurat).length + 1;
        patch.noSurat = `${(TPL[cur.jenisSurat] || TPL.Pengantar).kode} / ${String(k).padStart(3, '0')} / MKS / ${new Date().getMonth() + 1} / ${new Date().getFullYear()}`;
      }
      const firstApprove = ns === 'Disetujui' && was !== 'Disetujui';
      const pre = firstApprove ? window.open('about:blank', '_blank') : null;
      btn.disabled = true;
      Store.updateStatus('surat', id, patch)
        .then(() => (Store.getMode() === 'local' && window.adminData && window.adminData.reload ? window.adminData.reload() : null))
        .then(() => {
          const upd = Object.assign({}, byId(id) || cur, patch);
          $('srtPrev').innerHTML = suratHTML(upd);
          if (firstApprove) kirimWA(upd, pre);
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
    console.info('[admin-surat] aktif, sumber data:', Store ? Store.getMode() : 'tidak ada');
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
