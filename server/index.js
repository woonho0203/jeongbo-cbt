// 정보처리기사 CBT 서버 - Node.js 내장 모듈만 사용 (의존성 없음)
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const loader = require('./loader');

loader.loadAll();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const SUBJECT_NAMES = {
  1: '소프트웨어 설계',
  2: '소프트웨어 개발',
  3: '데이터베이스 구축',
  4: '프로그래밍 언어 활용',
  5: '정보시스템 구축 관리',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
};

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function sendJSON(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendError(res, status, msg) {
  sendJSON(res, { error: msg }, status);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 2 * 1024 * 1024) reject(new Error('body too large')); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, reqPath) {
  // SPA 폴백: 파일이 없으면 index.html
  let filePath = path.join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : reqPath);
  const ext = path.extname(filePath);

  const tryFile = (fp) => {
    fs.readFile(fp, (err, data) => {
      if (err) {
        if (fp !== path.join(PUBLIC_DIR, 'index.html')) {
          // 파일 없으면 SPA fallback
          return tryFile(path.join(PUBLIC_DIR, 'index.html'));
        }
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const mime = MIME[path.extname(fp)] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  };
  tryFile(filePath);
}

// ── 라우터 ─────────────────────────────────────────────────────────────────────

async function handleAPI(req, res, method, urlPath) {
  // GET /api/exams
  if (method === 'GET' && urlPath === '/api/exams') {
    return sendJSON(res, { exams: loader.listExams(), categories: loader.listCategories() });
  }

  // POST /api/exam/start
  if (method === 'POST' && urlPath === '/api/exam/start') {
    const { mode, sourceId, count = 100, checkMode = false, wrongKeys } = await readBody(req);
    let questions = [], title = '', qkeyMode = mode;

    if (mode === 'past') {
      const exam = loader.getExam(sourceId);
      if (!exam) return sendError(res, 404, 'exam not found');
      questions = exam.questions.map(q => ({ ...q, qkey: loader.buildQkey('past', sourceId, q.qnum) }));
      title = exam.title;
    } else if (mode === 'random') {
      questions = loader.getBalancedRandomQuestions(count || 100);
      title = `랜덤 모의고사 (${questions.length}문제 / 기출+유형별 과목 균형)`;
      qkeyMode = 'random';
    } else if (mode === 'category') {
      const cat = loader.getCategory(sourceId);
      if (!cat) return sendError(res, 404, 'category not found');
      questions = cat.questions.map(q => ({ ...q, qkey: loader.buildQkey('category', sourceId, q.qnum) }));
      title = cat.title;
    } else if (mode === 'wrong') {
      // 클라이언트가 localStorage 오답 목록을 전달한 경우 우선 사용
      const clientWrongKeys = Array.isArray(wrongKeys) ? wrongKeys : [];
      const seen = new Set();
      if (clientWrongKeys.length > 0) {
        for (const qkey of clientWrongKeys) {
          const q = loader.lookupQuestion(qkey);
          if (q && !seen.has(qkey)) { questions.push({ ...q, qkey }); seen.add(qkey); }
        }
      } else {
        // 폴백: 서버 스토어 (로컬 실행 환경)
        const wrongs = store.listWrong();
        for (const r of wrongs) {
          const q = loader.lookupQuestion(r.qkey);
          if (q && !seen.has(r.qkey)) { questions.push({ ...q, qkey: r.qkey }); seen.add(r.qkey); }
        }
      }
      if (count) questions = questions.slice(0, count);
      title = `오답 노트 (${questions.length}문제)`;
    } else {
      return sendError(res, 400, 'invalid mode');
    }

    const safeQs = questions.map(q => ({
      qkey: q.qkey, qnum: q.qnum, displayNum: q.displayNum,
      subject: q.subject, subjectName: q.subjectName || SUBJECT_NAMES[q.subject],
      stem: q.stem, options: q.options, hasAnswer: q.answer != null,
      image: q.image || null,
      table: q.table || null,
      sourceId: q.sourceId || null,
      answer: checkMode ? (q.answer ?? null) : undefined,
      explanation: checkMode ? (q.explanation ?? null) : undefined,
    }));
    return sendJSON(res, { title, mode: qkeyMode, questions: safeQs });
  }

  // POST /api/exam/submit
  if (method === 'POST' && urlPath === '/api/exam/submit') {
    const { mode, sourceId, title, durationSec, answers } = await readBody(req);
    if (!Array.isArray(answers)) return sendError(res, 400, 'answers required');

    const graded = [];
    let correct = 0, gradable = 0;
    const subjectBreakdown = {};

    for (const a of answers) {
      const q = loader.lookupQuestion(a.qkey);
      if (!q) { graded.push({ ...a, correct: null, isCorrect: null, missing: true }); continue; }
      const subj = q.subject || 0;
      if (!subjectBreakdown[subj]) subjectBreakdown[subj] = { correct: 0, total: 0 };
      if (q.answer != null) {
        gradable++;
        const isCorrect = a.selected === q.answer ? 1 : 0;
        if (isCorrect) { correct++; subjectBreakdown[subj].correct++; }
        subjectBreakdown[subj].total++;
        graded.push({
          qkey: a.qkey, qnum: q.qnum, subject: subj,
          subjectName: q.subjectName || SUBJECT_NAMES[subj],
          stem: q.stem, options: q.options, selected: a.selected,
          correct: q.answer, isCorrect: !!isCorrect, explanation: q.explanation || null,
        });
      } else {
        graded.push({
          qkey: a.qkey, qnum: q.qnum, subject: subj,
          subjectName: q.subjectName || SUBJECT_NAMES[subj],
          stem: q.stem, options: q.options, selected: a.selected,
          correct: null, isCorrect: null, explanation: q.explanation || null,
        });
      }
    }

    const score = gradable > 0 ? Math.round((correct / gradable) * 1000) / 10 : 0;
    const now = new Date().toISOString();
    const startedAt = new Date(Date.now() - (durationSec || 0) * 1000).toISOString();

    const lightAnswers = graded.map(g => ({
      qkey: g.qkey, qnum: g.qnum, subject: g.subject,
      selected: g.selected ?? null, correct: g.correct ?? null,
      isCorrect: g.isCorrect == null ? null : (g.isCorrect ? 1 : 0),
    }));
    const session = store.addSession({
      mode, sourceId: sourceId || '', title: title || '',
      questionCount: gradable, correctCount: correct, score,
      durationSec: durationSec || 0, startedAt, finishedAt: now,
      subjectBreakdown, answers: lightAnswers,
    });

    for (const g of graded) {
      if (g.correct != null) {
        if (g.isCorrect === false) store.recordWrong(g.qkey, g.selected ?? null);
        else if (g.isCorrect === true) store.clearWrong(g.qkey);
      }
    }

    return sendJSON(res, {
      sessionId: session.id, score, correct, total: gradable,
      durationSec: durationSec || 0, subjectBreakdown, graded,
    });
  }

  // GET /api/sessions
  if (method === 'GET' && urlPath === '/api/sessions') {
    const sessions = store.listSessions().slice(0, 200).map(s => ({
      id: s.id, mode: s.mode, source_id: s.sourceId, title: s.title,
      question_count: s.questionCount, correct_count: s.correctCount, score: s.score,
      duration_sec: s.durationSec, started_at: s.startedAt, finished_at: s.finishedAt,
      subject_breakdown: s.subjectBreakdown,
    }));
    return sendJSON(res, { sessions });
  }

  // GET/DELETE /api/sessions/:id
  const sessionMatch = urlPath.match(/^\/api\/sessions\/(\d+)$/);
  if (sessionMatch) {
    const id = parseInt(sessionMatch[1], 10);
    if (method === 'DELETE') {
      store.deleteSession(id);
      return sendJSON(res, { ok: true });
    }
    if (method === 'GET') {
      const s = store.getSession(id);
      if (!s) return sendError(res, 404, 'not found');
      const session = {
        id: s.id, mode: s.mode, source_id: s.sourceId, title: s.title,
        question_count: s.questionCount, correct_count: s.correctCount, score: s.score,
        duration_sec: s.durationSec, started_at: s.startedAt, finished_at: s.finishedAt,
        subject_breakdown: s.subjectBreakdown,
      };
      const enriched = (s.answers || []).map(a => {
        const q = loader.lookupQuestion(a.qkey);
        return {
          ...a, is_correct: a.isCorrect,
          stem: q?.stem, options: q?.options,
          explanation: q?.explanation || null,
          image: q?.image || null,
          table: q?.table || null,
          subjectName: q?.subjectName || SUBJECT_NAMES[a.subject] || null,
        };
      });
      return sendJSON(res, { session, answers: enriched });
    }
  }

  // GET /api/stats
  if (method === 'GET' && urlPath === '/api/stats') {
    const sessions = store.listSessions().filter(s => s.questionCount > 0);
    if (sessions.length === 0) {
      return sendJSON(res, {
        totalSessions: 0, avgScore: 0, lastScore: null, bestScore: null,
        recent: [], subjectAvg: {}, recentTrend: [],
      });
    }
    const totalSessions = sessions.length;
    const avgScore = Math.round(sessions.reduce((acc, s) => acc + (s.score || 0), 0) / totalSessions * 10) / 10;
    const lastScore = sessions[0].score;
    const bestScore = Math.max(...sessions.map(s => s.score || 0));

    const subjectTotals = {};
    for (const s of sessions) {
      const bd = s.subjectBreakdown || {};
      for (const [subj, v] of Object.entries(bd)) {
        if (!subjectTotals[subj]) subjectTotals[subj] = { correct: 0, total: 0 };
        subjectTotals[subj].correct += v.correct || 0;
        subjectTotals[subj].total += v.total || 0;
      }
    }
    const subjectAvg = {};
    for (const [subj, v] of Object.entries(subjectTotals)) {
      subjectAvg[subj] = {
        name: SUBJECT_NAMES[subj] || `과목${subj}`,
        correct: v.correct, total: v.total,
        rate: v.total ? Math.round(v.correct / v.total * 1000) / 10 : 0,
      };
    }
    const recentTrend = sessions.slice(0, 15).reverse().map(s => ({
      id: s.id, score: s.score, finishedAt: s.finishedAt, title: s.title,
    }));
    const recent = sessions.slice(0, 5).map(s => ({
      id: s.id, mode: s.mode, title: s.title, score: s.score,
      correct: s.correctCount, total: s.questionCount, finishedAt: s.finishedAt,
    }));
    return sendJSON(res, { totalSessions, avgScore, lastScore, bestScore, recent, subjectAvg, recentTrend });
  }

  // GET /api/bookmarks
  if (method === 'GET' && urlPath === '/api/bookmarks') {
    const all = store.listBookmarks();
    const enriched = Object.entries(all).map(([qkey, v]) => {
      const q = loader.lookupQuestion(qkey);
      return {
        qkey, note: v.note, createdAt: v.createdAt,
        stem: q?.stem, options: q?.options, answer: q?.answer,
        explanation: q?.explanation || null,
        image: q?.image || null, table: q?.table || null,
        subjectName: q?.subjectName || SUBJECT_NAMES[q?.subject],
      };
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return sendJSON(res, { bookmarks: enriched });
  }

  // POST /api/bookmarks
  if (method === 'POST' && urlPath === '/api/bookmarks') {
    const { qkey, note } = await readBody(req);
    if (!qkey) return sendError(res, 400, 'qkey required');
    store.setBookmark(qkey, note);
    return sendJSON(res, { ok: true });
  }

  // GET /api/bookmarks/check/:qkey  (반드시 DELETE 보다 먼저)
  const bookmarkCheckMatch = urlPath.match(/^\/api\/bookmarks\/check\/(.+)$/);
  if (method === 'GET' && bookmarkCheckMatch) {
    const qkey = decodeURIComponent(bookmarkCheckMatch[1]);
    return sendJSON(res, { bookmarked: store.hasBookmark(qkey) });
  }

  // DELETE /api/bookmarks/:qkey
  const bookmarkDelMatch = urlPath.match(/^\/api\/bookmarks\/(.+)$/);
  if (method === 'DELETE' && bookmarkDelMatch) {
    store.delBookmark(decodeURIComponent(bookmarkDelMatch[1]));
    return sendJSON(res, { ok: true });
  }

  // GET /api/wrong/count
  if (method === 'GET' && urlPath === '/api/wrong/count') {
    return sendJSON(res, { count: store.countWrong() });
  }

  sendError(res, 404, 'not found');
}

// ── 공통 핸들러 ───────────────────────────────────────────────────────────────

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const urlPath = url.pathname;
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    if (urlPath.startsWith('/api/')) {
      await handleAPI(req, res, method, urlPath);
    } else {
      serveStatic(res, urlPath);
    }
  } catch (e) {
    console.error('[server error]', e.message);
    if (!res.headersSent) sendError(res, 500, e.message);
  }
}

// Vercel 서버리스: module.exports로 핸들러 export
module.exports = requestHandler;

// 로컬 직접 실행 시에만 http 서버 시작
if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log('\n=== 정보처리기사 CBT 서버 시작 ===');
    console.log(`http://localhost:${PORT}\n`);
  });
}
