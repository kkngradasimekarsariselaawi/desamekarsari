/* ============================================================
   Peta Lokasi Desa Mekarsari — peta-lokasi.js
   Vanilla JS. Peta berupa gambar ilustrasi dengan area klik (tanpa koordinat, tautan peta, zoom, atau geser).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. DATA WILAYAH (resmi, jangan diubah) ---------- */
  const DUSUN = [
    { id: 1, nama: 'Dusun I',   posisi: 'Wilayah Barat',  rentang: 'RW 01 – 03', rw: [
      { no: '01', kampung: 'Kp. Lame' }, { no: '02', kampung: 'Kp. Lame' }, { no: '03', kampung: 'Kp. Karapiak' } ] },
    { id: 2, nama: 'Dusun II',  posisi: 'Wilayah Tengah', rentang: 'RW 04 – 06', rw: [
      { no: '04', kampung: 'Kp. Ciloa' }, { no: '05', kampung: 'Kp. Ciloa Simpang' }, { no: '06', kampung: 'Kp. Pacarbadak' } ] },
    { id: 3, nama: 'Dusun III', posisi: 'Wilayah Timur',  rentang: 'RW 07 – 09', rw: [
      { no: '07', kampung: 'Kp. Nagrak dan Kp. Citengul' }, { no: '08', kampung: 'Kp. Bojong' },
      { no: '09', kampung: 'Kp. Cikendi dan Kp. Jatitugu' } ] }
  ];

  /* ---------- STATE & ELEMEN ---------- */
  const state = { selected: null, query: '', filter: 'all' };
  const $ = (s) => document.querySelector(s);
  const el = {
    cards: $('#cards'), detail: $('#detailPanel'), results: $('#searchResults'),
    status: $('#statusBar'), search: $('#searchInput'), filter: $('#filterDusun'),
    reset: $('#btnReset'), noResult: $('#noResult'),
    buttons: document.querySelectorAll('.dusun-btn')
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).toLowerCase().trim();

  /* ---------- 2. PETA (gambar ilustrasi + area klik) ----------
     Gambar: assets/peta-desa.jpg (1671 x 941 px). Area klik di bawah adalah ilustrasi
     yang dicocokkan secara kasar dengan gambar, BUKAN batas resmi. Tidak ada koordinat
     atau tautan peta. Jika gambar diganti, sesuaikan titik poligon (x,y dalam piksel gambar). */
  const COLORS = { 1: '#15803D', 2: '#dc2626', 3: '#7c3aed' };
  const mapEl = document.getElementById('map');
  const IMG_W = 1671, IMG_H = 941;
  const HOTSPOTS = {
    1: '175,555 210,520 300,470 360,420 400,365 450,320 520,290 575,250 600,262 635,290 650,345 662,365 660,440 630,440 690,500 698,545 685,585 640,590 600,605 570,590 540,575 500,590 470,602 430,585 380,590 300,585 250,600 200,585',
    2: '668,290 700,255 760,230 800,208 835,215 845,260 880,290 905,310 945,315 950,350 990,385 985,420 1000,455 1040,500 1055,560 1050,600 1020,575 1000,550 960,560 900,570 830,605 790,580 750,575 720,575 685,585 698,545 690,500 630,440 660,440 662,365 650,345 668,330',
    3: '945,315 990,235 1015,215 1050,235 1100,250 1135,275 1150,305 1185,350 1200,390 1250,415 1330,425 1355,450 1360,495 1400,520 1450,525 1500,545 1525,575 1500,620 1490,665 1480,725 1465,745 1430,735 1400,700 1365,665 1320,680 1280,720 1245,750 1200,745 1160,750 1130,720 1100,690 1090,660 1050,610 1055,560 1040,500 1000,455 985,420 990,385 950,350'
  };

  function buildMap() {
    const polys = DUSUN.map((d) =>
      `<polygon class="hot" data-dusun="${d.id}" points="${HOTSPOTS[d.id]}" tabindex="0" role="button" aria-label="${d.nama}, ${d.posisi}, ${d.rentang}"/>`).join('');
    mapEl.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${IMG_W} ${IMG_H}" focusable="false">${polys}</svg>`);
  }

  function initMap() {
    buildMap();
    mapEl.addEventListener('click', (e) => {
      const z = e.target.closest('.hot'); if (z) selectDusun(Number(z.dataset.dusun));
    });
    mapEl.addEventListener('keydown', (e) => {
      const z = e.target.closest && e.target.closest('.hot');
      if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectDusun(Number(z.dataset.dusun)); }
    });
  }

  function refreshMapHighlight() {
    if (state.selected === null) mapEl.removeAttribute('data-selected');
    else mapEl.setAttribute('data-selected', String(state.selected));
  }

  /* ---------- 5. RENDER ---------- */
  function hl(text, q) {
    const t = esc(text);
    if (!q) return t;
    const i = norm(text).indexOf(q);
    if (i < 0) return t;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  function rwMatches(rw, q) {
    if (!q) return true;
    const n = q.replace(/^rw\s*/, '');
    const numHit = n !== '' && /^\d+$/.test(n) && (rw.no === n.padStart(2, '0'));
    return numHit || norm(rw.kampung).includes(q) || norm('rw ' + rw.no).includes(q);
  }

  function visibleData() {
    const q = norm(state.query);
    return DUSUN
      .filter((d) => state.filter === 'all' || String(d.id) === state.filter)
      .map((d) => ({ d, rws: d.rw.filter((r) => rwMatches(r, q)) }))
      .filter((x) => x.rws.length > 0);
  }

  function rwListHTML(rws, q) {
    return '<ul class="rw-list">' + rws.map((r) =>
      `<li><span class="rw-chip">RW ${r.no}</span><span>${hl(r.kampung, q)}</span></li>`).join('') + '</ul>';
  }

  function render() {
    const q = norm(state.query);
    const data = visibleData();

  

    // Pesan tidak ditemukan
    if (data.length === 0) {
      el.noResult.hidden = false;
      el.noResult.textContent = `Tidak ada kampung atau RW yang cocok dengan “${state.query}”. Periksa ejaan atau klik “Reset filter”.`;
    } else el.noResult.hidden = true;

    // Hasil pencarian
    

    // Tombol dusun
    el.buttons.forEach((b) => {
      const on = Number(b.dataset.dusun) === state.selected;
      b.setAttribute('aria-pressed', String(on));
    });

    // Panel detail + status
    const sel = DUSUN.find((d) => d.id === state.selected);
    if (sel) {
      el.detail.className = `detail-panel d${sel.id}`;
      el.detail.innerHTML = `
        <div class="dp-head"><span class="pin" style="background:${COLORS[sel.id]}"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></span>
          <div><h3>${sel.nama}</h3><div class="badges"><span class="badge">${sel.posisi}</span><span class="badge">${sel.rentang}</span></div></div></div>
        <p class="wilayah-title">Wilayah binaan:</p>
        ${rwListHTML(sel.rw, '')}
        <p class="dp-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Peta hanya ilustrasi, bukan batas resmi.</p>`;
      el.detail.querySelectorAll('.rw-chip').forEach((c) => (c.style.background = COLORS[sel.id]));
      el.status.innerHTML = `Dusun terpilih: <strong>${sel.nama} — ${sel.posisi}</strong>`;
    } else {
      el.detail.className = 'detail-panel'; el.detail.innerHTML = '';
      el.status.innerHTML = 'Belum ada dusun dipilih. Menampilkan <strong>semua dusun</strong>.';
    }
    refreshMapHighlight();
  }

  /* ---------- 6. INTERAKSI ---------- */
  function selectDusun(id) {
    state.selected = state.selected === id ? null : id; // klik lagi = batal pilih
    if (state.selected !== null && state.filter !== 'all' && Number(state.filter) !== state.selected) {
      state.filter = 'all'; el.filter.value = 'all';
    }
    render();
  }

  el.buttons.forEach((b) => b.addEventListener('click', () => selectDusun(Number(b.dataset.dusun))));
  el.cards.addEventListener('click', (e) => {
    const c = e.target.closest('.card'); if (c) selectDusun(Number(c.dataset.dusun));
  });

  // Menu mobile
  
  // Menu mobile
  const toggle = $('#navToggle');
  const nav = $('#mainNav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }


  /* ---------- 7. MULAI ---------- */
  initMap();
  render();
})();
