# 정보처리기사 CBT 해설 검수 보고서

검수 기준: `CBT_해설_검수_지침.md`
검수일: 2026-05-20
검수 범위: `data/exam_*.json`, `data/category_*.json`

## 요약

- 검수 파일: 34개
- 검수 문항: 3,557문항
- 회차별 기출: 29개 파일, 2,890문항
- 유형별 연습: 5개 파일, 667문항
- JSON 파싱/필수 필드: 통과
- 이미지 파일 참조: 32개, 누락 0개
- 앱 최신 데이터 로딩: `PORT=3001` 기준 통과
- 최종 판정: 조건부 통과, 해설 품질 보완 필요

구조적 치명 오류는 발견하지 못했다. 다만 지침의 해설 품질 기준으로 보면 유형별 파일과 2016~2023 회차 일부는 “정답만 알려주는 수준” 또는 자동 생성 비문이 남아 있어 보완 대상이다.

## 자동 점검 결과

| 항목 | 결과 | 판정 |
|---|---:|---|
| JSON 파싱 실패 | 0건 | 통과 |
| `questions` 배열 누락 | 0건 | 통과 |
| `stem` 누락 | 0건 | 통과 |
| `options` 이상 | 0건 | 통과 |
| `answer` 범위 이상 | 0건 | 통과 |
| `explanation` 공백 | 0건 | 통과 |
| 이미지 참조 파일 누락 | 0건 | 통과 |
| 이미지·표 해설 연계 부족 후보 | 5건 | 재검수 |
| 45자 미만 해설 | 913건 | 보완 |
| 명확한 비문 패턴 | 42건 | 보완 |
| 문항 문구 잔재 패턴 | 42건 | 보완 |

## 앱 로딩 확인

기존 `localhost:3000` 서버는 이미 떠 있었지만, 오래된 프로세스로 보이며 `/api/exams`에서 6회차만 반환했다. 최신 파일 기준 확인을 위해 `PORT=3001 npm start`로 새 서버를 띄웠고 다음을 확인했다.

| 확인 항목 | 결과 |
|---|---|
| `/api/exams` | 회차 29개, 유형 5개 반환 |
| `2016-1` 시작 | 100문항 로딩 |
| `2025-3` 시작 | 100문항 로딩 |
| 유형 `calc` 시작 | 41문항 로딩 |

추가 발견 사항:

- `category_code.json`은 실제 문항 수가 56문항인데 API 제목은 `필수 코드 57문제`로 표시된다. 해설 오류는 아니지만 UI/데이터 메타데이터 보정 대상이다.
- 최신 데이터 확인 시에는 기존 3000번 서버를 재시작하거나 다른 포트로 실행해야 한다.

## 회차별/유형별 품질 요약

