# 정보처리기사 CBT 해설 보완사항 수정 지침

이 문서는 `explanation_review_report.md` 검수 결과를 바탕으로 실제 해설을 보완할 때 사용하는 작업 지침이다. 기준 문서는 `CBT_해설_검수_지침.md`이며, 이 문서는 “무엇을 어떤 순서로 고칠지”에 초점을 둔다.

## 보완 목표

- 정답 번호와 해설 결론이 일치해야 한다.
- 짧은 해설은 최소한 “왜 정답인지”를 말해야 한다.
- 부정형 문제는 “정답 보기가 왜 틀렸는지”를 먼저 설명해야 한다.
- 그림·표·코드·계산 문제는 결과값만 쓰지 말고 핵심 중간값을 적어야 한다.
- 자동 생성 비문과 어색한 조사 오류를 제거해야 한다.
- JSON 구조와 앱 렌더링은 절대 깨지면 안 된다.

## 수정 우선순위

아래 순서대로 진행한다.

1. 이미지·표 해설 연계 부족 5문항 보완
2. 명확한 비문 패턴 42건 일괄 보정
3. `category_wrong-sentence.json` 짧은 해설 보강
4. `category_sequence.json` 짧은 해설 보강
5. `category_code.json` 코드·SQL 흐름 보강
6. `category_keyword.json` 결정 단서 보강
7. `category_calc.json` 공식·대입값 보강
8. `category_code.json`이 원본 PDF 기준 57문항인지 확인하고, 누락 문항이 있으면 복구

## 1차 수정: 이미지·표 연계 부족 5문항

아래 문항은 가장 먼저 수정한다. `image`가 있는 문제는 해설에 그림에서 읽은 값을 직접 적어야 한다.

| 파일 | 문항 | 현재 문제 | 수정 방향 |
|---|---:|---|---|
| `category_calc.json` | Q7 | CPM 네트워크 이미지가 있으나 “임계경로는 최장 경로”에서 끝남 | 가능한 경로별 소요일을 비교하고, 최장 경로가 14일임을 적는다 |
| `category_calc.json` | Q34 | 프로그램 구조도 이미지가 있으나 숫자 없음 | F를 호출하는 모듈 3개, F가 호출하는 모듈 2개를 명시한다 |
| `category_keyword.json` | Q50 | UML 이미지 근거 없음 | 차 클래스가 상위 개념이고 하위 클래스들이 특수화되는 관계라 일반화 관계임을 적는다 |
| `category_keyword.json` | Q232 | 토폴로지 이미지 근거 없음 | 하나의 공통 전송 매체에 여러 노드가 연결된 구조라 버스형임을 적는다 |
| `category_keyword.json` | Q241 | 방화벽 구성 이미지 근거 없음 | 외부망과 내부망 사이에 DMZ/서브넷을 둔 방화벽 구조라 Screened Subnet임을 적는다 |

권장 예시:

```text
그림에서 모듈 F를 호출하는 상위 모듈은 3개이고, F가 호출하는 하위 모듈은 2개입니다. 따라서 fan-in은 3, fan-out은 2입니다.
fan-in 2 · fan-out 3 등 다른 보기는 호출 방향을 반대로 세었거나 개수를 잘못 센 경우입니다.
```

## 2차 수정: 명확한 비문 패턴

아래 패턴은 정답 자체를 바꾸지 않고 문장만 자연스럽게 고친다.

| 기존 패턴 | 수정 원칙 | 예시 |
|---|---|---|
| `은은` | 하나의 `은`만 남기거나 문장 재작성 | `논리연산은은 XOR 연산이다` → `논리연산은 XOR 연산입니다` |
| `는은` | 조사 하나만 남김 | `변환시켜 주는은 ARP이다` → `변환시켜 주는 것은 ARP입니다` |
| `것은은` | `것은`으로 수정 | `해당하지 않는 것은은 Broadcast이다` → `해당하지 않는 것은 Broadcast입니다` |
| `은으로` | 문맥에 맞게 `은`, `으로`, `것은` 중 선택 | `옳은 것은으로 int이다` → `옳은 것은 int입니다` |
| `명령어 명령어` | 중복 제거 | `명령어 명령어는 chmod이다` → `명령어는 chmod입니다` |
| `무엇에 대한 표준인이` | 문장 재작성 | `IEEE 802.5는 토큰링 표준입니다` |
| `제시된 항목들이 모두 해당하며` | 보기·순서 근거로 재작성 | `제시된 항목들이 모두 해당하며 6회가 정답이다` → `조건을 차례로 적용하면 총 6회 수행됩니다` |

