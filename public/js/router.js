// 간단한 해시 기반 라우터
const routes = {};

function defineRoute(name, handler) { routes[name] = handler; }

function navigate(name, params = {}) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  location.hash = '#' + name + (qs ? '?' + qs : '');
}

function parseHash() {
  const h = location.hash.slice(1) || 'home';
  const [name, qs] = h.split('?');
  const params = {};
  if (qs) {
    for (const kv of qs.split('&')) {
      const [k, v] = kv.split('=');
      params[k] = decodeURIComponent(v || '');
    }
  }
  return { name, params };
}

async function renderRoute() {
  const { name, params } = parseHash();
  const handler = routes[name] || routes.home;
  // 페이지 전환 시 이전 타이머 인터벌 정리
  if (typeof clearGlobalTimer === 'function') clearGlobalTimer();
  // 네비 active 표시
  document.querySelectorAll('.topbar nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === name);
  });
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">로딩 중…</div>';
  try {
    await handler(app, params);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card"><h2>오류</h2><p>${e.message}</p></div>`;
  }
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('load', () => {
  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.route);
    });
  });
  renderRoute();
});
