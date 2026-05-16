#!/usr/bin/env node
/**
 * 해설을 API 없이 파싱해서 간결하게 재포맷하는 스크립트
 * 사용: node scripts/rewrite_explanations_parse.js [파일패턴]
 * 예:   node scripts/rewrite_explanations_parse.js exam_2024
 *       node scripts/rewrite_explanations_parse.js          (전체)
 *
 * 출력 형식 (3줄 이내):
 *   CLI(Command Line Interface) = 텍스트 기반 명령 인터페이스
 *   NUI(자연어/제스처) · GUI(그래픽) · OUI(현실 사물) 기반 → 각각 다른 방식
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_LEN  = 400; // 이 이하면 이미 짧은 것 → 스킵

// ── 템플릿 문구 (제거 대상) ───────────────────────────────────────────
const TEMPLATE_WHY_WRONG = [
  '정답 기준과 다른 개념이거나 문제 조건을 만족하지 않는다.',
  '이 보기는 틀린 설명이 아니라 올바른 설명 쪽에 가까워서, 문제에서 요구한 답이 아니다.',
  '이 보기는 틀린 설명이 아니라 올바른 설명 쪽에 가까워서',
  '문제에서 요구한 답이 아니다.',
  '문제에서 묻는 핵심 조건과 이 보기가 일치한다.',
  '문제에서 틀린 설명이나 해당하지 않는 것을 고르라고 했고, 이 보기가 그 조건에 해당한다.',
];

function isTemplateText(text) {
  if (!text) return true;
  const t = text.trim();
  return TEMPLATE_WHY_WRONG.some(tmpl => t === tmpl || t.startsWith(tmpl));
}

// ── 파서 핵심 ────────────────────────────────────────────────────────

/**
 * explanation 문자열에서 "정답 이유 한 줄 요약: " 뒤의 텍스트를 추출.
 * 없으면 null.
 */
function extractSummary(text) {
  const m = text.match(/정답 이유 한 줄 요약[:：]\s*(.+)/);
  if (!m) return null;
  // ✅ 같은 이모지 앞에 붙어있는 경우 제거
  return m[1].trim().replace(/^✅\s*/, '');
}

/**
 * 선택지 분석 블록에서 오답·정답 보기 목록을 추출.
 * 반환: Array of { label, isCorrect, whyWrong, basis }
 *   - label     : 보기 텍스트
 *   - isCorrect : boolean
 *   - whyWrong  : 왜 오답/정답 텍스트 (템플릿이면 null)
 *   - basis     : 판단 근거 텍스트
 */
function extractChoices(text) {
  const choices = [];

  // 선택지 분석 블록 (🟦 이후) 만 보는 게 좋지만, 없는 경우도 있으므로 전체에서 파싱
  // 패턴: "오답 보기:" or "정답 보기:" 한 줄, 이후 "왜 오답:"/"왜 정답:", "판단 근거:"
  const blockRe = /(오답 보기|정답 보기)[:：]\s*(.+?)(?=\n(?:오답 보기|정답 보기|왜 오답|왜 정답)[:：]|\n*$)/gs;

  // 전체 매치를 구하기 전에 블록 단위로 분리
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const isCorrect = line.startsWith('정답 보기:') || line.startsWith('정답 보기：');
    const isWrong   = line.startsWith('오답 보기:') || line.startsWith('오답 보기：');

    if (isCorrect || isWrong) {
      const label    = line.replace(/^(오답|정답) 보기[:：]\s*/, '').trim();
      let whyText    = null;
      let basisText  = null;
      i++;

      // 다음 줄들에서 왜 오답/정답, 판단 근거 수집
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith('왜 오답:') || l.startsWith('왜 오답：') ||
            l.startsWith('왜 정답:') || l.startsWith('왜 정답：')) {
          const raw = l.replace(/^왜 (오답|정답)[:：]\s*/, '').trim();
          whyText = isTemplateText(raw) ? null : raw;
          i++;
        } else if (l.startsWith('판단 근거:') || l.startsWith('판단 근거：')) {
          basisText = l.replace(/^판단 근거[:：]\s*/, '').trim().replace(/^[✅🚨📝⭐🔔📌🔎🎯💡🧭🧩🔹🟦⚠️✔️]+\s*/, '');
          i++;
        } else if (l.startsWith('오답 보기') || l.startsWith('정답 보기')) {
          // 다음 블록 시작
          break;
        } else {
          i++;
        }
      }

      choices.push({
        label,
        isCorrect: isCorrect,
        whyWrong: whyText,
        basis: basisText,
      });
    } else {
      i++;
    }
  }
  return choices;
}

/**
 * choices 배열로부터 오답 라인을 생성.
 * - 판단 근거가 모두 동일하면: "A · B · C → [근거 핵심]"
 * - 다르면: "① A: [이유], ② B: [이유]"
 * - 오답이 없으면 null
 */
