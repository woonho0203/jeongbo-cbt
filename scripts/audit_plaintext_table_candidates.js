#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const failOnCandidates = args.includes('--fail-on-candidates');
const asJson = args.includes('--json');
const showKnown = args.includes('--show-known');
const explicitFiles = args.filter(arg => !arg.startsWith('--'));
const dataDir = 'data';
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
const knownNormal = new Map([
  ['exam_2017-1.json#89', 'HDLC 프레임 순서 보기 나열이며 PDF 원본에 표 구조 없음(2026-07-26 렌더 확인)'],
  ['exam_2017-2.json#26', '0-주소 명령어 프로그램 목록으로 줄바꿈 복원 완료, PDF 원본에 표 구조 없음(2026-07-26 렌더 확인)'],
  ['exam_2018-2.json#30', '약어 설명과 마이크로 오퍼레이션 보기 나열이며 PDF 원본에 표 구조 없음(2026-07-26 렌더 확인)'],
  ['exam_2019-2.json#94', 'HDLC 프레임 순서 보기 나열이며 PDF 원본에 표 구조 없음(2026-07-26 렌더 확인)'],
]);

function normalizeSpace(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function hasMedia(q) {
  return Boolean(q.image || q.table);
}

function hasTableField(q) {
  return Boolean(q.table);
}

function tableCue(text) {
  return /((?:다음|아래|위)\s*(?:도표|표|테이블|릴레이션|상태표|진리표|결과표|스케줄링표|페이지\s*참조\s*열)(?:에서|의|를|을|에|는|와|과|\s|$)|(?:도표|표|테이블|릴레이션|상태표|진리표|결과표)\s*와\s*같(?:은|이))/.test(text);
}

function likelyCode(text) {
  return /#include|int\s+main|public\s+class|static\s+void|System\.out|printf|scanf|for\s*\(|while\s*\(|if\s*\(|else\s*\{|return\s+|String\s*=|input\s*\(|print\s*\(|SELECT\s+|FROM\s+|WHERE\s+|GROUP\s+BY|ORDER\s+BY|CREATE\s+TABLE/i.test(text);
}

function columnRows(text) {
  const rows = String(text || '')
    .split(/\n+/)
    .map(row => row.trim())
    .filter(Boolean);

  return rows.filter(row => {
    if (row.length < 5) return false;
    if (/^[①②③④⑤]/.test(row)) return false;
    if (/^[-*]\s/.test(row)) return false;
    if (/^\d+\.\s/.test(row)) return false;

    const hardColumns = row.split(/\t+|\s{2,}|[|│┃]/).map(s => s.trim()).filter(Boolean);
    if (hardColumns.length >= 2) return true;

    const unitValues = row.match(/\b\d+(?:\.\d+)?\s*(?:K|M|G|T)?B?\b|[0-9]+(?:초|ms|개|회|점|명|원)/g) || [];
    const labels = row.match(/[가-힣A-Za-z][가-힣A-Za-z0-9()/_-]{0,10}/g) || [];
    return unitValues.length >= 3 && labels.length >= 2;
  });
}

function inlineTableSigns(text) {
  const compact = normalizeSpace(text);
  const repeatedLabeledValues = compact.match(/(?:[가-힣A-Za-zⓐ-ⓩ]\s*[:=]\s*[^,;]+[,;]\s*){2,}/g) || [];
  const circledRows = compact.match(/[ⓐ-ⓩ]\s*[:=]?\s*\d+(?:\.\d+)?\s*(?:K|M|G|T)?B?/g) || [];
  const processRows = compact.match(/\bP\d+\s+\d+\s+\d+/g) || [];
  return repeatedLabeledValues.length || circledRows.length >= 3 || processRows.length >= 3;
}

function inspectQuestion(file, q) {
  const stem = String(q.stem || '');
  const options = Array.isArray(q.options) ? q.options.join('\n') : '';
  const combined = `${stem}\n${options}`;
  const stemNorm = normalizeSpace(stem);
  const combinedNorm = normalizeSpace(combined);

  if (hasTableField(q)) return null;

  const reasons = [];
  const rows = columnRows(stem);

  if (!hasMedia(q) && tableCue(stemNorm)) {
    reasons.push('표 단서가 있으나 image/table 필드 없음');
  }
  if (!hasMedia(q) && rows.length >= 2 && !likelyCode(stemNorm)) {
    reasons.push(`행·열 형태 줄 ${rows.length}개`);
  }
  if (!hasMedia(q) && inlineTableSigns(stemNorm) && !likelyCode(stemNorm)) {
    reasons.push('인라인 표 값 나열 의심');
  }

  if (!reasons.length) return null;

  return {
    file,
    qnum: q.qnum,
    reasons,
    preview: combinedNorm.slice(0, 180),
  };
}

function sourceFiles() {
  if (explicitFiles.length) {
    return explicitFiles.map(file => file.startsWith(dataDir + path.sep) ? path.basename(file) : file);
  }
  return fs.readdirSync(dataDir)
    .filter(file => /^(exam|category)_.*\.json$/.test(file) && !skip.has(file))
    .sort();
}

const candidates = [];
const known = [];

for (const file of sourceFiles()) {
  const fullPath = path.join(dataDir, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions || [];
  for (const q of questions) {
    const candidate = inspectQuestion(file, q);
    if (!candidate) continue;
    const key = `${file}#${q.qnum}`;
    if (knownNormal.has(key)) {
      known.push({ ...candidate, note: knownNormal.get(key) });
    } else {
      candidates.push(candidate);
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ candidates, known, count: candidates.length, knownCount: known.length }, null, 2));
} else if (candidates.length) {
  console.log('PDF 표-텍스트 평탄화 후보:');
  for (const item of candidates) {
    console.log(`${item.file} Q${item.qnum}: ${item.reasons.join(', ')}`);
    console.log(`  ${item.preview}`);
  }
  console.log(`\n합계 ${candidates.length}건`);
  console.log('주의: 후보는 자동 확정이 아니다. 자기 독립 원본 PDF를 대조해 table/image 복원 또는 정상 예외를 결정한다.');
} else {
  console.log('PDF 표-텍스트 평탄화 후보 없음');
}

if (showKnown && known.length && !asJson) {
  console.log('\n확인 완료 정상 예외:');
  for (const item of known) {
    console.log(`${item.file} Q${item.qnum}: ${item.note}`);
  }
  console.log(`합계 ${known.length}건`);
}

if (failOnCandidates && candidates.length) process.exit(1);
