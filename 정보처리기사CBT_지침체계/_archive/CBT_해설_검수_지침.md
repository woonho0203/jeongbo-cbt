# 정보처리기사 CBT 해설 검수 지침

이 문서는 `data/exam_*.json`, `data/category_*.json`에 들어간 `explanation`을 검수할 때 사용하는 기준이다. 목표는 해설을 길게 만드는 것이 아니라, 수험생이 정답을 납득하고 같은 유형을 다시 풀 수 있게 만드는 것이다.

## 검수 대상

- 회차별 기출: `data/exam_2016-1.json` ~ `data/exam_2025-3.json`
- 유형별 연습: `data/category_calc.json`, `data/category_code.json`, `data/category_wrong-sentence.json`, `data/category_keyword.json`, `data/category_sequence.json`
- 검수 필드: `questions[].explanation`
- 유지 필드: `examId`, `title`, `qnum`, `subject`, `subjectName`, `stem`, `options`, `answer`, `image`, `table`

`explanation`을 고치더라도 문제 원문, 보기, 정답 번호는 원본 대조 없이 임의 수정하지 않는다.

## 최종 판정 기준

### 문제별 판정

| 판정 | 기준 | 처리 |
|---|---|---|
| 통과 | 정답 이유가 정확하고, 문제 의도와 보기 비교가 충분하다. | 수정 불필요 |
| 보완 | 핵심은 맞지만 설명이 짧거나 오답 정리가 약하다. | 해설만 보강 |
| 재검수 | 정답 근거가 불명확하거나 그림·표·코드 값을 확인하지 않았다. | 원문/PDF/앱 화면 대조 |
| 실패 | 정답과 다른 설명, 잘못된 개념, 다른 문제 해설, JSON 오류가 있다. | 즉시 수정 |

### 회차별 판정

| 기준 | 판정 |
|---|---|
| 실패 0개, 재검수 0개, 보완 5% 이하 | 통과 |
| 실패 0개, 재검수 3% 이하 | 조건부 통과 |
| 실패 1개 이상 또는 재검수 3% 초과 | 재작업 |
| JSON 파싱 오류 또는 앱 로딩 실패 | 즉시 재작업 |

## 치명 오류

아래 항목은 발견 즉시 실패로 처리한다.

- 정답 번호와 해설의 결론이 다르다.
- 부정형 문제인데 정답 보기를 “맞는 설명”처럼 해설한다.
- 다른 문제의 개념이나 다른 회차의 해설이 붙어 있다.
- 그림·표·코드 문제에서 핵심 값, 출력값, 행/열, 방문 순서가 실제 자료와 다르다.
- 공식, 용어 정의, 표준 절차가 시험 범위와 다르게 적혀 있다.
- `explanation` 문자열 따옴표, 줄바꿈, 이스케이프 오류로 JSON 파싱이 깨진다.
- 앱에서 문제 상세 또는 결과 화면이 열리지 않는다.

## 검수 순서

1. JSON이 정상 파싱되는지 확인한다.
2. `answer` 번호가 `options` 범위 안에 있는지 확인한다.
3. 문제 문장이 긍정형인지 부정형인지 먼저 표시한다.
4. 정답 보기를 읽고, 해설 첫 문장이 정답의 핵심 이유를 말하는지 본다.
5. 그림·표·코드·SQL·계산 문제는 실제 중간값과 최종값을 대조한다.
6. 오답 정리가 정답 보기를 제외한 나머지 보기만 다루는지 확인한다.
7. 앱에서 문제 화면과 결과 화면에 줄바꿈, 이미지, 표가 자연스럽게 보이는지 확인한다.

## 문제별 100점 채점표

