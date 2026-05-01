// API 헬퍼 + 유틸
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  return res.json();
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const c of [].concat(children).flat()) {
    if (c == null) continue;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDuration(sec) {
  if (sec == null) return '-';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}시간 ${m}분`;
  if (m) return `${m}분 ${s}초`;
  return `${s}초`;
}
function fmtTimer(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const CIRCLES = ['①', '②', '③', '④'];
const SUBJECT_NAMES = {
  1: '소프트웨어 설계',
  2: '소프트웨어 개발',
  3: '데이터베이스 구축',
  4: '프로그래밍 언어 활용',
  5: '정보시스템 구축 관리',
};

function modalConfirm(title, msg) {
  return new Promise(resolve => {
    const bg = el('div', { class: 'modal-bg' });
    const m = el('div', { class: 'modal' }, [
      el('h3', { text: title }),
      el('p', { text: msg }),
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn', onClick: () => { bg.remove(); resolve(false); }, text: '취소' }),
        el('button', { class: 'btn primary', onClick: () => { bg.remove(); resolve(true); }, text: '확인' }),
      ]),
    ]);
    bg.appendChild(m);
    document.body.appendChild(bg);
  });
}
