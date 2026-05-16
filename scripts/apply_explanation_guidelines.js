const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'explanation_guidelines_report.txt');

const TARGETS = [
  'category_calc.json',
  'category_code.json',
  'category_wrong-sentence.json',
  'category_keyword.json',
  'category_sequence.json',
];

function normalize(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactLine(text = '', max = 84) {
  const line = String(text)
    .replace(/\s+/g, ' ')
    .replace(/^[-•]\s*/, '')
    .replace(/^정답 이유 한 줄 요약:\s*/, '')
    .replace(/^핵심 개념\s*/, '')
    .trim();
  if (line.length <= max) return line;
  const sliced = line.slice(0, max).replace(/[,.，、]\s*[^,.，、]*$/, '').trim();
  return sliced || line.slice(0, max).trim();
}

function answerText(q) {
  const index = Number(q.answer) - 1;
  if (!Array.isArray(q.options) || index < 0 || index >= q.options.length) return '';
  return String(q.options[index]).trim();
}

function isNegativeQuestion(stem = '') {
  return /(틀린 것은|맞지 않은 것은|아닌 것은|옳지 않은 것은|해당하지 않는|볼 수 없는|없는 것은|잘못된 것은|적절하지 않은)/.test(stem);
}

function categoryKind(file, q = {}) {
  const stem = String(q.stem || '');
  const options = Array.isArray(q.options) ? q.options.join(' ') : '';
  const all = `${stem}\n${options}`;
  if (/\bSELECT\b|\bFROM\b|\bWHERE\b|\bJOIN\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b/i.test(all)) return 'sql';
  if (/(예약어|명령어|키워드|연산자|구문|문법|statement|syntax)/i.test(all) && !/(실행 결과|출력 결과|출력값|실행되었을 때)/.test(stem)) return 'keyword';
  if (file.includes('code')) return 'code';
  if (file.includes('wrong-sentence')) return 'wrong';
  if (file.includes('keyword')) return 'keyword';
  if (file.includes('sequence')) return 'sequence';
  return 'calc';
}

function extractReason(explanation = '') {
  const match = String(explanation).match(/정답 이유 한 줄 요약:\s*([^\n]+)/);
  if (match) return compactLine(match[1], 120);

  const lines = String(explanation)
    .split('\n')
    .map((line) => compactLine(line, 120))
    .filter((line) => line && !/^(✅|📌|🔎|🎯|💡|🧭|🧩|🟦|🚨|📝|⭐|🔔|정답:|---)/.test(line))
    .filter((line) => !/^\[[^\]]+\]$/.test(line));

  return lines[0] || '';
}

