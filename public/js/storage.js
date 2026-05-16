// ─── 클라이언트 사이드 영속 저장소 ─────────────────────────────────────────────
// Vercel 서버리스 환경에서 /tmp 는 인스턴스 재시작 시 초기화되기 때문에
// 학습 데이터(세션·북마크·오답)는 localStorage에 저장합니다.
const Storage = (() => {
  function get(key, def) {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def; }
    catch { return def; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('[Storage] save failed:', e); }
  }

  // 단조 증가 ID
  function nextId() {
    const id = get('cbt_next_id', 1);
    set('cbt_next_id', id + 1);
    return id;
  }

  // ── 세션(학습 기록) ──────────────────────────────────────────────────────────
  function getSessions()      { return get('cbt_sessions', []); }
  function addSession(s)      {
    const list = getSessions();
    list.unshift(s);
    if (list.length > 300) list.length = 300;
    set('cbt_sessions', list);
  }
  function getSession(id)     { return getSessions().find(s => s.id === id) || null; }
  function deleteSession(id)  { set('cbt_sessions', getSessions().filter(s => s.id !== id)); }

  // ── 북마크 ───────────────────────────────────────────────────────────────────
  function getBookmarks()     { return get('cbt_bookmarks', {}); }
  function setBookmark(qkey, note, extra = {}) {
    const bm = getBookmarks();
    bm[qkey] = { note: note || '', createdAt: new Date().toISOString(), ...extra };
    set('cbt_bookmarks', bm);
  }
  function delBookmark(qkey)  { const bm = getBookmarks(); delete bm[qkey]; set('cbt_bookmarks', bm); }
  function hasBookmark(qkey)  { return !!getBookmarks()[qkey]; }
  function listBookmarks()    {
    return Object.entries(getBookmarks())
      .map(([qkey, v]) => ({ qkey, ...v }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  // ── 오답 로그 ────────────────────────────────────────────────────────────────
  function getWrongLog()      { return get('cbt_wrong', {}); }
  function recordWrong(qkey, selected) {
    const log = getWrongLog();
    const cur = log[qkey] || { wrongCount: 0 };
    log[qkey] = {
      lastWrongAt: new Date().toISOString(),
      wrongCount: (cur.wrongCount || 0) + 1,
      lastSelected: selected,
      cleared: false,
    };
    set('cbt_wrong', log);
  }
  function clearWrong(qkey)   {
    const log = getWrongLog();
    if (log[qkey]) { log[qkey].cleared = true; set('cbt_wrong', log); }
  }
  function countWrong()       { return Object.values(getWrongLog()).filter(v => !v.cleared).length; }
  function listWrong()        {
    return Object.entries(getWrongLog())
      .filter(([, v]) => !v.cleared)
      .sort((a, b) => (b[1].lastWrongAt || '').localeCompare(a[1].lastWrongAt || ''))
      .map(([qkey, v]) => ({ qkey, ...v }));
  }

  // ── 통계 계산 ─────────────────────────────────────────────────────────────────
  function computeStats() {
    const sessions = getSessions().filter(s => s.question_count > 0);
    if (sessions.length === 0) {
      return { totalSessions: 0, avgScore: 0, lastScore: null, bestScore: null, recent: [], subjectAvg: {}, recentTrend: [] };
    }
    const totalSessions = sessions.length;
    const avgScore = Math.round(sessions.reduce((acc, s) => acc + (s.score || 0), 0) / totalSessions * 10) / 10;
    const lastScore = sessions[0].score;
    const bestScore = Math.max(...sessions.map(s => s.score || 0));

    const subjectTotals = {};
    for (const s of sessions) {
      const bd = s.subject_breakdown || {};
      for (const [subj, v] of Object.entries(bd)) {
        if (!subjectTotals[subj]) subjectTotals[subj] = { correct: 0, total: 0 };
        subjectTotals[subj].correct += v.correct || 0;
        subjectTotals[subj].total   += v.total   || 0;
      }
    }
    const subjectAvg = {};
    for (const [subj, v] of Object.entries(subjectTotals)) {
      subjectAvg[subj] = {
        name: (typeof SUBJECT_NAMES !== 'undefined' ? SUBJECT_NAMES[subj] : null) || `과목${subj}`,
        correct: v.correct, total: v.total,
        rate: v.total ? Math.round(v.correct / v.total * 1000) / 10 : 0,
      };
    }
    const recentTrend = sessions.slice(0, 15).reverse().map(s => ({
      id: s.id, score: s.score, finishedAt: s.finished_at, title: s.title,
    }));
    const recent = sessions.slice(0, 5).map(s => ({
      id: s.id, mode: s.mode, title: s.title, score: s.score,
      correct: s.correct_count, total: s.question_count, finishedAt: s.finished_at,
    }));
    return { totalSessions, avgScore, lastScore, bestScore, recent, subjectAvg, recentTrend };
  }

  // ── 랜덤 출제 진도 추적 ──────────────────────────────────────────────────────
  function getRandomMeta()       { return get('cbt_random_meta', { total: 0, cycles: 0 }); }
  function setRandomTotal(n)     { set('cbt_random_meta', { ...getRandomMeta(), total: n }); }
  function getSeenRandom()       { return get('cbt_seen_random', []); }
  function countSeenRandom()     { return getSeenRandom().length; }
  function addSeenRandom(qkeys)  {
    const seen = new Set(getSeenRandom());
    for (const k of qkeys) seen.add(k);
    const meta = getRandomMeta();
    if (meta.total > 0 && seen.size >= meta.total) {
      // 전체 완주: 자동 리셋 + 완주 횟수 +1
      set('cbt_seen_random', []);
      set('cbt_random_meta', { ...meta, cycles: (meta.cycles || 0) + 1 });
    } else {
      set('cbt_seen_random', [...seen]);
    }
  }
  function resetSeenRandom()     {
    set('cbt_seen_random', []);
  }

  return {
    nextId,
    getSessions, addSession, getSession, deleteSession,
    getBookmarks, setBookmark, delBookmark, hasBookmark, listBookmarks,
    getWrongLog, recordWrong, clearWrong, countWrong, listWrong,
    getRandomMeta, setRandomTotal, getSeenRandom, countSeenRandom, addSeenRandom, resetSeenRandom,
    computeStats,
  };
})();