수정 후 문장은 가능하면 다음 형태로 정리한다.

```text
핵심 개념 또는 계산 기준을 먼저 말한다. 따라서 정답은 ...입니다.
```

## 3차 수정: `category_wrong-sentence.json`

현재 다수 문항이 `N번은 틀린 설명이다`에서 끝난다. 이 유형은 반드시 “틀린 표현”과 “올바른 개념”을 함께 적는다.

### 수정 형식

```text
N번은 틀린 설명입니다. [틀린 표현]이 아니라 [올바른 개념]입니다.
나머지 보기는 해당 개념의 올바른 설명입니다.
```

### 예시

기존:

```text
3번은 틀린 설명이다
```

수정:

```text
3번은 틀린 설명입니다. N-S 차트는 화살표나 GOTO 없이 구조화된 제어 논리를 표현하는 도구입니다.
나머지 보기는 N-S 차트의 특징에 해당합니다.
```

### 주의

- 정답 보기를 그대로 반복만 하지 않는다.
- “틀렸다” 다음에 반드시 올바른 표현을 붙인다.
- 부정형 문제인데 정답 보기를 맞는 설명처럼 바꾸어 쓰지 않는다.

## 4차 수정: `category_sequence.json`

현재 많은 문항이 `OO이 조건과 맞는지 비교한다` 수준이다. 순서·종류 문제는 기준 순서 또는 분류 기준이 있어야 한다.

### 수정 형식

```text
이 문제는 [분류/순서 기준]을 묻습니다. 기준에 맞게 비교하면 [정답 보기]가 조건과 맞습니다.
다른 보기는 [기준에서 벗어나는 이유]입니다.
```

순서 문제:

```text
[개념]의 순서는 A → B → C → D입니다. 보기 중 이 순서와 일치하는 것은 N번입니다.
```

종류 제외 문제:

```text
[정답 보기]는 [묻는 범주]에 포함되지 않습니다. 나머지 보기는 [범주]의 대표 항목입니다.
```

## 5차 수정: `category_code.json`

현재 코드 문제는 최종 결과만 있는 경우가 많다. 최소 1문장으로 변수 변화나 SQL 실행 흐름을 추가한다.

### 코드 문제 수정 형식

```text
초기값에서 [변수]가 [변화 과정]을 거쳐 [최종값]이 됩니다. 따라서 최종 출력값은 [정답]입니다.
다른 보기는 증감 순서나 반복 종료 시점을 잘못 계산한 값입니다.
```

### SQL 문제 수정 형식

```text
FROM에서 대상 테이블을 정하고 WHERE 조건으로 [조건]에 맞는 행만 남깁니다. SELECT 결과가 [정답]이므로 정답은 N번입니다.
다른 보기는 조건 적용 전 행이 섞였거나 집계/중복 처리를 잘못한 결과입니다.
```

### 주의

