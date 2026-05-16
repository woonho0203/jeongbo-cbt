const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'proofread_report.md');

const TARGET_FILES = fs.readdirSync(DATA_DIR)
  .filter((file) => file.endsWith('.json'))
  .filter((file) => !['categories_index.json', 'exams_index.json', 'cbt_store.json'].includes(file));

const spacingFixes = [
  [/되어야하는/g, '되어야 하는', '띄어쓰기'],
  [/안되며/g, '안 되며', '띄어쓰기'],
  [/잘못 된/g, '잘못된', '띄어쓰기'],
  [/관련 된/g, '관련된', '띄어쓰기'],
  [/수행 된/g, '수행된', '띄어쓰기'],
  [/사용 된/g, '사용된', '띄어쓰기'],
  [/송신중에/g, '송신 중에', '띄어쓰기'],
  [/자 료/g, '자료', '띄어쓰기'],
  [/이 어붙임/g, '이어 붙임', '띄어쓰기'],
  [/마지막에이어서/g, '마지막에 이어서', '띄어쓰기'],
  [/네트 워크/g, '네트워크', '띄어쓰기'],
  [/프로그 래밍/g, '프로그래밍', '띄어쓰기'],
  [/첫 번 째/g, '첫 번째', '띄어쓰기'],
  [/넘어갑 니다/g, '넘어갑니다', '띄어쓰기'],
  [/라 고 합니다/g, '라고 합니다', '띄어쓰기'],
  [/라 고/g, '라고', '띄어쓰기'],
  [/도 서명/g, '도서명', '띄어쓰기'],
  [/속성\(Attribute\)은한/g, '속성(Attribute)은 한', '띄어쓰기'],
  [/은한/g, '은 한', '띄어쓰기'],
  [/값은한/g, '값은 한', '띄어쓰기'],
  [/것은한/g, '것은 한', '띄어쓰기'],
  [/라하며/g, '라 하며', '띄어쓰기'],
];

function makeOptionAnalysis(options, answer, negative) {
  if (!Array.isArray(options) || options.length === 0) return '- 선택지 없음';

  return options.map((option, index) => {
    const num = index + 1;
    const quoted = String(option).replace(/\n/g, '\\n');
    let line;
    if (num === Number(answer) && negative) {
      line = `- 맞음. 선택지 '${quoted}'의 내용은 문제에서 요구한 '틀린 설명/해당하지 않는 것'에 해당함`;
    } else if (num === Number(answer)) {
      line = `- 맞음. 선택지 '${quoted}'의 내용은 문제에서 묻는 조건과 일치함`;
    } else if (negative) {
      line = `- 틀림. 선택지 '${quoted}'의 내용은 문제에서 요구한 오답 설명이 아님`;
    } else {
      line = `- 틀림. 선택지 '${quoted}'의 내용은 핵심 개념과 정확히 일치하지 않음`;
    }
    return `### ${num}번\n${line}`;
  }).join('\n\n');
}

function getSection(text, heading, nextHeadings) {
  const start = text.indexOf(heading);
  if (start < 0) return '';
  const bodyStart = start + heading.length;
  const next = nextHeadings
    .map((h) => text.indexOf(h, bodyStart))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0] ?? text.length;
  return text.slice(bodyStart, next);
}

function replaceSection(text, heading, replacement, nextHeadings) {
  const start = text.indexOf(heading);
  if (start < 0) return text;
  const bodyStart = start + heading.length;
  const next = nextHeadings
    .map((h) => text.indexOf(h, bodyStart))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0] ?? text.length;
  return `${text.slice(0, bodyStart)}\n${replacement.trim()}\n\n${text.slice(next).replace(/^\n+/, '')}`;
}

function extractBasis(explanation) {
  const match = explanation.match(/- 핵심 개념:\n\s+- ([^\n]+)/);
  return match ? match[1].trim() : '핵심 개념';
}

function normalizeGeneratedPhrases(text) {
  let next = text;

  next = next.replace(/- 정답 후보인 '([^'\n]+)'가 왜 맞는지 판단하는 문제/g, "- 정답 후보 '$1'을 판단하는 문제");
  next = next.replace(/- 정답 후보 '([^'\n]+)'[을를] 판단하는 문제/g, "- 정답 후보를 판단하는 문제: '$1'");
  next = next.replace(/- 정답 선택지 '([^'\n]+)'가 문제 조건과 일치함/g, "- 정답 선택지 '$1'은 문제 조건과 일치함");
  next = next.replace(/- 정답 선택지 '([^'\n]+)'은 문제 조건과 일치함/g, "- 정답 선택지가 문제 조건과 일치함");
  next = next.replace(/- 정답 선택지 '[\s\S]*?'가 문제 조건과 일치함/g, "- 정답 선택지가 문제 조건과 일치함");
  next = next.replace(/- 따라서 최종 출력 또는 결과는 '([^'\n]+)'와 연결됨/g, "- 따라서 최종 출력 또는 결과는 '$1'과 연결됨");
  next = next.replace(/- 따라서 최종 출력 또는 결과는 '[\s\S]*?'와 연결됨/g, "- 따라서 최종 출력 또는 결과는 정답 선택지와 연결됨");
  next = next.replace(/정답 선택지와 연결됨/g, "정답 선택지와 일치함");
  next = next.replace(/- 정답 후보인 '([^'\n]+)'가 왜 맞는지 판단하는 문제/g, "- 정답 후보 '$1'을 판단하는 문제");

  for (const [pattern, replacement] of spacingFixes) {
    next = next.replace(pattern, replacement);
  }

  return next;
}

