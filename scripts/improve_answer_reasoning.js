const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'answer_reasoning_report.txt');

const TARGET_FILES = fs.readdirSync(DATA_DIR)
  .filter((file) => /^(exam_|category_).+\.json$/.test(file))
  .filter((file) => !['categories_index.json', 'exams_index.json', 'cbt_store.json'].includes(file));

function normalize(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compact(text = '', max = 110) {
  const one = String(text).replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  return one.slice(0, max).trim();
}

function answerText(question) {
  const index = Number(question.answer) - 1;
  if (!Array.isArray(question.options) || index < 0 || index >= question.options.length) return '';
  return String(question.options[index]).trim();
}

function isNegativeQuestion(stem = '') {
  return /(틀린 것은|맞지 않은 것은|아닌 것은|옳지 않은 것은|해당하지 않는|볼 수 없는|없는 것은|잘못된 것은|적절하지 않은|거리가 먼 것은|아닌|틀린)/.test(stem);
}

function extractReason(explanation = '') {
  const reason = String(explanation).match(/정답 이유 한 줄 요약:\s*([^\n]+)/);
  if (reason) return compact(reason[1], 130);

  const core = String(explanation).match(/핵심 개념\s*\n([^\n]+)/);
  if (core) return compact(core[1], 130);

  const first = String(explanation)
    .split('\n')
    .map((line) => compact(line, 130))
    .find((line) => line && !/^(✅|🔔|📖|🧠|🟦|⚠️|📝|📌|🔹|🔸|정답:|정답 보기|오답 보기)/.test(line));
  return first || '정답 기준과 문제 조건을 비교해야 한다.';
}

function optionReason(question, option, index, reason) {
  const num = index + 1;
  const isAnswer = num === Number(question.answer);
  const negative = isNegativeQuestion(question.stem || '');
  const label = isAnswer ? '정답 보기' : '오답 보기';
  const optionText = compact(option, 120);

  if (isAnswer && negative) {
    return `${label}: ${optionText}\n왜 정답: 문제에서 틀린 설명이나 해당하지 않는 것을 고르라고 했고, 이 보기가 그 조건에 해당한다.\n판단 근거: ${reason}`;
  }
  if (isAnswer) {
    return `${label}: ${optionText}\n왜 정답: 문제에서 묻는 핵심 조건과 이 보기가 일치한다.\n판단 근거: ${reason}`;
  }
  if (negative) {
    return `${label}: ${optionText}\n왜 오답: 이 보기는 틀린 설명이 아니라 올바른 설명 쪽에 가까워서, 문제에서 요구한 답이 아니다.\n판단 근거: ${reason}`;
  }
  return `${label}: ${optionText}\n왜 오답: 정답 기준과 다른 개념이거나 문제 조건을 만족하지 않는다.\n판단 근거: ${reason}`;
}

function buildOptionBlock(question) {
  if (!Array.isArray(question.options) || !question.options.length) return '';
  const reason = extractReason(question.explanation);
  return question.options
    .map((option, index) => optionReason(question, option, index, reason))
    .join('\n');
}

function replaceBetween(text, headingPattern, nextPattern, replacement) {
  const match = text.match(headingPattern);
  if (!match || match.index == null) return text;
  const start = match.index;
  const bodyStart = start + match[0].length;
  const rest = text.slice(bodyStart);
  const next = rest.search(nextPattern);
  const end = next >= 0 ? bodyStart + next : text.length;
  return normalize(`${text.slice(0, bodyStart)}\n${replacement.trim()}\n\n${text.slice(end).replace(/^\n+/, '')}`);
}

function improveExplanation(question) {
  const block = buildOptionBlock(question);
  if (!block) return question.explanation;

  let text = String(question.explanation || '');

  if (text.includes('🟦 보기 제거')) {
    return replaceBetween(text, /🟦 보기 제거\s*\n?/, /\n(?:⚠️ 함정 포인트|📝 시험 암기법|✅ 정답|📌|🔔|$)/, block);
  }

  if (text.includes('🟦 선택지 분석')) {
    return replaceBetween(text, /🟦 선택지 분석\s*\n?/, /\n(?:🚨 초보자 실수 포인트|📝 암기 팁|⭐ 시험 출제 포인트|✅ 정답|🔔 한 줄 요약|$)/, block);
  }

  const answerSection = text.match(/\n✅ 정답/);
  if (answerSection && answerSection.index != null) {
    return normalize(`${text.slice(0, answerSection.index)}\n\n🟦 선택지 분석\n\n${block}\n\n${text.slice(answerSection.index + 1)}`);
  }

  return normalize(`${text}\n\n🟦 선택지 분석\n\n${block}`);
}

const report = ['정보처리기사 정답/오답 이유 보강 보고서', ''];
let changedQuestions = 0;
let changedFiles = 0;

for (const file of TARGET_FILES) {
  const fullPath = path.join(DATA_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions;
  if (!Array.isArray(questions)) continue;

  let fileChanged = 0;
  for (const question of questions) {
    if (typeof question.explanation !== 'string') continue;
    const next = improveExplanation(question);
    if (next !== question.explanation) {
      question.explanation = next;
      fileChanged += 1;
      changedQuestions += 1;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    changedFiles += 1;
  }
  report.push(`${file}: ${fileChanged}문항 보강`);
}

report.push('');
report.push(`총 보강 문항: ${changedQuestions}`);
report.push(`수정 파일 수: ${changedFiles}`);

fs.writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
console.log(report.join('\n'));