- “최종 결과는 4이다”만 있으면 보완 대상이다.
- 반복문 문제는 반복 횟수 또는 종료 조건을 적는다.
- 배열·문자열 문제는 인덱스 기준을 적는다.
- SQL 문제는 `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `UNION` 중 핵심 절을 언급한다.

## 6차 수정: `category_keyword.json`

현재 `OO를 떠올리는 문제다` 형식이 많다. 키워드 문제는 문제 속 결정 단서와 정답 용어를 연결해야 한다.

### 수정 형식

```text
문제의 “[결정 단서]”는 [정답 용어]를 가리킵니다. [정답 용어]는 [짧은 정의]입니다.
다른 보기는 [비슷하지만 다른 개념]입니다.
```

### 예시

기존:

```text
LSP(Liskov Substitution Principle)를 떠올리는 문제다
```

수정:

```text
“하위 타입이 상위 타입을 대체할 수 있어야 한다”는 단서는 리스코프 치환 원칙(LSP)을 가리킵니다.
다른 SOLID 원칙은 책임 분리, 확장 폐쇄, 인터페이스 분리 등 다른 기준을 다룹니다.
```

## 7차 수정: `category_calc.json`

계산 문제는 공식, 대입값, 결과가 모두 있어야 한다.

### 수정 형식

```text
[공식]으로 계산합니다. 문제의 값을 대입하면 [계산 과정] = [결과]입니다.
따라서 정답은 N번입니다.
```

### 필수 확인 항목

- 카디널리티 = 행 수
- 차수 = 열 수
- 개발 기간 = 총 라인 수 / (개발자 수 × 월 생산성)
- 가능한 튜플 수 = 각 도메인 값의 곱
- 물리 주소 = 기준 주소 + 변위
- HRN 우선순위 = (대기시간 + 서비스시간) / 서비스시간
- 양자화 단계 수 = 2^비트 수
- 해밍 코드 정정 가능 오류 수 = `(해밍 거리 - 1) / 2`의 정수부

## 메타데이터 및 누락 문항 수정

`category_code.json`은 원본 PDF 기준 `필수 코드 57문제`가 맞다. 실제 JSON 문항 수가 56개라면 제목을 56으로 낮추지 말고 누락된 문항 번호를 먼저 찾는다.

확인 대상:

- `data/category_code.json`의 `title`
- `data/categories_index.json`
- 앱에서 별도 제목을 만드는 코드
- `questions[].qnum`이 1~57까지 모두 있는지

수정 후 `/api/exams`에서 아래처럼 보여야 한다.

```text
code:필수 코드 57문제:57
```

## 수정 후 필수 검증

수정이 끝나면 반드시 아래 순서로 확인한다.

### 1. JSON 파싱 확인

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
for (const file of fs.readdirSync('data').filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
}
console.log('JSON 파싱 통과');
NODE
```

### 2. 짧은 해설 후보 재확인

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
const rows = [];
for (const file of fs.readdirSync('data').filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  const json = JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions || [];
  for (const q of questions) {
    const exp = String(q.explanation || '').replace(/\s+/g, ' ').trim();
    if (exp.length < 45) rows.push(`${file} Q${q.qnum}: ${exp}`);
  }
}
console.log(`45자 미만 해설: ${rows.length}건`);
console.log(rows.slice(0, 100).join('\n'));
NODE
```

### 3. 비문 패턴 재확인

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
const rows = [];
const pattern = /은은|는은|것은은|명령어\s+명령어|무엇에 대한 표준인|이다이다|것으로으로/;
for (const file of fs.readdirSync('data').filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  const json = JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions || [];
  for (const q of questions) {
    const exp = String(q.explanation || '').replace(/\s+/g, ' ').trim();
    if (pattern.test(exp)) rows.push(`${file} Q${q.qnum}: ${exp}`);
  }
}
console.log(`비문 패턴: ${rows.length}건`);
console.log(rows.join('\n'));
NODE
```

### 4. 앱 로딩 확인

기존 3000번 서버가 오래 떠 있으면 최신 데이터가 반영되지 않을 수 있다. 검증용으로는 다른 포트를 사용한다.

```bash
PORT=3001 npm start
```

다른 터미널에서 확인한다.

```bash
curl -sS http://localhost:3001/api/exams
```

확인 기준:

- 회차 29개가 반환된다.
- 유형 5개가 반환된다.
- `code` 유형 제목이 실제 문항 수와 일치한다.
- 수정한 회차 또는 유형이 앱에서 정상 시작된다.

## 완료 기준

- 이미지·표 연계 부족 5문항이 모두 보강됐다.
- 명확한 비문 패턴이 0건이다.
- `category_code.json` 제목과 실제 문항 수가 원본 PDF 기준 57문제로 일치한다.
- 유형별 짧은 해설은 최소한 정답 근거 1문장을 포함한다.
- JSON 파싱과 앱 로딩이 통과한다.
