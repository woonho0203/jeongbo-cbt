# 정보처리기사 필기 CBT 학습 시스템

본인 보유 정보처리기사 필기 PDF에서 추출한 기출·유형별 문제를 원본에 맞게 보존하고, 정답 근거와 오답 이유를 학습할 수 있게 만든 CBT(Computer-Based Test) 웹 앱입니다.

## 현재 데이터

2026-07-26 저장소 기준:

| 분류 | 파일 수 | 문제 수 | 원본 |
|---|---:|---:|---|
| 회차별 기출(2016~2025) | 29 | 2,900 | 각 회차별 PDF |
| 유형별 연습 | 5 | 668 | 각 유형별 PDF |
| 합계 | 34 | 3,568 | 보유 PDF 34개 |

유형별 구성:

| 유형 | 문제 수 |
|---|---:|
| 필수 계산 | 41 |
| 필수 코드 | 57 |
| 잘못된 문장 찾기 | 197 |
| 키워드 찾기 | 259 |
| 종류·순서 | 114 |

`category_*.json`은 회차 데이터의 복제본이 아닙니다. 각 유형별 PDF를 독립 원본으로 삼아 검수합니다.

위 수치는 JSON 로딩·문항 수 기준입니다. 모든 문항의 PDF 대조와 해설 품질 검수가 끝났다는 뜻은 아니며, 진행 상황과 미해결 사항은 `정보처리기사CBT_지침체계/08_운영기록/`에서 관리합니다.

## 주요 기능

- 29개 회차별 기출 풀이와 150분 타이머
- 회차·유형 문제를 합친 과목 균형 랜덤 모의고사
- 5개 유형별 연습과 즉시 채점 모드
- 오답 노트, 북마크, OMR 이동
- 보기 순서 무작위 배치와 해설 번호 자동 재매핑
- 과목별 점수·합격 기준·응시 이력·학습 통계
- 이미지, HTML 표, KaTeX 수식 렌더링
- 키보드 단축키: `1`~`4`, `←`, `→`

## 폴더 구조

```text
정보처리기사_CBT/
├── server/
│   ├── index.js       # Node.js 내장 http 기반 API·정적 파일 서버
│   ├── loader.js      # exam/category JSON 로더와 문제 인덱스
│   └── store.js       # 로컬 서버용 JSON 학습 기록 저장소
├── public/
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── exam.js
│   │   ├── main.js
│   │   ├── router.js
│   │   ├── storage.js # 브라우저 localStorage
│   │   ├── util.js
│   │   └── views.js
│   ├── images/
│   └── vendor/katex/
├── data/
│   ├── exam_*.json
│   ├── category_*.json
│   ├── exams_index.json
│   ├── categories_index.json
│   └── cbt_store.json
├── scripts/           # PDF 추출·복원·해설 보조·버전 관리 스크립트
├── 정보처리기사 문제/ # 독립 원본 PDF 34개
├── 정보처리기사CBT_지침체계/
├── package.json
├── start.sh
└── vercel.json
```

## 실행 방법

요구 사항:

- Node.js 18 이상
- PDF를 다시 추출할 때만 Python 3와 `pdfplumber`

처음 실행:

```bash
cd /Users/woonho/Desktop/개발/정보처리기사_CBT
npm install
npm start
```

또는:

```bash
./start.sh
```

브라우저에서 [http://localhost:3000](http://localhost:3000)에 접속합니다. 기본 포트는 `3000`이며 `PORT` 환경 변수로 바꿀 수 있습니다.

## 데이터와 학습 기록

- 문제 데이터: `data/exam_*.json`, `data/category_*.json`
- PDF 매핑: `정보처리기사CBT_지침체계/05_고시_훈령_예규/고시_추출삽입_PDF매핑_저장규칙_v1.3.md`
- 브라우저 학습 기록: `localStorage`가 주 저장소입니다.
- 로컬 서버도 `data/cbt_store.json`에 응시 기록·오답·북마크를 저장합니다.
- Vercel의 서버 파일 저장소는 영구 저장소가 아니므로, 브라우저 기록을 기준으로 사용합니다.

## 데이터 작업 원칙

- 문제 원문·보기·정답은 자기 독립 원본 PDF 대조 없이 변경하지 않습니다.
- 단일 정답은 정수, 공식 복수·전항정답은 정수 배열로 저장합니다.
- 모든 회차 문항은 `subject`와 `subjectName`을 함께 저장합니다.
- `image`와 `table`은 한 방식 사용이 원칙이며, 승인된 원본 재현 예외만 함께 사용합니다.
- 수정 후 JSON 스키마·인덱스·이미지 경로·앱 API를 다시 검수합니다.

프로젝트의 최상위 기준은 `정보처리기사CBT_지침체계/01_헌법/헌법_정보처리기사CBT_정체성헌법_v1.0.md`입니다.
