const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'reorder_explanations_report.txt');

const TARGET_FILES = fs.readdirSync(DATA_DIR)
  .filter((file) => /^(exam_|category_).+\.json$/.test(file));

const SECTION_HEADINGS = [
  '📌 문제 유형',
  '🔎 유형 판단 이유',
  '🎯 문제 핵심',
  '💡 핵심 개념',
  '🧭 풀이 전략',
  '🧩 풀이 과정',
  '🟦 선택지 분석',
  '🚨 초보자 실수 포인트',
  '📝 암기 팁',
  '⭐ 시험 출제 포인트',
  '✅ 정답',
  '🔔 한 줄 요약',
];

const TOP_ORDER = [
  '✅ 정답',
  '🚨 초보자 실수 포인트',
  '📝 암기 팁',
  '⭐ 시험 출제 포인트',
  '🔔 한 줄 요약',
];

const REST_ORDER = [
  '📌 문제 유형',
  '🔎 유형 판단 이유',
  '🎯 문제 핵심',
  '💡 핵심 개념',
  '🧭 풀이 전략',
  '🧩 풀이 과정',
  '🟦 선택지 분석',
];

function normalize(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSections(text = '') {
  const lines = normalize(text).split('\n');
  const sections = new Map();
  const intro = [];
  let currentHeading = null;
  let currentLines = [];

  function commit() {
    if (currentHeading) {
      sections.set(currentHeading, normalize(currentLines.join('\n')));
    }
    currentHeading = null;
    currentLines = [];
  }

  for (const line of lines) {
    if (SECTION_HEADINGS.includes(line.trim())) {
      commit();
      currentHeading = line.trim();
      currentLines = [];
    } else if (currentHeading) {
      currentLines.push(line);
    } else if (line.trim()) {
      intro.push(line);
    }
  }
  commit();

  return { intro: normalize(intro.join('\n')), sections };
}

function reorderAnswerBody(body = '') {
  const lines = normalize(body).split('\n').filter((line) => line.trim());
  const reasonIndex = lines.findIndex((line) => line.startsWith('정답 이유 한 줄 요약:'));
  if (reasonIndex <= 0) return normalize(lines.join('\n'));

  const reason = lines.splice(reasonIndex, 1)[0];
  return normalize([reason, ...lines].join('\n'));
}

function buildSection(heading, body) {
  const normalizedBody = heading === '✅ 정답' ? reorderAnswerBody(body) : normalize(body);
  if (!normalizedBody) return '';
  return `${heading}\n\n${normalizedBody}`;
}

function reorderExplanation(text = '') {
  const { intro, sections } = splitSections(text);
  if (!sections.size) return normalize(text);

  const chunks = [];
  if (intro) chunks.push(intro);

  for (const heading of TOP_ORDER) {
    if (sections.has(heading)) chunks.push(buildSection(heading, sections.get(heading)));
  }

  for (const heading of REST_ORDER) {
    if (sections.has(heading)) chunks.push(buildSection(heading, sections.get(heading)));
  }

  for (const [heading, body] of sections.entries()) {
    if (!TOP_ORDER.includes(heading) && !REST_ORDER.includes(heading)) {
      chunks.push(buildSection(heading, body));
    }
  }

  return normalize(chunks.filter(Boolean).join('\n\n'));
}

let changedFiles = 0;
let changedQuestions = 0;
const report = ['정보처리기사 해설 순서 재정렬 보고서', ''];

for (const file of TARGET_FILES) {
  const fullPath = path.join(DATA_DIR, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  let fileChanged = 0;

  for (const question of data.questions || []) {
    if (typeof question.explanation !== 'string') continue;
    const next = reorderExplanation(question.explanation);
    if (next !== question.explanation) {
      question.explanation = next;
      fileChanged += 1;
      changedQuestions += 1;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    changedFiles += 1;
  }
  report.push(`${file}: ${fileChanged}문항 재정렬`);
}

report.push('');
report.push(`재정렬 문항 수: ${changedQuestions}`);
report.push(`수정된 파일 수: ${changedFiles}`);

fs.writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
console.log(report.join('\n'));