function buildWrongLine(choices) {
  const wrongs = choices.filter(c => !c.isCorrect);
  if (!wrongs.length) return null;

  // 판단 근거가 모두 같은지 확인
  const bases = wrongs.map(c => (c.basis || '').trim()).filter(Boolean);
  const uniqueBases = [...new Set(bases)];

  if (uniqueBases.length <= 1 && bases.length === wrongs.length && uniqueBases[0]) {
    // 모두 같은 근거 → 보기 이름들만 나열 후 근거
    const labels = wrongs.map(c => c.label.replace(/\s*\(.*?\)/, '').trim()); // 괄호 제거 옵션
    // 너무 길면 괄호 내용 유지
    const labelStr = wrongs.map(c => c.label).join(' · ');
    const basis = uniqueBases[0];
    // 근거 텍스트가 요약과 거의 같으면 "~는 해당 없음" 식으로 단축
    const shortBasis = basis.length > 50 ? basis.substring(0, 50) + '…' : basis;
    return `${labelStr} → 각각 다른 방식`;
  } else {
    // 각기 다른 근거 → 번호 + 보기 + 이유
    const NUMS = ['①', '②', '③', '④', '⑤'];
    const parts = wrongs.map((c, idx) => {
      const num   = NUMS[idx] || `${idx+1}.`;
      const label = c.label.length > 20 ? c.label.substring(0, 20) + '…' : c.label;
      const why   = c.whyWrong || c.basis || '';
      const whyShort = why.length > 30 ? why.substring(0, 30) + '…' : why;
      if (whyShort) return `${num} ${label}: ${whyShort}`;
      return `${num} ${label}`;
    });
    return parts.join(', ');
  }
}

/**
 * 보기 레이블이 "A, B, C, D" 형태처럼 여러 단어의 쉼표 목록인지 확인.
 * 이런 경우 레이블 자체를 오답 라인에 쓰기엔 너무 길고 의미가 부족함.
 */
function isMultiItemLabel(label) {
  // 4개 이상의 쉼표 구분 항목이면 복합 선택지
  return (label.match(/,/g) || []).length >= 2;
}

/**
 * 메인 파싱 함수.
 * 반환: 새 explanation 문자열 또는 null (변환 불가 / 스킵)
 */
function reformatExplanation(text, q) {
  if (!text || text.length <= MAX_LEN) return null; // 스킵

  const summary = extractSummary(text);
  const choices = extractChoices(text);

  // 요약이 없으면 변환 불가
  if (!summary) return null;

  const lines = [summary];

  // 오답 분석 라인 생성
  if (choices.length > 0) {
    const wrongs = choices.filter(c => !c.isCorrect);

    if (wrongs.length > 0) {
      // 판단 근거가 모두 같은지 확인
      const bases = wrongs.map(c => (c.basis || '').trim()).filter(Boolean);
      const uniqueBases = [...new Set(bases)];
      const allSameBasis = uniqueBases.length === 1 && bases.length === wrongs.length;

      if (allSameBasis) {
        const basis = uniqueBases[0];
        // 근거가 요약과 같은지(요약 안에 근거가 포함되거나 거의 같은 내용)
        // 이모지, 구두점, 공백 제거 후 비교
        const normalize = s => s.replace(/[\u{1F300}-\u{1FFFF}✅🚨📝⭐🔔📌🔎🎯💡🧭🧩🔹🟦⚠️✔️,\.·\s]/gu, '');
        const summaryNorm = normalize(summary);
        const basisNorm   = normalize(basis);
        const isSameAsSummary = summaryNorm === basisNorm ||
                                (basisNorm.length >= 10 && summaryNorm.includes(basisNorm.substring(0, Math.min(15, basisNorm.length)))) ||
                                (summaryNorm.length >= 10 && basisNorm.includes(summaryNorm.substring(0, Math.min(15, summaryNorm.length))));

        // 오답 보기 레이블들이 복합 선택지(쉼표 목록)인지 확인
        const hasMultiItemLabels = wrongs.some(c => isMultiItemLabel(c.label));

        if (hasMultiItemLabels) {
          // 복합 선택지 → 오답 보기명 나열은 의미없음
          // 근거가 요약과 다르면 근거를 2번째 줄로, 같으면 생략
          if (!isSameAsSummary) {
            const shortBasis = basis.length > 70 ? basis.substring(0, 70) + '…' : basis;
            lines.push(shortBasis);
          }
          // 같으면 1줄만으로 충분
        } else if (isSameAsSummary) {
          // 근거가 요약과 같음 → 보기명만 나열 + "각각 다른 방식"
          const labelStr = wrongs.map(c => c.label).join(' · ');
          if (labelStr.length <= 80) {
            lines.push(`${labelStr} → 각각 해당하지 않음`);
          }
        } else {
          // 근거가 새 정보 → 근거를 2번째 줄로
          const shortBasis = basis.length > 70 ? basis.substring(0, 70) + '…' : basis;
          lines.push(shortBasis);
        }
      } else {
        // 각기 다른 근거 → 번호 + 보기 + 이유
        const NUMS = ['①', '②', '③', '④', '⑤'];
        // 보기가 복합 선택지인 경우는 번호+보기명 형태로만
        const parts = wrongs.map((c, idx) => {
          const num = NUMS[idx] || `${idx+1}.`;
          // 보기 레이블을 짧게
          let label = c.label;
          if (label.length > 25) label = label.substring(0, 25) + '…';
          // 왜 오답 (템플릿 아닌 것) 또는 판단 근거 중 유용한 것
          const why = c.whyWrong || (c.basis && !isTemplateText(c.basis) ? c.basis : '');
          const whyShort = why.length > 30 ? why.substring(0, 30) + '…' : why;
          return whyShort ? `${num} ${label}: ${whyShort}` : `${num} ${label}`;
        });
        // 전체 줄이 너무 길면 2줄로 나눔
        const joined = parts.join(', ');
        if (joined.length <= 120) {
          lines.push(joined);
        } else {
          // 반씩 나눔
          const half = Math.ceil(parts.length / 2);
          lines.push(parts.slice(0, half).join(', '));
          if (lines.length < 3) lines.push(parts.slice(half).join(', '));
        }
      }
    }
  }

  // 3줄 이내 제한
  const result = lines.slice(0, 3).join('\n');

  // 변환 후에도 원본과 거의 같은 길이면 변환 실패로 처리
  if (result.length >= text.length * 0.9) return null;

  return result;
}