| 파일 | 문항 | 평균 해설 길이 | 45자 미만 | 25자 미만 | 비문 패턴 | 이미지·표 연계 부족 |
|---|---:|---:|---:|---:|---:|---:|
| `category_calc.json` | 41 | 64 | 13 | 7 | 0 | 2 |
| `category_code.json` | 56 | 24 | 48 | 39 | 0 | 0 |
| `category_keyword.json` | 259 | 21 | 248 | 201 | 0 | 3 |
| `category_sequence.json` | 114 | 24 | 114 | 74 | 0 | 0 |
| `category_wrong-sentence.json` | 197 | 14 | 190 | 183 | 0 | 0 |
| `exam_2016-1.json` | 100 | 87 | 8 | 0 | 2 | 0 |
| `exam_2016-2.json` | 100 | 83 | 8 | 0 | 1 | 0 |
| `exam_2016-3.json` | 100 | 85 | 9 | 0 | 3 | 0 |
| `exam_2017-1.json` | 97 | 92 | 4 | 1 | 0 | 0 |
| `exam_2017-2.json` | 100 | 83 | 12 | 1 | 2 | 0 |
| `exam_2017-3.json` | 100 | 93 | 12 | 0 | 2 | 0 |
| `exam_2018-1.json` | 100 | 79 | 17 | 2 | 2 | 0 |
| `exam_2018-2.json` | 100 | 89 | 11 | 0 | 3 | 0 |
| `exam_2018-3.json` | 100 | 89 | 11 | 0 | 1 | 0 |
| `exam_2019-1.json` | 100 | 86 | 15 | 1 | 3 | 0 |
| `exam_2019-2.json` | 100 | 87 | 9 | 1 | 1 | 0 |
| `exam_2020-1-2.json` | 100 | 80 | 12 | 0 | 3 | 0 |
| `exam_2020-3.json` | 99 | 79 | 13 | 2 | 3 | 0 |
| `exam_2020-4.json` | 99 | 90 | 7 | 0 | 0 | 0 |
| `exam_2021-1.json` | 99 | 96 | 9 | 1 | 3 | 0 |
| `exam_2021-2.json` | 99 | 92 | 8 | 0 | 0 | 0 |
| `exam_2021-3.json` | 99 | 113 | 9 | 1 | 1 | 0 |
| `exam_2022-1.json` | 100 | 116 | 3 | 0 | 1 | 0 |
| `exam_2022-2.json` | 99 | 119 | 3 | 0 | 1 | 0 |
| `exam_2022-3.json` | 100 | 106 | 5 | 0 | 1 | 0 |
| `exam_2023-1.json` | 99 | 107 | 11 | 1 | 3 | 0 |
| `exam_2023-2.json` | 100 | 93 | 12 | 1 | 1 | 0 |
| `exam_2023-3.json` | 100 | 104 | 4 | 0 | 1 | 0 |
| `exam_2024-1.json` | 100 | 67 | 20 | 0 | 0 | 0 |
| `exam_2024-2.json` | 100 | 73 | 24 | 0 | 2 | 0 |
| `exam_2024-3.json` | 100 | 68 | 26 | 0 | 2 | 0 |
| `exam_2025-1.json` | 100 | 66 | 6 | 0 | 0 | 0 |
| `exam_2025-2.json` | 100 | 67 | 3 | 0 | 0 | 0 |
| `exam_2025-3.json` | 100 | 61 | 9 | 0 | 0 | 0 |

## 재검수 우선 후보

### 이미지·표 해설 연계 부족

아래 문항은 `image`가 있는데 해설에 그림에서 읽은 구체값이 부족하다.

| 파일 | 문항 | 사유 |
|---|---:|---|
| `category_calc.json` | Q7 | CPM 네트워크 이미지가 있으나 해설이 “임계경로는 최장 경로”에서 끝남. 경로와 14일 계산 필요 |
| `category_calc.json` | Q34 | 프로그램 구조도 이미지가 있으나 F의 fan-in 3, fan-out 2 직접 언급 필요 |
| `category_keyword.json` | Q50 | UML 이미지가 있으나 차 클래스 관계를 그림 근거로 설명하지 않음 |
| `category_keyword.json` | Q232 | 토폴로지 이미지가 있으나 버스형 판단 근거가 없음 |
| `category_keyword.json` | Q241 | 방화벽 구성 이미지가 있으나 Screened Subnet 구조 근거가 없음 |

### 유형별 파일

유형별 파일은 구조상 치명 오류는 없지만, 지침 기준으로는 대부분 보완 대상이다.

- `category_wrong-sentence.json`: 197문항 중 190문항이 45자 미만이다. “N번은 틀린 설명이다”만 있는 경우가 많아, 틀린 부분과 올바른 개념을 1문장씩 추가해야 한다.
- `category_sequence.json`: 114문항 전체가 45자 미만이다. 순서·종류 문제인데 기준 순서나 비교 근거가 거의 없다.
- `category_keyword.json`: 259문항 중 248문항이 45자 미만이다. “용어를 떠올리는 문제다”에서 끝나는 항목이 많아 결정 단서 연결이 필요하다.
- `category_code.json`: 56문항 중 48문항이 45자 미만이다. 최종 결과는 있으나 변수 변화, 반복 횟수, SQL 실행 흐름이 부족하다.
- `category_calc.json`: 41문항 중 13문항이 45자 미만이다. 공식·대입값이 빠진 문항부터 보강하면 된다.

## 비문/자동 생성 흔적 후보

다음 패턴은 해설 품질을 떨어뜨리므로 일괄 보정 가능하다.

