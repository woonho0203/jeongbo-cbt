# 고시_데이터_JSON스키마_파일명규칙

## 0. 문서 정보

- 문서 등급: 고시 (설정값·형식·경로)
- 버전: v1.1
- 작성일: 2026-07-11
- 최종 수정일: 2026-07-26
- 상위 문서: 02_법률/법률_데이터_데이터관리법_v1.1

---

## 제1조 데이터 파일 스키마

회차별 기출:

```json
{
  "examId": "2025-3",
  "title": "2025년 3회",
  "questions": []
}
```

유형별 연습:

```json
{
  "categoryId": "code",
  "title": "필수 코드 57문제",
  "questions": []
}
```

- `examId`·`categoryId`·`title`은 문항 필드가 아니라 파일 최상위 식별 필드다.
- `questions`는 문항 객체 배열이어야 한다.
- `exam_*.json`은 회차별 PDF, `category_*.json`은 유형별 PDF를 각각 독립 원본으로 삼는다. 두 계열을 자동 동기화하지 않는다.

## 제2조 문항 객체 스키마

회차 문항:

```json
{
  "qnum": 23,
  "subject": 2,
  "subjectName": "소프트웨어 개발",
  "stem": "다음 트리의 차수(degree)는?",
  "options": ["2", "3", "4", "5"],
  "answer": 2,
  "explanation": "...",
  "image": "images/2024-1_q23.png",
  "table": "<table><tr><th>...</th></tr><tr><td>...</td></tr></table>"
}
```

유형별 문항:

```json
{
  "qnum": 1,
  "stem": "다음 코드의 실행 결과는?",
  "options": ["A", "B", "C", "D"],
  "answer": 3,
  "explanation": "..."
}
```

- 모든 문항 필수 필드: `qnum`, `stem`, `options`, `answer`, `explanation`.
- 회차 문항 추가 필수 필드: `subject`, `subjectName`.
- 유형별 문항의 `subject`·`subjectName`은 선택 필드다. 저장했다면 제3조의 매핑을 따라야 한다.
- `image`와 `table`은 선택 필드다.

## 제3조 과목 메타데이터

| `subject` | `subjectName` |
|---:|---|
| 1 | 소프트웨어 설계 |
| 2 | 소프트웨어 개발 |
| 3 | 데이터베이스 구축 |
| 4 | 프로그래밍 언어 활용 |
| 5 | 정보시스템 구축 관리 |

- 모든 회차 문항은 두 필드를 함께 저장한다.
- 앱의 문제 번호·키워드 기반 추론이나 표시용 대체값은 장애 방지용 보조 수단일 뿐, 저장 필드 누락을 허용하는 스키마 규칙이 아니다.
- 2016~2019년 구 과목 체계는 기존에 PDF 대조로 확정한 `subject` 값을 보존하고 위 표의 대응 `subjectName`을 저장한다.

## 제4조 정답 형식

- 단일 정답: 1부터 시작하고 `options.length` 이하인 정수.
- 공식 복수정답·전항정답: 위 범위의 서로 다른 정수로 이루어진 비어 있지 않은 배열.
- 배열은 출제기관 공식 정답에 근거할 때만 사용한다.

```json
{ "answer": 2 }
{ "answer": [3, 4] }
{ "answer": [1, 2, 3, 4] }
```

문자열 `"2"`, 빈 배열, 중복 배열 `[2, 2]`, 범위를 벗어난 값은 허용하지 않는다.

## 제5조 이미지·표 복합 자료 예외

- 원칙: 한 문항에서는 `image` 또는 `table` 중 원본 재현에 더 적합한 한 방식을 쓴다.
- 예외: 한 방식만으로 원본의 필수 정보를 온전히 재현할 수 없고 두 필드가 서로 다른 정보를 보완할 때는 사용자 승인과 원본 대조 기록을 전제로 함께 쓸 수 있다.
- 2026-07-26 현재 승인된 공식 예외는 다음 4건이다.

| 파일 | 문항 |
|---|---:|
| `data/category_code.json` | Q46 |
| `data/exam_2019-1.json` | Q26 |
| `data/exam_2020-3.json` | Q44 |
| `data/exam_2020-4.json` | Q51 |

승인 목록 밖의 복합 자료는 자동 통과시키지 않고 `확인 필요`로 분류한다. 승인된 예외도 같은 내용을 두 번 표시하거나 앱 렌더링을 깨면 실패다.

## 제6조 데이터 파일 목록

- 회차별 기출: `data/exam_2016-1.json` ~ `data/exam_2025-3.json`
- 유형별 연습: `data/category_calc.json`, `data/category_code.json`, `data/category_wrong-sentence.json`, `data/category_keyword.json`, `data/category_sequence.json`
- 인덱스: `data/exams_index.json`, `data/categories_index.json`
- 로컬 서버 저장소: `data/cbt_store.json`

인덱스는 데이터 무결성 점검 대상이다. 각 항목의 식별자·제목·`count`는 실제 데이터 파일과 일치해야 한다. `cbt_store.json`은 문제 스키마 점검 대상에서 제외한다.

## 제7조 이미지 파일명·경로 규칙

```text
경로 필드값: images/{sourceId}_q{qnum}.png
실제 파일:   public/images/{sourceId}_q{qnum}.png
```

- 회차 예: `exam_2019-2.json` Q1 → `images/2019-2_q1.png`.
- 유형별 자료는 `images/{categoryId}_q{qnum}.png`를 우선한다. 기존 회차 이미지를 공유하는 경로는 두 독립 PDF의 자료가 동일하다고 대조된 경우에만 유지한다.
- 파일명 `qnum`과 JSON `qnum`이 일치해야 한다.
- PDF 인쇄 번호와 JSON `qnum`이 다를 때도 파일명은 보정 확정된 JSON `qnum`을 따른다.

## 제8조 표(table) 형식 규칙

```text
형식: <table>...</table> (최상위 태그가 <table>로 시작·종료)
구조: <tr>, <th>(헤더), <td>(데이터)
```

- 셀 병합·선·배치 때문에 HTML로 정확히 재현할 수 없으면 `image`를 쓴다.
- 제5조의 승인 예외는 `table`과 `image` 각각의 역할을 운영기록에 남긴다.

## 제9조 백업·변경 대상

작업 전 확인:

```bash
git status --short
```

주요 변경 대상:

```text
data/exam_*.json
data/category_*.json
data/exams_index.json
data/categories_index.json
public/images/
정보처리기사CBT_지침체계/08_운영기록/
```

## 개정 이력

| 버전 | 날짜 | 변경 내용 | 변경 이유 |
|---|---|---|---|
| v1.0 | 2026-07-11 | 제정 | 여러 지침에 흩어진 JSON 스키마·파일명·경로 규칙을 고시로 통합 |
| v1.0.1 | 2026-07-23 | 이미지 파일명 규칙에 PDF 인쇄 번호와 JSON `qnum` 불일치 시 JSON `qnum` 기준 저장 원칙 추가 | 2016-1 Q5의 PDF 인쇄번호 10번 자료를 JSON Q5 파일명으로 저장해야 하는 보정 사례 반영 |
| v1.1 | 2026-07-26 | 파일 최상위와 문항 스키마 분리, `answer` 정수·배열 형식 통일, 회차 `subjectName` 필수화, 유형별 독립 원본·인덱스 정합성·복합 자료 4건 예외 명문화 | 사용자 승인 사항과 상위 데이터관리법을 실제 데이터 구조에 맞게 정합화 |
