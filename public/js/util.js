// ─── 테마 토글 ───────────────────────────────────────────────────────────────
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.content = next === 'dark' ? '#0f1117' : '#3b6ef5';
}

// 페이지 로드 시 저장된 테마 적용 + 버튼 아이콘 동기화
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
});

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

// 문제 본문에서 코드 블록 감지 후 <pre> 분리 렌더링
function renderStem(text) {
  const CODE_STARTS = [
    '#include', 'public class ', 'class Solution', 'def ', 'function ',
    'SELECT ', 'CREATE TABLE ', 'INSERT INTO ', 'UPDATE ', 'DELETE FROM ',
    'import java.', 'package ', 'int main(', 'void main(', '<?php',
  ];
  let splitIdx = -1;
  for (const m of CODE_STARTS) {
    const idx = text.indexOf(m);
    if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) splitIdx = idx;
  }
  if (splitIdx === -1) return [el('div', { class: 'qstem', text })];
  const questionText = text.slice(0, splitIdx).trim();
  const codeText = text.slice(splitIdx);
  const nodes = [];
  if (questionText) nodes.push(el('div', { class: 'qstem', text: questionText }));
  const pre = document.createElement('pre');
  pre.className = 'code-block';
  pre.appendChild(Object.assign(document.createElement('code'), { textContent: codeText }));
  nodes.push(pre);
  return nodes;
}

// 마크다운 인라인 파싱 (**bold**, 특수기호 처리)
function parseMd(line) {
  // **text** → <strong>
  return line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// 줄 목록을 HTML로 변환 (-, 1. 2. 등)
function linesToHtml(lines) {
  const chunks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line) { i++; continue; }
    // 순서있는 목록
    if (/^\d+\.\s/.test(line)) {
      const olLines = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trimEnd())) {
        olLines.push(lines[i].replace(/^\d+\.\s*/, '').trimEnd());
        i++;
      }
      chunks.push('<ol class="exp-ol">' + olLines.map(l => `<li>${parseMd(l)}</li>`).join('') + '</ol>');
      continue;
    }
    // 비순서 목록 (- 또는 •)
    if (/^[-•]\s/.test(line)) {
      const ulLines = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trimEnd())) {
        ulLines.push(lines[i].replace(/^[-•]\s*/, '').trimEnd());
        i++;
      }
      chunks.push('<ul class="exp-ul">' + ulLines.map(l => `<li>${parseMd(l)}</li>`).join('') + '</ul>');
      continue;
    }
    // 정답 확인 줄 (정답: N번 ...)
    if (/^정답\s*:/.test(line)) {
      chunks.push(`<div class="exp-answer">${parseMd(line)}</div>`);
      i++;
      continue;
    }
    // 핵심 줄
    if (/^\*\*핵심\*\*/.test(line) || /^핵심\s*:/.test(line)) {
      chunks.push(`<div class="exp-core">${parseMd(line)}</div>`);
      i++;
      continue;
    }
    // 일반 문단
    chunks.push(`<p class="exp-p">${parseMd(line)}</p>`);
    i++;
  }
  return chunks.join('');
}

// 섹션 제목 → CSS 클래스
function sectionClass(title) {
  if (title.includes('분석')) return 'sec-analysis';
  if (title.includes('풀이')) return 'sec-process';
  if (title.includes('정답')) return 'sec-answer';
  if (title.includes('포인트')) return 'sec-point';
  if (title.includes('주의')) return 'sec-warning';
  return 'sec-etc';
}

// 해설 렌더링 (구조화된 레이아웃)
function renderExplanation(text) {
  if (!text) return null;
  const wrap = el('div', { class: 'explanation' });
  wrap.appendChild(el('div', { class: 'explanation-header', text: '💡 해설' }));

  const body = el('div', { class: 'explanation-body' });

  // --- 구분자로 섹션 분리
  const rawSections = text.split(/\n---\n/);
  for (const sec of rawSections) {
    const lines = sec.trim().split('\n');
    if (!lines.length) continue;
    const headerMatch = lines[0].match(/^\[(.+)\]$/);
    if (headerMatch) {
      const titleEl = el('div', { class: 'exp-sec-title ' + sectionClass(headerMatch[1]) });
      titleEl.textContent = lines[0];
      body.appendChild(titleEl);
      const contentEl = el('div', { class: 'exp-sec-body' });
      contentEl.innerHTML = linesToHtml(lines.slice(1));
      body.appendChild(contentEl);
    } else {
      const contentEl = el('div', { class: 'exp-sec-body' });
      contentEl.innerHTML = linesToHtml(lines);
      body.appendChild(contentEl);
    }
  }

  wrap.appendChild(body);
  return wrap;
}
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