| 패턴 | 건수 | 예시 |
|---|---:|---|
| `은은` | 34 | “논리연산은은 XOR 연산이다” |
| `는은` | 1 | “변환시켜 주는은 ARP이다” |
| `은으로` | 12 | “해당하는 것은으로 그래프이다” |
| `명령어 명령어` | 6 | “명령어 명령어는 chmod이다” |
| `것은은` | 12 | “해당하지 않는 것은은 Broadcast이다” |
| 문항 문구 잔재 | 42 | “제시된 항목들이 모두 해당하며 ... 정답이다” |

대표 후보:

- `exam_2016-1.json` Q32: “두 데이터의 비교(Compare)를 위한 논리연산은은 XOR 연산이다.”
- `exam_2016-1.json` Q94: “IEEE 802.5 는 무엇에 대한 표준인이 토큰링이다.”
- `exam_2016-3.json` Q54: “UNIX에서 파일 사용 권한 지정에 관한 명령어 명령어는 chmod이다.”
- `exam_2017-2.json` Q23: “10진수 -456을 PACK 형식으로 표현한 것은은 45 6D이다.”
- `exam_2020-3.json` Q92: “CPM 네트워크가 다음과 같을 때 임계경로의 소요기일은은 14일이다.”
- `exam_2024-2.json` Q44: “DML에 해당하는 것으로만 나열된 것은은 ㉠, ㉡, ㉢이다.”
- `exam_2024-3.json` Q78: “TCP/IP에서 사용되는 논리 주소를 물리 주소로 변환시켜 주는은 ARP이다.”

## 판정

### 구조/앱

- 판정: 통과
- 근거: JSON 파싱, 필수 필드, 이미지 파일 존재, 최신 포트 앱 로딩이 모두 정상이다.
- 단, 기존 3000번 서버는 오래된 상태로 떠 있으므로 실제 사용 전 재시작 필요.

### 해설 품질

- 판정: 조건부 통과
- 근거: 정답 번호 누락, 빈 해설, 이미지 파일 누락 같은 치명 오류는 없다.
- 보완 사유: 유형별 파일 613문항, 회차별 기출 300문항이 45자 미만이며, 일부 회차에 자동 생성 비문이 남아 있다.

### 최종

- 최종 판정: 조건부 통과
- 우선 조치: 이미지·표 연계 부족 5문항과 비문 패턴 42문항을 먼저 수정한다.
- 다음 조치: 유형별 파일을 `category_wrong-sentence` → `category_sequence` → `category_code` → `category_keyword` → `category_calc` 순으로 보강한다.

## 권장 수정 순서

1. `category_calc.json` Q7, Q34와 `category_keyword.json` Q50, Q232, Q241 보강
2. `은은`, `것은은`, `명령어 명령어`, `은으로` 같은 명확한 비문 패턴 일괄 수정
3. `category_wrong-sentence.json`의 “N번은 틀린 설명이다” 문항에 올바른 개념 추가
4. `category_sequence.json`의 순서·종류 기준 추가
5. `category_code.json`의 코드/SQL 흐름 1문장 추가
6. `category_code.json` 제목의 `57문제`와 실제 56문항 불일치 수정

## 재현 명령

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const skip = new Set(['categories_index.json', 'exams_index.json', 'cbt_store.json']);
let errors = [];
let count = 0;

for (const file of fs.readdirSync('data').filter(f => f.endsWith('.json') && !skip.has(f)).sort()) {
  const json = JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
  const questions = Array.isArray(json) ? json : json.questions;
  count += questions.length;
  for (const q of questions) {
    const label = `${file} Q${q.qnum ?? '?'}`;
    if (!q.stem) errors.push(`${label}: stem 없음`);
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${label}: options 이상`);
    if (!Number.isInteger(Number(q.answer)) || Number(q.answer) < 1 || Number(q.answer) > q.options.length) errors.push(`${label}: answer 범위 이상`);
    if (!String(q.explanation || '').trim()) errors.push(`${label}: explanation 없음`);
  }
}

console.log(`questions=${count}`);
console.log(errors.length ? errors.join('\n') : '필수 필드 점검 통과');
NODE
```
