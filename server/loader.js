// data/exam_*.json, data/category_*.json 로드 → 메모리 인덱스
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const EXAMS = {};        // examId -> {title, questions:[{qnum, stem, options, answer, subject, subjectName}]}
const CATEGORIES = {};   // categoryId -> {title, questions:[...]}

function buildQkey(mode, sourceId, qnum) {
  return `${mode}:${sourceId}:${qnum}`;
}

function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function subjectName(subject) {
  const names = {
    1: '소프트웨어 설계',
    2: '소프트웨어 개발',
    3: '데이터베이스 구축',
    4: '프로그래밍 언어 활용',
    5: '정보시스템 구축 관리',
  };
  return names[subject] || undefined;
}

function inferSubject(question) {
  if (question.subject) return Number(question.subject);

  const text = `${question.stem || ''}\n${(question.options || []).join('\n')}\n${question.explanation || ''}`.toLowerCase();
  const scores = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const add = (subject, words, weight = 1) => {
    for (const word of words) {
      if (text.includes(word.toLowerCase())) scores[subject] += weight;
    }
  };

  add(1, ['요구사항', 'uml', '유스케이스', '클래스 다이어그램', '객체지향 설계', '디자인 패턴', '아키텍처', '애자일', '스크럼', 'xp', 'dfd', '자료 흐름도', 'ui', '인터페이스 설계', '소프트웨어 공학']);
  add(2, ['테스트', '화이트박스', '블랙박스', '형상관리', '빌드', '배포', '패키징', '자료구조', '스택', '큐', '트리', '그래프', '정렬', '검색', '알고리즘', '복잡도', '모듈', '통합']);
  add(3, ['데이터베이스', '릴레이션', '튜플', '속성', '도메인', '카디널리티', '차수', '정규화', '반정규화', '트랜잭션', 'sql', 'select', 'from', 'where', 'join', 'ddl', 'dml', 'dcl', '기본키', '외래키', '후보키', '무결성']);
  add(4, ['c언어', 'c 언어', '#include', 'printf', 'scanf', 'java', 'python', '파이썬', '자바', '배열', '포인터', '변수', '반복문', '운영체제', '프로세스', '스레드', '스케줄링', '교착', '세마포어', '페이지', '가상기억', 'unix', 'linux', '쉘', 'shell']);
  add(5, ['네트워크', 'osi', 'tcp', 'udp', 'ip', 'ipv4', 'ipv6', '라우팅', '프로토콜', 'http', 'ftp', 'dns', 'arp', 'icmp', '보안', '암호', '인증', '방화벽', '공격', '취약점', '악성', '해킹', '접근제어', '위험', '비용산정', 'cocomo']);

  let bestSubject = 1;
  let bestScore = -1;
  for (const subject of [1, 2, 3, 4, 5]) {
    if (scores[subject] > bestScore) {
      bestScore = scores[subject];
      bestSubject = subject;
    }
  }
  return bestScore > 0 ? bestSubject : 1;
}

function loadAll() {
  const files = fs.readdirSync(DATA_DIR);
  for (const f of files) {
    const p = path.join(DATA_DIR, f);
    if (f.startsWith('exam_') && f.endsWith('.json')) {
      const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
      EXAMS[j.examId] = j;
    } else if (f.startsWith('category_') && f.endsWith('.json')) {
      const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
      CATEGORIES[j.categoryId] = j;
    }
  }

  console.log(`[loader] 회차: ${Object.keys(EXAMS).length}, 유형: ${Object.keys(CATEGORIES).length}`);
}

function listExams() {
  return Object.values(EXAMS).map(e => ({
    examId: e.examId,
    title: e.title,
    count: e.questions.length,
  })).sort((a, b) => a.examId.localeCompare(b.examId));
}

function listCategories() {
  return Object.values(CATEGORIES).map(c => ({
    categoryId: c.categoryId,
    title: c.title,
    count: c.questions.length,
  }));
}

function getExam(examId) { return EXAMS[examId]; }
function getCategory(catId) { return CATEGORIES[catId]; }

// 모든 회차 문제 합치기 (랜덤 모의고사용)
function getAllExamQuestions() {
  const all = [];
  for (const examId of Object.keys(EXAMS)) {
    for (const q of EXAMS[examId].questions) {
      all.push({ ...q, examId });
    }
  }
  return all;
}

