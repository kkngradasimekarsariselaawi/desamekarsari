/* Loads one shared header and footer across the six public pages. */
(() => {
  const page = document.body.dataset.page || location.pathname.split('/').pop().replace('.html', '') || 'beranda';
  const loadComponent = async (url, targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      target.innerHTML = await response.text();
    } catch (error) {
      console.error(`Komponen ${url} gagal dimuat. Pastikan situs dibuka melalui server/hosting.`, error);
      target.innerHTML = `<div class="mk-component-error">Komponen halaman belum dapat dimuat. Muat ulang halaman atau periksa struktur folder.</div>`;
    }
  };
  const start = async () => {
    await Promise.all([
      loadComponent('components/header.html', 'shared-header'),
      loadComponent('components/footer.html', 'shared-footer')
    ]);
    const nav = document.getElementById('mk-nav');
    const toggle = document.querySelector('.mk-menu-toggle');
    if (nav && toggle) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
        const icon = toggle.querySelector('i');
        if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
      });
      nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Buka menu navigasi');
        const icon = toggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      }));
      const active = nav.querySelector(`[data-page-link="${CSS.escape(page)}"]`);
      if (active) {
        active.classList.add('is-active');
        active.setAttribute('aria-current', 'page');
      }
    }
    const year = document.getElementById('mk-current-year');
    if (year) year.textContent = new Date().getFullYear();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