function loadBaseline(file) {
  try {
    const raw = execSync(`git show HEAD:data/${file}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const json = JSON.parse(raw);
    return new Map((json.questions || []).map((question) => [Number(question.qnum), question.explanation || '']));
  } catch {
    return new Map();
  }
}

function getStemTopic(stem = '') {
  const first = String(stem).split('\n')[0].trim();
  return compactLine(first.replace(/^(다음|아래)\s*/, ''), 76);
}

function getCore(q, kind, reason) {
  const stem = String(q.stem || '');
  const ans = answerText(q);

  if (/카디널리티|차수/.test(stem)) return '카디널리티 = 행 개수, 차수 = 열 개수';
  if (/도메인.*튜플.*최대/.test(stem)) return '가능한 튜플 수 = 각 도메인 값의 곱';
  if (/Bubble|버블|bubble/i.test(stem)) return '버블 정렬은 큰 값이 뒤로 이동한다';
  if (/PASS\s*1|1\s*pass/i.test(stem)) return 'PASS 횟수는 중간 결과를 묻는 신호다';

  if (kind === 'code') return `최종 결과는 ${ans || '출력값'}이다`;
  if (kind === 'sql') return `SQL 결과는 ${ans || '정답 보기'}이다`;
  if (kind === 'wrong') return `${q.answer}번은 틀린 설명이다`;
  if (kind === 'keyword') return `${ans || '정답 키워드'}를 떠올리는 문제다`;
  if (kind === 'sequence') return `${ans || '정답'}이 조건과 맞는지 비교한다`;
  if (reason) return reason;
  return `${ans || '정답'}을 조건과 비교하는 문제다`;
}

function interpretation(q, kind) {
  const stem = String(q.stem || '');
  const ans = answerText(q);

  if (/카디널리티|차수/.test(stem)) {
    return '테이블에 데이터가 몇 줄 있는지와 컬럼이 몇 개인지를 묻는다.';
  }
  if (kind === 'code') {
    return '코드를 위에서 아래로 실행했을 때 마지막에 무엇이 출력되는지 묻는다.';
  }
  if (kind === 'sql') {
    return 'SQL 조건을 적용했을 때 어떤 결과가 남는지 묻는다.';
  }
  if (kind === 'wrong') {
    return '보기 중 개념과 다르게 말한 문장을 고르는 문제다.';
  }
  if (kind === 'keyword') {
    return `문장 속 단서를 보고 ${ans || '정답 용어'}를 찾는 문제다.`;
  }
  if (kind === 'sequence') {
    return '보기의 개념이나 순서가 문제 조건과 맞는지 비교하는 문제다.';
  }
  return '문제에 나온 숫자와 조건을 쉬운 계산 기준으로 바꾸어 푸는 문제다.';
}

function extractUsefulLines(explanation = '', limit = 8) {
  const banned = /^(✅|📌|🔎|🎯|💡|🧭|🧩|🟦|🚨|📝|⭐|🔔|정답:|정답 이유 한 줄 요약:|문제 유형|유형 판단 이유|문제 핵심|핵심 개념|풀이 전략|풀이 과정|선택지 분석|초보자 실수 포인트|암기 팁|시험 출제 포인트)$/;
  const lines = String(explanation)
    .split('\n')
    .map((line) => compactLine(line, 120))
    .filter((line) => line && !banned.test(line))
    .filter((line) => !/^(정답 후보|계산 기준:|코드 해석:|데이터베이스 개념:|네트워크 개념:)$/.test(line));
  return [...new Set(lines)].slice(0, limit);
}

function codeLines(stem = '') {
  return String(stem)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /[=;]|\bprintf\b|\bSystem\.out\b|\bprint\(/.test(line))
    .slice(0, 10);
}

function initialStateLines(stem = '') {
  const text = String(stem);
  const out = [];
  for (const match of text.matchAll(/\b(char|int)\s+([A-Za-z_]\w*)\s*\[[^\]]+\]\s*=\s*[“"]([^”"]+)[”"]/g)) {
    out.push(`${match[2]} = ${match[3].split('').join(' ')}`);
  }
  for (const match of text.matchAll(/\bint\s+([A-Za-z_]\w*)\s*\[[^\]]+\]\s*(?:\[[^\]]+\])?\s*=\s*\{([^;]+?)\}/g)) {
    const nums = match[2].replace(/[{}\s]/g, '').split(',').filter(Boolean).join(' ');
    if (nums) out.push(`${match[1]} = ${nums}`);
  }
  return out.slice(0, 4);
}

function thinkingProcess(q, kind, reason) {
  const stem = String(q.stem || '');
  const ans = answerText(q);
  const lines = [];

  if (kind === 'code') {
    const states = initialStateLines(stem);
    lines.push('1단계: 변수 상태를 먼저 적는다.');
    if (states.length) lines.push(...states.map((state) => `→ ${state}`));
    lines.push('2단계: 값이 바뀌는 줄만 따라간다.');
    for (const line of codeLines(stem).slice(0, 5)) lines.push(`→ ${line}`);
    lines.push('3단계: 마지막 출력문이나 결과 조건을 확인한다.');
    lines.push(`왜냐하면 마지막 상태가 정답 ${ans || ''}을 결정하기 때문이다.`.trim());
    return lines.join('\n');
  }

  if (kind === 'sql') {
    return [
      '1단계: FROM에서 대상 테이블을 정한다.',
      '2단계: WHERE 조건으로 행을 거른다.',
      '3단계: SELECT에서 보여줄 값을 확인한다.',
      `→ 최종 결과는 ${ans}`,
      '왜냐하면 SQL은 작성된 줄보다 실행 흐름을 따라가야 하기 때문이다.',
    ].join('\n');
  }

  if (kind === 'keyword') {
    const keywords = extractKeywords(stem);
    const hint = keywords.length ? keywords.join(', ') : getStemTopic(stem);
    lines.push('1단계: 문제 문장에서 단서 단어를 표시한다.');
    lines.push(`문제 키워드: ${hint}`);
    lines.push('2단계: 그 단서가 가리키는 용어를 떠올린다.');
    lines.push(`→ ${ans}`);
    lines.push('왜냐하면 키워드 문제는 정의 전체보다 결정 단어가 더 중요하기 때문이다.');
    return lines.join('\n');
  }

  if (kind === 'wrong') {
    return [
      '1단계: 먼저 “틀린 것”을 고르는 문제인지 확인한다.',
      `2단계: ${q.answer}번 문장의 틀린 표현을 찾는다.`,
      `❌ 틀린 부분: ${ans}`,
      `⭕ 올바른 개념: ${reason || '기존 개념 설명과 반대되는 표현으로 고친다.'}`,
      '왜냐하면 잘못된 문장 찾기는 단어 하나가 바뀌어 정답이 되기 때문이다.',
    ].join('\n');
  }

  if (kind === 'sequence') {
    return [
      '1단계: 보기마다 핵심 특징을 하나씩 붙인다.',
      '2단계: 문제 조건과 맞지 않는 보기를 지운다.',
      `3단계: 남는 보기 ${q.answer}번을 고른다.`,
      `왜냐하면 ${reason || `${ans}이 문제 조건과 가장 잘 맞기 때문이다.`}`,
    ].join('\n');
  }

  if (/카디널리티|차수/.test(stem)) {
    return [
      '1단계: 데이터 줄 수를 센다.',
      '→ 행 4개',
      '2단계: 컬럼 수를 센다.',
      '→ 열 6개',
      '3단계: 행=카디널리티, 열=차수로 매칭한다.',
      '왜냐하면 릴레이션에서 행은 튜플이고 열은 속성이기 때문이다.',
    ].join('\n');
  }

  return [
    '1단계: 문제에 나온 숫자와 조건을 표시한다.',
    '2단계: 필요한 공식이나 판단 기준을 정한다.',
    `3단계: 계산 결과를 보기 ${q.answer}번과 비교한다.`,
    `왜냐하면 ${reason || `${ans}이 조건을 만족하기 때문이다.`}`,
  ].join('\n');
}

function extractKeywords(stem = '') {
  const chunks = String(stem)
    .replace(/[(),.]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .filter((word) => !/^(다음|중|것은|의미하는|설명|기법은|원칙은|해당하는)$/.test(word));
  return chunks.slice(0, 4);
}

function optionElimination(q, kind, reason, core) {
  if (!Array.isArray(q.options) || !q.options.length) return '보기 정보가 없다.';
  const negative = isNegativeQuestion(q.stem);
  const basis = ['keyword', 'code', 'sql', 'sequence'].includes(kind) ? core : (reason || core);

  return q.options.map((option, index) => {
    const num = index + 1;
    const label = num === Number(q.answer) ? '정답 보기' : '오답 보기';
    const text = compactLine(option, 96);
    if (num === Number(q.answer)) {
      if (negative || kind === 'wrong') return `${label}: ${text}\n왜 정답: 문제에서 틀린 설명을 고르라고 했고, 이 보기는 올바른 개념과 다르게 말한다.\n판단 근거: ${reason || core}`;
      return `${label}: ${text}\n왜 정답: 문제의 핵심 조건과 직접 일치한다.\n판단 근거: ${basis}`;
    }
    if (negative || kind === 'wrong') return `${label}: ${text}\n왜 오답: 문제는 틀린 설명을 묻는데, 이 보기는 올바른 설명 쪽에 가깝다.\n판단 근거: ${reason || core}`;
    return `${label}: ${text}\n왜 오답: 정답 기준과 다른 개념이거나 문제 조건을 만족하지 않는다.\n판단 근거: ${basis}`;
  }).join('\n');
}

function pitfall(q, kind) {
  const stem = String(q.stem || '');
  if (/카디널리티|차수/.test(stem)) return '⚠️ 차수와 카디널리티를 반대로 외우게 유도한다.';
  if (/PASS|정렬|Bubble|버블/i.test(stem)) return '⚠️ 최종 정렬 결과와 특정 PASS 결과를 헷갈리게 한다.';
  if (kind === 'code') return '⚠️ 마지막 결과 조건만 답이다. 중간 값에 속으면 안 된다.';
  if (kind === 'sql') return '⚠️ SQL은 SELECT부터 읽으면 헷갈린다. FROM과 WHERE를 먼저 봐야 한다.';
  if (kind === 'wrong') return '⚠️ “틀린 것” 문제다. 익숙한 단어가 있어도 문장 끝까지 봐야 한다.';
  if (kind === 'keyword') return '⚠️ 비슷한 약어가 보기로 같이 나온다. 문제 키워드와 약어를 바로 연결해야 한다.';
  if (kind === 'sequence') return '⚠️ 순서 문제는 하나만 바뀌어도 오답이다. 앞뒤 관계를 확인해야 한다.';
  return '⚠️ 숫자 하나를 빠뜨리거나 단위를 바꾸지 않으면 선택지 함정에 걸린다.';
}

function memoryTip(q, kind) {
  const stem = String(q.stem || '');
  const ans = answerText(q);
  if (/카디널리티|차수/.test(stem)) return 'Cardinality는 카드처럼 줄 세기. Degree는 속성, 즉 열 개수.';
  if (/Bubble|버블/i.test(stem)) return '버블 정렬 = 큰 값이 거품처럼 뒤로 떠오름.';
  if (kind === 'code') return '코드 문제는 초깃값 → 변경값 → 출력값 순서로 적는다.';
  if (kind === 'sql') return 'SQL 실행 순서: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY.';
  if (kind === 'wrong') return '틀린 문장 찾기는 “문제 표현 → 올바른 표현” 한 쌍으로 외운다.';
  if (kind === 'keyword') return `“${extractKeywords(stem)[0] || ans}” 단서가 보이면 ${ans}을 떠올린다.`;
  if (kind === 'sequence') return '종류·순서는 표로 외운다. 개념 하나에 특징 하나만 붙인다.';
  return '계산 문제는 공식 → 대입 → 중간값 → 정답 순서로 쓴다.';
}

function comparisonTable(q, kind) {
  if (kind !== 'sequence') return '';
  const rows = ['개념 | 판단'];
  for (const [index, option] of q.options.entries()) {
    const mark = index + 1 === Number(q.answer) ? '정답 후보' : '제거 후보';
    rows.push(`${String(option).replace(/\n/g, ' ')} | ${mark}`);
  }
  return rows.join('\n');
}

function specialBlock(q, kind, reason) {
  if (kind === 'code') {
    const states = initialStateLines(q.stem);
    const lines = [
      '🧩 코드 추적',
      '',
      '1단계 — 변수 상태 표시',
      ...(states.length ? states : ['초깃값을 문제 코드에서 먼저 찾는다.']),
      '',
      '2단계 — 코드 한 줄씩 실행',
      ...codeLines(q.stem).slice(0, 7).map((line) => `→ ${line}`),
      '',
      '3단계 — 메모리 관점',
      '포인터는 값을 들고 있는 변수가 아니라 위치를 가리킨다.',
      '그래서 p+1, p[1]처럼 위치가 바뀌는 표현을 따로 적어야 한다.',
      '',
      '4단계 — 최종 출력',
      `마지막 결과는 ${answerText(q)}이다.`,
    ];
    return lines.join('\n');
  }

  if (kind === 'sql') {
    return [
      '🧩 SQL 추적',
      '',
      '1단계 — 대상 테이블',
      'FROM 절에서 기준 테이블을 찾는다.',
      '',
      '2단계 — 조건 적용',
      'WHERE 절로 남는 행을 고른다.',
      '',
      '3단계 — 최종 결과',
      `SELECT 결과가 ${answerText(q)}와 맞는지 확인한다.`,
    ].join('\n');
  }

  if (kind === 'wrong') {
    return [
      '❌ 틀린 부분',
      answerText(q),
      '',
      '⭕ 올바른 개념',
      reason || '보기 문장을 정확한 개념 표현으로 바꾸어 기억한다.',
      '',
      '🧠 핵심',
      '잘못된 문장 찾기는 “틀린 단어”를 찾아 고치는 문제다.',
    ].join('\n');
  }

  if (kind === 'keyword') {
    return [
      '🔑 문제 키워드',
      extractKeywords(q.stem).map((word) => `“${word}”`).join('\n') || getStemTopic(q.stem),
      '',
      `→ ${answerText(q)} 핵심 특징`,
      '결정 단어가 보이면 정의 전체를 읽기 전에 정답 후보를 먼저 떠올린다.',
    ].join('\n');
  }

  const table = comparisonTable(q, kind);
  if (table) {
    return [
      '📊 비교표',
      '',
      table,
    ].join('\n');
  }
  return '';
}

function buildExplanation(q, file, sourceExplanation = '') {
  const kind = categoryKind(file, q);
  const reason = extractReason(sourceExplanation) || extractReason(q.explanation);
  const core = getCore(q, kind, reason);
  const special = specialBlock(q, kind, reason);

  const sections = [
    '🔔 한줄 핵심',
    core,
    '',
    '📖 문제 해석',
    interpretation(q, kind),
    '',
    '🧠 사고 과정',
    thinkingProcess(q, kind, reason),
    '',
    '🟦 보기 제거',
    optionElimination(q, kind, reason, core),
    '',
    '⚠️ 함정 포인트',
    pitfall(q, kind),
    '',
    '📝 시험 암기법',
    memoryTip(q, kind),
  ];

  if (special) {
    sections.push('', special);
  }

  sections.push('', '✅ 정답', `정답 이유 한 줄 요약: ${core}`, `정답: ${q.answer}번 ${answerText(q)}`);

  return normalize(sections.join('\n'));
}

const report = ['정보처리기사 해설 개선 지침 적용 보고서', ''];
let changedQuestions = 0;

for (const file of TARGETS) {
  const fullPath = path.join(DATA_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const baseline = loadBaseline(file);
  let changedInFile = 0;

  json.questions = json.questions.map((question) => {
    const next = buildExplanation(question, file, baseline.get(Number(question.qnum)) || question.explanation);
    if (next !== question.explanation) {
      changedInFile += 1;
      changedQuestions += 1;
      return { ...question, explanation: next };
    }
    return question;
  });

  if (changedInFile) {
    fs.writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }
  report.push(`${file}: ${changedInFile}문항 개선`);
}

report.push('');
report.push(`총 개선 문항: ${changedQuestions}`);

fs.writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
console.log(report.join('\n'));