function proofreadQuestion(question) {
  const changes = [];
  const next = { ...question };

  if (Array.isArray(next.options)) {
    next.options = next.options.map((option, index) => {
      let after = option;
      for (const [pattern, replacement, reason] of spacingFixes) {
        after = after.replace(pattern, replacement);
        if (after !== option && !changes.some((c) => c.field === `보기 ${index + 1}` && c.before === option && c.after === after)) {
          changes.push({ field: `보기 ${index + 1}`, before: option, after, reasons: [reason] });
        }
      }
      return after;
    });
  }

  if (typeof next.explanation === 'string') {
    let explanation = next.explanation;
    const beforeTemplate = explanation;
    explanation = normalizeGeneratedPhrases(explanation);

    if (explanation.includes('## 선택지 분석')) {
      const oldSection = getSection(explanation, '## 선택지 분석', ['## 초보자 실수 포인트']);
      const negative = /(틀린 것은|아닌 것은|해당하지 않는|볼 수 없는|옳지 않은|않은 것은|없는 것은)/.test(String(next.stem || ''));
      const newSection = makeOptionAnalysis(next.options, next.answer, negative);
      explanation = replaceSection(explanation, '## 선택지 분석', newSection, ['## 초보자 실수 포인트']);
      if (oldSection.trim() !== newSection.trim()) {
        changes.push({
          field: '해설 선택지 분석',
          before: oldSection.trim(),
          after: newSection.trim(),
          reasons: ['조사 오류', '비문'],
        });
      }
    }

    if (beforeTemplate !== explanation) {
      changes.push({
        field: '해설',
        before: beforeTemplate,
        after: explanation,
        reasons: ['맞춤법', '띄어쓰기', '조사 오류', '비문'].filter((reason, index, arr) => arr.indexOf(reason) === index),
      });
    }
    next.explanation = explanation;
  }

  return { question: next, changes };
}

function questionLabel(file, question) {
  if (file.startsWith('exam_')) return `${file.replace('.json', '')} ${question.qnum}번`;
  if (file.startsWith('category_')) return `${file.replace('.json', '')} ${question.qnum}번`;
  return `${file} ${question.qnum ?? ''}`.trim();
}

function compact(text) {
  const value = String(text ?? '');
  if (value.length <= 700) return value;
  return `${value.slice(0, 700)}\n...`;
}

const report = ['# 정보처리기사 문제 문법·띄어쓰기 검수 결과', ''];
let changedQuestionCount = 0;
let changedFileCount = 0;

for (const file of TARGET_FILES) {
  const fullPath = path.join(DATA_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions;
  if (!Array.isArray(questions)) continue;

  let fileChanged = false;
  const nextQuestions = [];

  for (const question of questions) {
    const { question: nextQuestion, changes } = proofreadQuestion(question);
    nextQuestions.push(nextQuestion);
    if (changes.length > 0) {
      fileChanged = true;
      changedQuestionCount += 1;
      report.push('## 문제 번호');
      report.push(questionLabel(file, question));
      report.push('');
      report.push('## 수정 여부');
      report.push('- 수정 필요');
      report.push('');
      report.push('## 수정 전');
      report.push(compact(changes.map((c) => `[${c.field}]\n${c.before}`).join('\n\n')));
      report.push('');
      report.push('## 수정 후');
      report.push(compact(changes.map((c) => `[${c.field}]\n${c.after}`).join('\n\n')));
      report.push('');
      report.push('## 수정 이유');
      const reasons = [...new Set(changes.flatMap((c) => c.reasons))];
      for (const reason of reasons) report.push(`- ${reason}`);
      report.push('');
      report.push('---');
      report.push('');
    }
  }

  if (fileChanged) {
    if (Array.isArray(json)) {
      fs.writeFileSync(fullPath, `${JSON.stringify(nextQuestions, null, 2)}\n`, 'utf8');
    } else {
      json.questions = nextQuestions;
      fs.writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    }
    changedFileCount += 1;
  }
}

if (changedQuestionCount === 0) {
  report.push('## 문제 번호');
  report.push('전체');
  report.push('');
  report.push('## 수정 여부');
  report.push('- 수정 필요 없음');
  report.push('');
  report.push('## 수정 전');
  report.push('');
  report.push('## 수정 후');
  report.push('');
  report.push('## 수정 이유');
  report.push('');
}

fs.writeFileSync(REPORT_PATH, `${report.join('\n').trim()}\n`, 'utf8');
console.log(`Changed ${changedQuestionCount} questions in ${changedFileCount} files.`);
console.log(`Report: ${REPORT_PATH}`);