| 항목 | 배점 | 채점 기준 |
|---|---:|---|
| 정답 정확성 | 30점 | 해설 결론이 `answer`와 일치하고 개념 오류가 없는가 |
| 문제 의도 반영 | 20점 | 긍정형/부정형, “가장 옳은 것”, “거리가 먼 것” 같은 요구를 정확히 반영했는가 |
| 핵심 근거 | 20점 | 공식, 정의, 계산값, 출력값, 방문 순서 등 정답 근거가 구체적인가 |
| 오답 정리 | 10점 | 정답 외 보기들이 왜 아닌지 짧게 구분되는가 |
| 표현 품질 | 10점 | 문장이 자연스럽고, 맞춤법·띄어쓰기·조사 오류가 없는가 |
| 앱/JSON 적합성 | 10점 | JSON 문자열과 앱 표시가 깨지지 않는가 |
| 합계 | 100점 |  |

### 점수별 처리

| 점수 | 판정 | 처리 |
|---:|---|---|
| 95~100점 | 통과 | 수정 불필요 |
| 85~94점 | 보완 | 짧은 문장 보강 |
| 70~84점 | 재검수 | 원문과 다시 대조 |
| 0~69점 | 실패 | 해설 재작성 |

## 공통 해설 합격 기준

좋은 해설은 아래 4가지를 대부분 만족한다.

- 첫 문장만 읽어도 정답 이유가 보인다.
- 정답 보기에 들어 있는 핵심 단어를 그대로 연결해 설명한다.
- 오답은 길게 늘어놓지 않고, 왜 정답 조건에서 벗어나는지만 말한다.
- 계산·코드·표 문제는 결과만 쓰지 않고 결과가 나온 중간값을 적는다.

권장 형식:

```text
정답 보기가 맞거나 틀린 핵심 이유를 먼저 쓴다.
필요하면 공식, 계산값, 실행 흐름, 표에서 읽은 값을 한 문장으로 덧붙인다.
오답1 · 오답2 · 오답3 → 각각 해당하지 않음
```

## 유형별 검수 기준

### 1. 부정형 문제

대상 문장:

- `옳지 않은 것은`
- `틀린 것은`
- `거리가 먼 것은`
- `해당하지 않는 것은`
- `적절하지 않은 것은`
- `볼 수 없는 것은`

검수 기준:

- 해설이 “정답 보기가 왜 틀렸는지”로 시작해야 한다.
- “나머지는 맞는 설명이다”가 자연스럽게 성립해야 한다.
- 정답 보기를 다시 맞는 말처럼 고쳐 썼다면 원래 보기와 혼동되지 않게 표현한다.

나쁜 예:

```text
프로토타이핑은 요구사항을 반영할 수 있습니다.
```

좋은 예:

```text
2번은 틀린 설명입니다. 프로토타이핑은 시제품을 보여주고 피드백을 받아 새로운 요구사항을 반영하는 개발 모형입니다.
1 · 3 · 4 → 프로토타이핑의 장점에 해당합니다.
```

### 2. 계산 문제

검수 기준:

- 공식이 들어가야 한다.
- 문제의 숫자를 공식에 대입한 과정이 있어야 한다.
- 단위가 있으면 결과 단위까지 맞아야 한다.

필수 확인:

- LOC, COCOMO, Function Point
- HRN, SJF, Round Robin 등 스케줄링
- 페이지 교체 알고리즘
- 카디널리티/차수
- 서브넷, 전송 시간, 해밍 코드
- 정렬 PASS 결과

권장 형식:

```text
개발 기간 = 총 라인 수 / (개발자 수 × 월 생산성)입니다. 36000 / (6 × 300) = 20개월이므로 정답은 4번입니다.
5개월 · 10개월 · 15개월 → 분모 또는 계산 순서를 잘못 적용한 값입니다.
```

### 3. 코드 문제

검수 기준:

- 전체 코드를 산문으로 다시 쓰지 않는다.
- 값이 바뀌는 변수, 반복 횟수, 최종 출력값을 확인한다.
- 전위/후위 증감, 배열 인덱스, 문자열 종료, 포인터, 재귀 종료 조건을 특히 확인한다.

필수 문장:

```text
최종 출력값은 ...
```

재검수 신호:

- “실행하면 정답이 된다”처럼 출력값이 없다.
- 반복문 종료 시점의 변수 값이 없다.
- 코드 언어 문법을 잘못 해석했다.

### 4. SQL 문제

검수 기준:

- `FROM → WHERE → GROUP BY/HAVING → SELECT → ORDER BY` 흐름으로 결과를 확인한다.
- JOIN 조건, NULL 처리, 집계 함수, 중복 제거 여부를 명시한다.
- `UNION`과 `UNION ALL`을 혼동하지 않는다.

권장 형식:

```text
WHERE 조건으로 ... 행만 남고, SELECT 결과는 ...입니다. 따라서 보기 중 이 결과와 같은 것은 N번입니다.
다른 보기는 조건 적용 전 행이 섞였거나 중복 처리 방식이 다릅니다.
```

### 5. 그림·표 문제

검수 기준:

- `image` 또는 `table` 필드가 있으면 해설에 자료에서 읽은 값을 직접 적는다.
- 트리, 그래프, 릴레이션, 스케줄링 표는 눈으로 확인한 값이 해설과 일치해야 한다.
- 이미지가 필요한 문제인데 해설이 일반 개념만 설명하면 보완 대상이다.

필수 확인:

- 트리: 차수, 단말 노드, 순회 순서
- 그래프: 시작 정점, 방문 순서, 간선 수, 노드 수
- 릴레이션: 행 수, 열 수, 키 후보
- 세그먼트 테이블: 기준 주소, 길이, 변위, 물리 주소
- 스케줄링 표: 도착 시간, 서비스 시간, 대기 시간, 우선순위 값

### 6. 키워드 찾기 문제

검수 기준:

- 문제 문장 속 결정 단서와 정답 용어가 연결되어야 한다.
- 약어가 있으면 한글명 또는 영문명을 함께 쓰면 좋다.
- 비슷한 보기의 차이를 한 줄로 구분한다.

권장 형식:

```text
“클라이언트가 사용하지 않는 인터페이스에 의존하지 않아야 한다”는 단서는 인터페이스 분리 원칙(ISP)을 가리킵니다.
SRP · OCP · LSP → 각각 책임, 확장, 치환 가능성과 관련된 원칙입니다.
```

### 7. 종류·순서 문제

검수 기준:

- 정답 순서를 먼저 제시한다.
- 약한 순서/강한 순서, 상향식/하향식, 앞 단계/뒤 단계 기준을 명확히 쓴다.
- “외우면 된다”로 끝내지 않는다.

권장 형식:

```text
결합도는 약한 순서부터 자료 결합 → 스탬프 결합 → 제어 결합 → 외부 결합 → 공통 결합 → 내용 결합입니다. 보기 중 이 순서와 일치하는 것은 4번입니다.
```

## 표현 검수 기준

### 통과 표현

- “정답은 N번입니다”보다 “N번이 정답인 이유는 ...입니다”를 우선한다.
- “해당합니다”, “맞습니다”만 반복하지 않는다.
- 한 문장이 너무 길면 2문장으로 나눈다.
- 앱 표시를 고려해 Markdown 제목, 표, 장식 문자는 쓰지 않는다.
- 줄바꿈은 0~2회 정도만 사용한다.

### 보완 대상 표현

- `정답입니다`만 있고 이유가 없다.
- `나머지는 틀립니다`만 있고 오답 구분이 없다.
- `그림을 보면 알 수 있습니다`라고만 쓰고 값을 말하지 않는다.
- `위와 같다`, `다음과 같다`, `해당 내용`처럼 원문 없이 읽으면 모호하다.
- 너무 긴 이모지·제목·불릿 구조가 앱 화면을 압박한다.

## 자동 점검 명령

### JSON 파싱과 필수 필드 점검

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const dataDir = 'data';
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
let errors = [];

