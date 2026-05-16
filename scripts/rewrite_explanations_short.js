#!/usr/bin/env node
/**
 * 해설을 짧고 이해하기 쉽게 재생성 (Claude Haiku)
 * 사용: node scripts/rewrite_explanations_short.js [파일패턴]
 * 예:   node scripts/rewrite_explanations_short.js exam_2024
 *       node scripts/rewrite_explanations_short.js  (전체)
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');
const glob = require('fs');

const client = new Anthropic();
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONCURRENCY = 5;   // 동시 요청 수
const DELAY_MS    = 200; // 요청 간 딜레이

// 이미 새 형식으로 교체된 것은 건너뜀 (길이 기준)
const MAX_LEN = 400;

const SYSTEM = `너는 정보처리기사 시험 해설 작성 전문가야. 주어진 문제의 해설을 초간결하게 다시 써줘.

규칙:
1. 핵심 개념 1~2줄: 정답이 정답인 이유를 쉬운 말로
2. 오답 보기들이 왜 틀렸는지 1줄 (꼭 필요할 때만)
3. 계산 문제면 계산 단계를 간결히 (예: 4×8=32, 32÷4=8)
4. 이모지, 섹션 제목(🔔🧩📌 등), 단계 구분(1단계 2단계), 반복 문장 절대 금지
5. 전체 4줄 이내, 각 줄 60자 이내
6. 한국어로`;

function makePrompt(q) {
  const opts = (q.options || []).map((o, i) => `  ${i+1}. ${o}`).join('\n');
  const ans  = q.answer;
  return `문제: ${q.stem}\n선택지:\n${opts}\n정답: ${ans}번\n\n해설 (4줄 이내):`;
}

async function rewriteOne(q) {
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: makePrompt(q) }],
  });
  return resp.content[0].text.trim();
}

async function processFile(filePath) {
  const raw  = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const qs   = data.questions || [];
  if (!qs.length) return;

  const toRewrite = qs.filter(q => q.explanation && q.explanation.length > MAX_LEN);
  if (!toRewrite.length) {
    console.log(`  skip (이미 처리됨): ${path.basename(filePath)}`);
    return;
  }

  console.log(`\n[${path.basename(filePath)}] ${toRewrite.length}개 재생성 시작...`);
  let done = 0;

  // CONCURRENCY 단위로 배치 처리
  for (let i = 0; i < toRewrite.length; i += CONCURRENCY) {
    const batch = toRewrite.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async q => {
      try {
        q.explanation = await rewriteOne(q);
        done++;
        if (done % 10 === 0 || done === toRewrite.length) {
          process.stdout.write(`\r  ${done}/${toRewrite.length}`);
        }
      } catch (e) {
        console.error(`\n  오류 Q${q.qnum}:`, e.message);
      }
    }));
    if (i + CONCURRENCY < toRewrite.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n  완료: ${path.basename(filePath)}`);
}

async function main() {
  const pattern = process.argv[2] || '';
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f.includes(pattern) &&
                 (f.startsWith('exam_') || f.startsWith('category_')))
    .map(f => path.join(DATA_DIR, f))
    .sort();

  if (!files.length) { console.log('해당 파일 없음'); return; }

  console.log(`총 ${files.length}개 파일 처리 시작`);
  for (const f of files) {
    await processFile(f);
  }
  console.log('\n✅ 전체 완료');
}

main().catch(e => { console.error(e); process.exit(1); });
