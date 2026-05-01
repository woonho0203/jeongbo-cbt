// data/exam_*.json, data/category_*.json 로드 → 메모리 인덱스
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const EXAMS = {};        // examId -> {title, questions:[{qnum, stem, options, answer, subject, subjectName}]}
const CATEGORIES = {};   // categoryId -> {title, questions:[...]}

function buildQkey(mode, sourceId, qnum) {
  return `${mode}:${sourceId}:${qnum}`;
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

module.exports = {
  loadAll,
  listExams,
  listCategories,
  getExam,
  getCategory,
  getAllExamQuestions,
  lookupQuestion,
  buildQkey,
};
