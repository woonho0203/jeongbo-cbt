# 고시_데이터_JSON스키마_파일명규칙

## 0. 문서 정보

- 문서 등급: 고시 (설정값·형식·경로)
- 버전: v1.0
- 작성일: 2026-07-11
- 상위 문서: 02_법률/법률_데이터_데이터관리법_v1.0

---

## 제1조 문항 객체 스키마

```json
{
  "qnum": 23,
  "subject": "...",
  "subjectName": "...",
  "stem": "다음 트리의 차수(degree)는?",
  "options": ["2", "3", "4", "5"],
  "answer": 2,
  "explanation": "...",
  "image": "images/2024-1_q23.png",
  "table": "<table><tr><th>아이디</th><th>성명</th></tr><tr><td>yuyu01</td><td>원유철</td></tr></table>"
}
```

- 불변 필드: `examId`, `title`, `qnum`, `subject`, `subjectName`, `stem`, `options`, `answer`
- 작업 대상 필드: `explanation`, `image`, `table`
- `image`와 `table`은 한 문항에서 둘 중 하나만 쓰는 것을 원칙으로 한다.
- `answer`는 1부터 시작하는 정수, `options` 개수 이하.

## 제2조 데이터 파일 목록

- 회차별 기출: `data/exam_2016-1.json` ~ `data/exam_2025-3.json`
- 유형별 연습: `data/category_calc.json`, `data/category_code.json`, `data/category_wrong-sentence.json`, `data/category_keyword.json`, `data/category_sequence.json`
- 인덱스·저장소(작업 제외): `categories_index.json`, `exams_index.json`, `cbt_store.json`

## 제3조 이미지 파일명·경로 규칙

```text
경로 필드값: images/{examId}_q{qnum}.png
실제 파일:   public/images/{examId}_q{qnum}.png
```

- 예: `data/exam_2019-2.json`의 Q1 → `image: "images/2019-2_q1.png"` → 파일 `public/images/2019-2_q1.png`
- 파일명 `qnum`과 JSON `qnum`이 일치해야 한다. (불일치 시 시행규칙 감점)

## 제4조 표(table) 형식 규칙

```text
형식: <table>...</table> (한 줄, 최상위 태그가 <table>로 시작·종료)
구조: <tr>, <th>(헤더), <td>(데이터)
```

- 셀 병합·선·배치 때문에 HTML로 깨지면 `table` 대신 `image`를 쓴다. (추출·삽입법 제3조)

## 제5조 백업·변경 대상

작업 전 확인:

```bash
git status --short
```

주요 변경 대상:

```text
data/exam_*.json
data/category_*.json
public/images/
media_insert_report_*.txt
```

## 개정 이력

| 버전 | 날짜 | 변경 내용 | 변경 이유 |
|---|---|---|---|
| v1.0 | 2026-07-11 | 제정 | 여러 지침에 흩어진 JSON 스키마·파일명·경로 규칙을 고시로 통합 |