// ── 파일 처리 ────────────────────────────────────────────────────────

function processFile(filePath, dryRun = false) {
  const raw  = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const qs   = data.questions || [];
  if (!qs.length) return { converted: 0, skipped: 0, failed: 0 };

  let converted = 0, skipped = 0, failed = 0;

  for (const q of qs) {
    if (!q.explanation || q.explanation.length <= MAX_LEN) {
      skipped++;
      continue;
    }

    const newExp = reformatExplanation(q.explanation, q);
    if (newExp === null) {
      failed++;
      continue;
    }

    if (!dryRun) {
      q.explanation = newExp;
    }
    converted++;
  }

  if (!dryRun && converted > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return { converted, skipped, failed };
}

// ── 비교 출력 (테스트용) ────────────────────────────────────────────

function previewFile(filePath, maxQ = 5) {
  const raw  = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const qs   = data.questions || [];

  let shown = 0;
  for (const q of qs) {
    if (shown >= maxQ) break;
    if (!q.explanation || q.explanation.length <= MAX_LEN) continue;

    const newExp = reformatExplanation(q.explanation, q);
    if (!newExp) continue;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Q${q.qnum || '?'}: ${(q.stem || '').substring(0, 60)}...`);
    console.log(`\n[원본 (${q.explanation.length}자)]`);
    console.log(q.explanation.substring(0, 400) + (q.explanation.length > 400 ? '\n...(이하 생략)' : ''));
    console.log(`\n[변환 후 (${newExp.length}자)]`);
    console.log(newExp);
    shown++;
  }
  return shown;
}

// ── main ─────────────────────────────────────────────────────────────

function main() {
  const args    = process.argv.slice(2);
  const preview = args.includes('--preview') || args.includes('-p');
  const pattern = args.find(a => !a.startsWith('-')) || '';

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') &&
                 (pattern ? f.includes(pattern) : true) &&
                 (f.startsWith('exam_') || f.startsWith('category_')))
    .map(f => path.join(DATA_DIR, f))
    .sort();

  if (!files.length) {
    console.log('해당 파일 없음');
    return;
  }

  if (preview) {
    // 첫 번째 파일만 미리보기
    console.log(`[미리보기] ${path.basename(files[0])}`);
    const shown = previewFile(files[0], 5);
    console.log(`\n총 ${shown}개 미리보기 완료`);
    return;
  }

  console.log(`총 ${files.length}개 파일 처리 시작\n`);
  let totalConverted = 0, totalSkipped = 0, totalFailed = 0;

  for (const f of files) {
    const { converted, skipped, failed } = processFile(f);
    const name = path.basename(f);
    console.log(`[${name}] 변환: ${converted}, 스킵(짧음): ${skipped}, 변환불가: ${failed}`);
    totalConverted += converted;
    totalSkipped   += skipped;
    totalFailed    += failed;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`완료 | 변환: ${totalConverted}, 스킵: ${totalSkipped}, 변환불가: ${totalFailed}`);
}

main();
