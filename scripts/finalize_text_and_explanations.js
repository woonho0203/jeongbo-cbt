const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'final_text_explanation_report.txt');

const TARGET_FILES = fs.readdirSync(DATA_DIR)
  .filter((file) => /^(exam_|category_).+\.json$/.test(file))
  .filter((file) => !['categories_index.json', 'exams_index.json', 'cbt_store.json'].includes(file));

const questionFixes = [
  [/도 메인/g, '도메인'],
  [/순 서로/g, '순서로'],
  [/발생하 는/g, '발생하는'],
  [/사용하 여/g, '사용하여'],
  [/표현하 고/g, '표현하고'],
  [/되 어야/g, '되어야'],
  [/되 어/g, '되어'],
  [/하 는/g, '하는'],
  [/하 여/g, '하여'],
  [/하 고/g, '하고'],
  [/하 며/g, '하며'],
  [/하 면/g, '하면'],
  [/([가-힣A-Za-z0-9)])는한/g, '$1는 한'],
  [/([가-힣A-Za-z0-9)])은한/g, '$1은 한'],
  [/([가-힣A-Za-z0-9)])을한/g, '$1을 한'],
  [/([가-힣A-Za-z0-9)])를한/g, '$1를 한'],
  [/으로한/g, '으로 한'],
  [/속하지않는/g, '속하지 않는'],
  [/해당하지않는/g, '해당하지 않는'],
  [/하지않는/g, '하지 않는'],
  [/되지않/g, '되지 않'],
  [/해야할/g, '해야 할'],
  [/되어야할/g, '되어야 할'],
  [/가져야할/g, '가져야 할'],
  [/하고자할/g, '하고자 할'],
  [/되도록할/g, '되도록 할'],
  [/하도록할/g, '하도록 할'],
  [/발생하게되는/g, '발생하게 되는'],
  [/기반으로한/g, '기반으로 한'],
  [/사용해야하는/g, '사용해야 하는'],
  [/수행해야하는/g, '수행해야 하는'],
  [/의미하는것/g, '의미하는 것'],
  [/하였을때/g, '하였을 때'],
  [/정규화를 하였을때/g, '정규화를 하였을 때'],
  [/스케줄링할 경우/g, '스케줄링 할 경우'],
  [/테스 트/g, '테스트'],
  [/시스 템/g, '시스템'],
  [/데 이터/g, '데이터'],
  [/소프트 웨어/g, '소프트웨어'],
  [/프로그 램/g, '프로그램'],
  [/네트 워크/g, '네트워크'],
  [/인터 페이스/g, '인터페이스'],
  [/릴 레이션/g, '릴레이션'],
  [/트랜 잭션/g, '트랜잭션'],
  [/컴포 넌트/g, '컴포넌트'],
  [/애트 리뷰트/g, '애트리뷰트'],
  [/애튜 리뷰트/g, '애튜리뷰트'],
  [/알고 리즘/g, '알고리즘'],
  [/데이터 베이스/g, '데이터베이스'],
  [/의 미(?=(하|한|를|는|가|로|와|과|이다|임|$))/g, '의미'],
];

const headingEmoji = {
  '문제 유형': '📌',
  '유형 판단 이유': '🔎',
  '문제 핵심': '🎯',
  '핵심 개념': '💡',
  '풀이 전략': '🧭',
  '풀이 과정': '🧩',
  '선택지 분석': '🟦',
  '초보자 실수 포인트': '🚨',
  '암기 팁': '📝',
  '시험 출제 포인트': '⭐',
  '정답': '✅',
  '한 줄 요약': '🔔',
  '문제 분석': '📌',
  '정답 확인': '✅',
  '핵심 포인트': '💡',
};