for (const file of fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  const full = path.join(dataDir, file);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    errors.push(`${file}: JSON 파싱 실패 - ${error.message}`);
    continue;
  }

  const questions = Array.isArray(json) ? json : json.questions;
  if (!Array.isArray(questions)) {
    errors.push(`${file}: questions 배열 없음`);
    continue;
  }

  for (const q of questions) {
    const label = `${file} Q${q.qnum ?? '?'}`;
    if (!q.stem) errors.push(`${label}: stem 없음`);
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${label}: options 이상`);
    if (!Number.isInteger(Number(q.answer)) || Number(q.answer) < 1 || Number(q.answer) > q.options.length) {
      errors.push(`${label}: answer 범위 이상`);
    }
    if (!String(q.explanation || '').trim()) errors.push(`${label}: explanation 없음`);
  }
}

if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}
console.log('필수 필드 점검 통과');
NODE
```

### 짧거나 불충분한 해설 후보 찾기

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
const weak = [];

for (const file of fs.readdirSync('data').filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  const json = JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions || [];
  for (const q of questions) {
    const exp = String(q.explanation || '').replace(/\s+/g, ' ').trim();
    const negative = /(틀린 것은|맞지 않은 것은|아닌 것은|옳지 않은 것은|해당하지 않는|볼 수 없는|없는 것은|거리가 먼 것은|적절하지 않은)/.test(q.stem || '');
    const hasSpecificValue = /[0-9]|→|=|출력|결과|공식|행|열|순서|값|개월|번/.test(exp);
    if (exp.length < 45 || (negative && !/(틀린|아닌|옳지|잘못|거리가 먼)/.test(exp)) || !hasSpecificValue) {
      weak.push(`${file} Q${q.qnum}: ${exp.slice(0, 120)}`);
    }
  }
}

console.log(weak.length ? weak.join('\n') : '불충분 후보 없음');
NODE
```

### 이미지·표 해설 연계 점검

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
const suspects = [];

for (const file of fs.readdirSync('data').filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  const json = JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions || [];
  for (const q of questions) {
    if (!q.image && !q.table) continue;
    const exp = String(q.explanation || '');
    if (!/(그림|표|행|열|노드|간선|자식|순회|방문|기준 주소|길이|변위|출력|결과|값|=|[0-9])/.test(exp)) {
      suspects.push(`${file} Q${q.qnum}: 이미지/표 값 언급 부족`);
    }
  }
}

console.log(suspects.length ? suspects.join('\n') : '이미지·표 해설 연계 후보 없음');
NODE
```

## 수동 검수 보고 양식

`explanation_review_report.md` 같은 파일에 아래 형식으로 기록한다.

```text
# 정보처리기사 CBT 해설 검수 보고서

검수 범위: exam_2025-3.json
검수일:
검수자:

## 요약

- 전체 문항:
- 통과:
- 보완:
- 재검수:
- 실패:
- 최종 판정:

## 문항별 기록

### Q1
- 판정: 보완
- 점수: 88/100
- 문제 유형: 부정형
- 발견 사항: 정답이 틀린 이유는 맞지만, 나머지 보기 정리가 없음.
- 수정 방향: 오답 정리 한 줄 추가.

### Q12
- 판정: 통과
- 점수: 100/100
- 문제 유형: 계산
- 발견 사항: 공식, 대입값, 결과 단위가 모두 있음.
```

## 수정 원칙

- 정답 정확성이 의심되면 해설만 고치지 말고 원문/PDF/신뢰 가능한 교재와 대조한다.
- 문제 원문이나 보기에 OCR 오류가 있어도, 해설 검수 중에는 별도 메모로 남기고 임의 수정하지 않는다.
- 한 번에 대량 수정한 뒤에는 반드시 JSON 파싱 점검과 앱 실행 확인을 한다.
- 자동 스크립트가 만든 해설은 초안으로 보고, 부정형·코드·계산·그림 문제를 우선 수동 검수한다.

## 우선 검수 순서

1. 정답과 해설이 어긋나면 학습 피해가 큰 회차별 기출 문제
2. `image` 또는 `table`이 있는 문제
3. 코드 실행 결과 문제
4. 계산 공식 문제
5. 부정형 문제
6. 유형별 연습 문제 중 해설이 45자 미만인 문제

## 최종 완료 조건

- 자동 점검 명령 3개가 통과 또는 확인 완료 상태다.
- 실패 문항이 0개다.
- 재검수 문항이 남아 있으면 회차/유형별 보고서에 사유가 적혀 있다.
- 앱에서 최소 1개 회차와 1개 유형별 연습을 열어 해설 표시를 확인했다.
