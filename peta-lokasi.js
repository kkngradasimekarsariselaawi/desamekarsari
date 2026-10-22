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

  
/* ---------- 2. PETA SATELIT + IKON LOKASI ---------- */

const COLORS = {
  1: '#15803D',
  2: '#dc2626',
  3: '#7c3aed'
};

const mapEl = document.getElementById('map');

/*
  Posisi marker dalam persentase gambar:
  left = jarak dari kiri
  top  = jarak dari atas

  Posisi awal perkiraan berdasarkan gambar yang dikirim.
  Sesuaikan jika posisi gambar latar berbeda.
*/
const MAP_MARKERS = [
  // Dusun I Barat — hijau
  { id: 1, x: 27.0, y: 15.2, label: 'Lokasi Dusun I - 1' },
  { id: 1, x: 33.1, y: 18.7, label: 'Lokasi Dusun I - 2' },
  { id: 1, x: 38.7, y: 14.5, label: 'Lokasi Dusun I - 3' },

  // Dusun II Tengah — merah
  { id: 2, x: 39.0, y: 31.9, label: 'Lokasi Dusun II - 1' },
  { id: 2, x: 43.0, y: 36.0, label: 'Lokasi Dusun II - 2' },
  { id: 2, x: 48.7, y: 37.7, label: 'Lokasi Dusun II - 3' },

  // Dusun III Timur — ungu
  { id: 3, x: 53.8, y: 45.4, label: 'Lokasi Dusun III - 1' },
  { id: 3, x: 55.5, y: 65.7, label: 'Lokasi Dusun III - 2' },
  { id: 3, x: 62.5, y: 47.3, label: 'Lokasi Dusun III - 3' }
];

function buildMap() {
  // Hindari overlay dibuat berulang kali.
  mapEl.querySelector('.map-markers')?.remove();

  const layer = document.createElement('div');
  layer.className = 'map-markers';

  layer.innerHTML = MAP_MARKERS.map((m, index) => `
    <button
      type="button"
      class="map-marker d${m.id}"
      data-dusun="${m.id}"
      aria-label="${m.label}"
      title="${m.label}"
      style="left:${m.x}%;top:${m.y}%"
    >
      <span class="marker-number">${index + 1}</span>
    </button>
  `).join('');

  mapEl.appendChild(layer);
}

function initMap() {
  buildMap();

  // Klik ikon lokasi akan memilih dusun.
  mapEl.addEventListener('click', (e) => {
    const marker = e.target.closest('.map-marker');

    if (!marker || !mapEl.contains(marker)) return;

    selectDusun(Number(marker.dataset.dusun));
  });
}

function refreshMapHighlight() {
  if (state.selected === null) {
    mapEl.removeAttribute('data-selected');
  } else {
    mapEl.setAttribute(
      'data-selected',
      String(state.selected)
    );
  }

  // Perbarui status ikon lokasi.
  mapEl.querySelectorAll('.map-marker').forEach((marker) => {
    const active =
      state.selected !== null &&
      Number(marker.dataset.dusun) === state.selected;

    marker.classList.toggle('is-active', active);
    marker.setAttribute('aria-pressed', String(active));
  });
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