// 회차별 기출 + 유형별 문제를 모두 합친 랜덤 풀.
// 유형별 문제에는 과목 정보가 없어서 문제 키워드로 과목을 추정한다.
function getAllQuestionsForRandom() {
  const all = [];
  const seen = new Set();

  const addQuestion = (question, mode, sourceId, extra = {}) => {
    const dedupeKey = [
      String(question.stem || '').replace(/\s+/g, ' ').trim(),
      ...(question.options || []).map((option) => String(option).replace(/\s+/g, ' ').trim()),
    ].join('||');
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const subject = inferSubject(question);
    all.push({
      ...question,
      ...extra,
      subject,
      subjectName: question.subjectName || subjectName(subject),
      qkey: buildQkey(mode, sourceId, question.qnum),
      sourceMode: mode,
      sourceId,
    });
  };

  for (const examId of Object.keys(EXAMS)) {
    for (const question of EXAMS[examId].questions) {
      addQuestion(question, 'past', examId, { examId });
    }
  }

  for (const categoryId of Object.keys(CATEGORIES)) {
    for (const question of CATEGORIES[categoryId].questions) {
      addQuestion(question, 'category', categoryId, { categoryId });
    }
  }

  return all;
}

function getBalancedRandomQuestions(count = 100) {
  return getSmartRandomQuestions(count, [], []);
}

// 미출제 우선 + 오답 가중치 스마트 랜덤
// seenKeys: 이미 출제된 qkey 배열, wrongKeys: 오답 qkey 배열
function getSmartRandomQuestions(count = 100, seenKeys = [], wrongKeys = []) {
  const all = getAllQuestionsForRandom();
  const total = Math.min(Number(count) || 100, all.length);
  const seenSet  = new Set(seenKeys);
  const wrongSet = new Set(wrongKeys);
  const subjects = [1, 2, 3, 4, 5];

  // 우선순위: 미출제+오답=3, 미출제=2, 출제됨+오답=1, 출제됨=0
  function priority(q) {
    const seen  = seenSet.has(q.qkey);
    const wrong = wrongSet.has(q.qkey);
    if (!seen && wrong) return 3;
    if (!seen)          return 2;
    if (wrong)          return 1;
    return 0;
  }

  // 과목별 버킷 구성 (먼저 shuffle → 같은 우선순위 내 무작위)
  const buckets = Object.fromEntries(subjects.map(s => [s, []]));
  for (const q of shuffle(all)) {
    const subj = subjects.includes(Number(q.subject)) ? Number(q.subject) : inferSubject(q);
    buckets[subj].push({ ...q, subject: subj, subjectName: q.subjectName || subjectName(subj) });
  }

  // 각 과목 버킷을 우선순위 내림차순 정렬 (stable: shuffle이 이미 되어 있으므로 같은 순위끼리 무작위)
  for (const subj of subjects) {
    buckets[subj].sort((a, b) => priority(b) - priority(a));
  }

  // 과목별 균등 배분
  const base = Math.floor(total / subjects.length);
  let remainder = total % subjects.length;
  const selected = [];

  for (const subj of subjects) {
    const target = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    selected.push(...buckets[subj].splice(0, target));
  }

  // 부족분 보충 (전체에서 우선순위 순으로)
  if (selected.length < total) {
    const selectedKeys = new Set(selected.map(q => q.qkey));
    const rest = shuffle(subjects.flatMap(s => buckets[s]))
      .filter(q => !selectedKeys.has(q.qkey));
    rest.sort((a, b) => priority(b) - priority(a));
    selected.push(...rest.slice(0, total - selected.length));
  }

  // 최종 섞기 후 displayNum 부여
  return shuffle(selected).slice(0, total).map((q, i) => ({ ...q, displayNum: i + 1 }));
}

function lookupQuestion(qkey) {
  const [mode, sourceId, qnumStr] = qkey.split(':');
  const qnum = parseInt(qnumStr, 10);
  if (mode === 'past' || mode === 'random') {
    const exam = EXAMS[sourceId];
    if (!exam) return null;
    return exam.questions.find(q => q.qnum === qnum);
  }
  if (mode === 'category') {
    const cat = CATEGORIES[sourceId];
    if (!cat) return null;
    return cat.questions.find(q => q.qnum === qnum);
  }
  return null;
}

function getRandomPoolSize() {
  return getAllQuestionsForRandom().length;
}

module.exports = {
  loadAll,
  listExams,
  listCategories,
  getExam,
  getCategory,
  getAllExamQuestions,
  getAllQuestionsForRandom,
  getBalancedRandomQuestions,
  getSmartRandomQuestions,
  getRandomPoolSize,
  lookupQuestion,
  buildQkey,
};
