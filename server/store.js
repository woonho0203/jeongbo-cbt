// JSON 파일 기반 영속 저장소.
// 모든 학습 기록은 data/cbt_store.json 한 파일에 저장됩니다.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'cbt_store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_STORE = {
  nextSessionId: 1,
  sessions: [],     // 응시 기록 (역순 정렬: 최신이 [0])
  bookmarks: {},    // qkey -> {note, createdAt}
  wrongLog: {},     // qkey -> {lastWrongAt, wrongCount, lastSelected, cleared}
};

let store = null;
let saveTimer = null;

function load() {
  if (store !== null) return store;
  if (fs.existsSync(STORE_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
      // 누락된 키 보강
      for (const k of Object.keys(DEFAULT_STORE)) {
        if (store[k] === undefined) store[k] = DEFAULT_STORE[k];
      }
    } catch (e) {
      console.error('[store] load failed, starting fresh:', e.message);
      store = JSON.parse(JSON.stringify(DEFAULT_STORE));
    }
  } else {
    store = JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
  return store;
}

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STORE_PATH + '.tmp', JSON.stringify(store, null, 2));
      fs.renameSync(STORE_PATH + '.tmp', STORE_PATH);
    } catch (e) {
      console.error('[store] save failed:', e.message);
    }
  }, 50);
}

// ===== 세션 =====
function addSession(s) {
  load();
  s.id = store.nextSessionId++;
  store.sessions.unshift(s);
  // 최대 1000개 유지
  if (store.sessions.length > 1000) store.sessions.length = 1000;
  save();
  return s;
}

function listSessions() {
  load();
  return store.sessions.slice();
}

function getSession(id) {
  load();
  return store.sessions.find(s => s.id === id) || null;
}

function deleteSession(id) {
  load();
  store.sessions = store.sessions.filter(s => s.id !== id);
  save();
}

// ===== 북마크 =====
function listBookmarks() { load(); return store.bookmarks; }
function setBookmark(qkey, note) {
  load();
  store.bookmarks[qkey] = { note: note || '', createdAt: new Date().toISOString() };
  save();
}
function delBookmark(qkey) { load(); delete store.bookmarks[qkey]; save(); }
function hasBookmark(qkey) { load(); return !!store.bookmarks[qkey]; }

// ===== 오답 로그 =====
function listWrong() {
  load();
  return Object.entries(store.wrongLog)
    .filter(([, v]) => !v.cleared)
    .sort((a, b) => (b[1].lastWrongAt || '').localeCompare(a[1].lastWrongAt || ''))
    .map(([qkey, v]) => ({ qkey, ...v }));
}
function recordWrong(qkey, selected) {
  load();
  const cur = store.wrongLog[qkey] || { wrongCount: 0 };
  store.wrongLog[qkey] = {
    lastWrongAt: new Date().toISOString(),
    wrongCount: (cur.wrongCount || 0) + 1,
    lastSelected: selected,
    cleared: false,
  };
  save();
}
function clearWrong(qkey) {
  load();
  if (store.wrongLog[qkey]) {
    store.wrongLog[qkey].cleared = true;
    save();
  }
}
function countWrong() {
  load();
  return Object.values(store.wrongLog).filter(v => !v.cleared).length;
}

module.exports = {
  load,
  addSession, listSessions, getSession, deleteSession,
  listBookmarks, setBookmark, delBookmark, hasBookmark,
  listWrong, recordWrong, clearWrong, countWrong,
};