function normalizeBlankLines(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanQuestionText(text = '') {
  let next = String(text);
  for (const [pattern, replacement] of questionFixes) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function cleanExplanationLine(line) {
  let next = cleanQuestionText(line.trim());

  next = next.replace(/\*\*/g, '');
  next = next.replace(/^[-*]\s+/, '');
  next = next.replace(/^•\s+/, '');
  next = next.replace(/^(\d+)\.\s+/, '$1. ');
  next = next.replace(/^정답:\s*([1-4]번)\s+-\s+/, '정답: $1 ');
  next = next.replace(/^정답 후보:\s*$/, '정답 후보');
  next = next.replace(/^핵심 개념:\s*$/, '핵심 개념');
  next = next.replace(/\s+-\s+/g, ' ');
  next = next.replace(/[ \t]{2,}/g, ' ');

  return next.trim();
}

function formatExplanation(text = '') {
  const raw = normalizeBlankLines(text);
  if (!raw) return '';

  const out = [];
  const lines = raw.split('\n');

  for (const original of lines) {
    const line = original.trim();
    if (!line || line === '---') {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }

    let match = line.match(/^###\s*(.+?)\s*$/);
    if (match) {
      const title = cleanExplanationLine(match[1]);
      if (out.length && out[out.length - 1] !== '') out.push('');
      if (/^[1-4]번$/.test(title)) {
        out.push(`🔸 ${title}`);
      } else {
        out.push(`🔹 ${title}`);
      }
      out.push('');
      continue;
    }

    match = line.match(/^#{2,6}\s*(.+?)\s*$/);
    if (match) {
      const title = cleanExplanationLine(match[1]);
      const emoji = headingEmoji[title] || '📍';
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`${emoji} ${title}`);
      out.push('');
      continue;
    }

    match = line.match(/^\[(.+?)\]\s*$/);
    if (match) {
      const title = cleanExplanationLine(match[1]);
      const emoji = headingEmoji[title] || '📍';
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`${emoji} ${title}`);
      out.push('');
      continue;
    }

    match = line.match(/^(\d+단계)\s*$/);
    if (match) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`🔹 ${match[1]}`);
      out.push('');
      continue;
    }

    match = line.match(/^([1-4]번)\s*$/);
    if (match) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`🔸 ${match[1]}`);
      out.push('');
      continue;
    }

    const cleaned = cleanExplanationLine(line);
    if (cleaned) out.push(cleaned);
  }

  return normalizeBlankLines(out.join('\n'));
}

function hasMarkdownNoise(text = '') {
  return /(^|\n)\s*#{2,6}\s|(^|\n)\s*---\s*($|\n)|\*\*/.test(String(text));
}

const report = ['정보처리기사 문제 원문 및 해설 최종 정리 보고서', ''];
let changedQuestions = 0;
let changedExplanations = 0;
let changedFiles = 0;

for (const file of TARGET_FILES) {
  const fullPath = path.join(DATA_DIR, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const questions = data.questions || [];
  let fileChanged = false;
  let fileQuestionChanges = 0;
  let fileExplanationChanges = 0;

  for (const question of questions) {
    let questionChanged = false;

    if (typeof question.stem === 'string') {
      const nextStem = cleanQuestionText(question.stem);
      if (nextStem !== question.stem) {
        question.stem = nextStem;
        questionChanged = true;
      }
    }

    if (Array.isArray(question.options)) {
      const nextOptions = question.options.map((option) => cleanQuestionText(option));
      if (JSON.stringify(nextOptions) !== JSON.stringify(question.options)) {
        question.options = nextOptions;
        questionChanged = true;
      }
    }

    if (typeof question.explanation === 'string') {
      const nextExplanation = formatExplanation(question.explanation);
      if (nextExplanation !== question.explanation) {
        question.explanation = nextExplanation;
        fileExplanationChanges += 1;
        changedExplanations += 1;
        fileChanged = true;
      }
    }

    if (questionChanged) {
      fileQuestionChanges += 1;
      changedQuestions += 1;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    changedFiles += 1;
  }

  const markdownLeft = questions.filter((question) => hasMarkdownNoise(question.explanation)).length;
  report.push(`${file}: 문제 문자 수정 ${fileQuestionChanges}문항, 해설 변환 ${fileExplanationChanges}문항, 마크다운 잔여 ${markdownLeft}문항`);
}

report.push('');
report.push(`수정된 문제 문자 문항 수: ${changedQuestions}`);
report.push(`변환된 해설 문항 수: ${changedExplanations}`);
report.push(`수정된 파일 수: ${changedFiles}`);

fs.writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
console.log(report.join('\n'));
