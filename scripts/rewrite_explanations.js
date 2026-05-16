const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const SECTION_RE = /\[(문제 분석|풀이 과정|정답 확인|핵심 포인트)\]\n?/g;

function normalize(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownNoise(text = '') {
  return normalize(text)
    .replace(/^---$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitOldExplanation(text = '') {
  const parts = {};
  const matches = [...String(text).matchAll(SECTION_RE)];
  if (!matches.length) {
    parts.raw = stripMarkdownNoise(text);
    return parts;
  }

  for (let i = 0; i < matches.length; i += 1) {
    const name = matches[i][1];
    const start = matches[i].index + matches[i][0].length;
    const end = matches[i + 1] ? matches[i + 1].index : text.length;
    parts[name] = stripMarkdownNoise(text.slice(start, end));
  }
  return parts;
}

function firstSentence(text = '') {
  const clean = stripMarkdownNoise(text)
    .replace(/^정답:\s*[^\n]+/gm, '')
    .replace(/^핵심:\s*/gm, '')
    .replace(/^- \*\*[^*]+\*\*:\s*/gm, '- ')
    .trim();
  if (!clean) return '';
  const line = clean.split('\n').map((v) => v.trim()).find(Boolean) || '';
  return line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim();
}

function answerText(q) {
  const idx = Number(q.answer) - 1;
  if (!Array.isArray(q.options) || idx < 0 || idx >= q.options.length) return '';
  return q.options[idx];
}

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function classify(q, file) {
  const stem = String(q.stem || '');
  const options = Array.isArray(q.options) ? q.options.join(' ') : '';
  const all = `${stem}\n${options}\n${q.explanation || ''}`.toLowerCase();
  const ko = `${stem}\n${options}\n${q.explanation || ''}`;

  if (/(#include|printf|scanf|int\s+main|public\s+static|system\.out|class\s+\w+|def\s+\w+|print\(|다음\s+(c|java|python|파이썬|자바).*프로그램|프로그램이 실행|실행 결과|출력값|출력 결과)/i.test(ko)) {
    return '코드 해석형';
  }
  if (/\bselect\b/i.test(ko) && (/\bfrom\b/i.test(ko) || /\bjoin\b/i.test(ko) || /\bwhere\b/i.test(ko) || /\bgroup\s+by\b/i.test(ko))) {
    return 'SQL형';
  }
  if (/(selection sort|insertion sort|bubble sort|quick sort|merge sort|정렬|탐색|pass\s*\d|수행 순서|처리 순서|순서대로|알고리즘)/i.test(ko)) {
    return '알고리즘형';
  }
  if (/(계산|구하|크기|최대 수|최소 수|평균|몇\s|얼마|비트|바이트|k\b|kb|mb|gb|ip 주소|서브넷|복잡도|단편화|페이지 부재|page fault|주소 지정|처리량|응답 시간)/i.test(ko) || file.includes('category_calc')) {
    return '계산형';
  }
  if (/(차이|비교|공통점|구분|tcp.*udp|udp.*tcp|프로세스.*스레드|스레드.*프로세스|raid)/i.test(ko)) {
    return '개념 비교형';
  }
  if (containsAny(all, ['tcp', 'udp', 'osi', 'ip ', 'ipv4', 'ipv6', '라우팅', '프로토콜', 'http', 'dns', 'ftp', 'icmp', 'arp', '네트워크'])) {
    return '네트워크형';
  }
  if (containsAny(all, ['프로세스', '스레드', '스케줄', '교착', '세마포어', '운영체제', '가상기억', '페이지 교체', '메모리 관리'])) {
    return '운영체제형';
  }
  if (containsAny(all, ['암호', '보안', '공격', '인증', '접근제어', '해킹', '방화벽', '악성', '무결성 검사', '취약점'])) {
    return '보안형';
  }
  if (containsAny(all, ['릴레이션', '정규화', '트랜잭션', '무결성', '후보키', '기본키', '외래키', '튜플', '속성', '도메인', '카디널리티', '차수', '데이터베이스', 'ddl', 'dml', 'dcl'])) {
    return '데이터베이스형';
  }
  if (/(인 것은|아닌 것은|틀린 것은|옳은 것은|해당하는 것은|무엇인가|설명으로)/.test(stem)) {
    return '개념 암기형';
  }
  return '개념 암기형';
}

function typeReason(type) {
  const reasons = {
    '개념 암기형': '정의, 특징, 용어 의미를 골라야 하므로 개념 암기형 문제임',
    '개념 비교형': '둘 이상의 개념을 구분해야 하므로 개념 비교형 문제임',
    '알고리즘형': '처리 순서나 수행 과정을 따라가야 하므로 알고리즘형 문제임',
    '코드 해석형': '코드의 실행 결과를 변수 변화와 실행 순서로 추적해야 하므로 코드 해석형 문제임',
    'SQL형': 'SQL 문장의 처리 순서와 결과를 판단해야 하므로 SQL형 문제임',
    '데이터베이스형': '릴레이션, 키, 정규화, 트랜잭션 같은 데이터베이스 개념을 묻고 있으므로 데이터베이스형 문제임',
    '네트워크형': '프로토콜, 계층, 통신 흐름 같은 네트워크 개념을 묻고 있으므로 네트워크형 문제임',
    '운영체제형': '프로세스, 메모리, 스케줄링 같은 운영체제 동작을 묻고 있으므로 운영체제형 문제임',
    '보안형': '공격, 방어, 인증, 암호화 같은 보안 개념을 묻고 있으므로 보안형 문제임',
    '계산형': '숫자나 조건을 이용해 값을 계산해야 하므로 계산형 문제임',
  };
  return reasons[type] || reasons['개념 암기형'];
}

function typeCore(type, q) {
  const ans = answerText(q);
  const suffix = ans ? `정답 후보인 '${ans}'가 왜 맞는지 판단하는 문제` : '정답이 되는 개념을 판단하는 문제';
  const cores = {
    '코드 해석형': '코드를 실행 순서대로 따라가며 최종 결과를 찾는 문제',
    'SQL형': 'SQL 실행 순서에 따라 남는 데이터와 최종 결과를 판단하는 문제',
    '계산형': '주어진 숫자와 조건으로 정답 값을 계산하는 문제',
    '알고리즘형': '알고리즘이 단계별로 데이터를 어떻게 바꾸는지 확인하는 문제',
    '개념 비교형': '비슷한 개념의 공통점과 차이점을 구분하는 문제',
  };
  return cores[type] || suffix;
}

function conceptBlock(type, q, old) {
  const ans = answerText(q);
  const analysis = firstSentence(old['문제 분석'] || old.raw);
  const process = firstSentence(old['풀이 과정']);
  const base = analysis || process || (ans ? `${ans}의 의미를 정확히 아는 것이 핵심임` : '문제에 제시된 핵심 개념을 확인해야 함');

  const common = [
    `- 핵심 개념:`,
    `  - ${base}`,
    `  - 어려운 말은 문제에서 묻는 '판단 기준'으로 바꾸어 생각하면 쉬움`,
  ];

  if (ans) common.push(`- 정답 후보:`, `  - ${ans}`);

  const extras = {
    '코드 해석형': [
      '- 코드 해석:',
      '  - 프로그램을 위에서 아래로 실행한다고 생각함',
      '  - 변수는 값이 바뀔 때마다 따로 적어야 함',
      '  - 포인터, 배열, 반복문은 현재 위치와 값을 함께 봐야 함',
    ],
    'SQL형': [
      '- SQL 실행 순서:',
      '  - FROM에서 대상 테이블을 정함',
      '  - WHERE에서 행을 거름',
      '  - GROUP BY에서 묶음별로 모음',
      '  - HAVING에서 묶음 조건을 검사함',
      '  - SELECT에서 보여줄 값을 고름',
      '  - ORDER BY에서 정렬함',
    ],
    '계산형': [
      '- 계산 기준:',
      '  - 문제에 나온 숫자를 먼저 찾음',
      '  - 어떤 식을 써야 하는지 정함',
      '  - 중간 계산을 생략하지 않고 확인함',
    ],
    '개념 비교형': [
      '- 비교 기준:',
      '  - 공통점은 같은 범주에 속한다는 점임',
      '  - 차이점은 목적, 동작 방식, 결과에서 갈림',
      '  - 시험에서는 비슷한 말을 바꾸어 오답으로 내기 쉬움',
    ],
    '네트워크형': [
      '- 네트워크 개념:',
      '  - 데이터가 장치와 장치 사이를 이동하는 규칙을 다룸',
      '  - 계층, 프로토콜, 주소, 전송 방식을 구분해야 함',
    ],
    '운영체제형': [
      '- 운영체제 개념:',
      '  - 운영체제는 프로그램 실행과 자원 사용을 관리함',
      '  - 상태 변화와 처리 흐름을 순서대로 보면 쉬움',
    ],
    '보안형': [
      '- 보안 개념:',
      '  - 공격은 정보를 훔치거나 시스템을 방해하려는 행동임',
      '  - 방어는 인증, 암호화, 접근 제어로 위험을 줄이는 방법임',
    ],
    '데이터베이스형': [
      '- 데이터베이스 개념:',
      '  - 데이터를 표처럼 저장하고 정확하게 관리하는 방법을 다룸',
      '  - 키, 무결성, 정규화, 트랜잭션은 서로 자주 엮여 출제됨',
    ],
    '알고리즘형': [
      '- 알고리즘 개념:',
      '  - 정해진 규칙대로 데이터를 처리하는 절차임',
      '  - 한 단계가 끝날 때 데이터가 어떻게 바뀌는지 확인해야 함',
    ],
  };
  return [...common, ...(extras[type] || [])].join('\n');
}

function strategyBlock(type) {
  const base = [
    '- 먼저 문제에서 묻는 말을 확인함',
    '- 그다음 정답을 고르는 기준이 되는 개념을 찾음',
    '- 마지막으로 선택지를 하나씩 기준에 맞춰 비교함',
  ];
  const specialized = {
    '코드 해석형': [
      '- 코드는 첫 줄부터 실행 순서대로 따라감',
      '- 변수나 배열 값이 바뀌는 순간마다 적음',
      '- 출력문이 참조하는 최종 값을 확인함',
    ],
    'SQL형': [
      '- SQL은 작성 순서가 아니라 실행 순서로 봄',
      '- FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY 순서로 확인함',
      '- 각 단계에서 남는 데이터와 제거되는 데이터를 따로 적음',
    ],
    '계산형': [
      '- 문제의 숫자를 먼저 표시함',
      '- 공식이나 계산 기준을 정함',
      '- 숫자를 대입하고 중간 결과를 한 줄씩 확인함',
    ],
    '알고리즘형': [
      '- 초기 상태를 먼저 적음',
      '- 1회 수행 후 바뀐 값을 적음',
      '- 문제에서 요구한 단계까지 반복함',
    ],
    '개념 비교형': [
      '- 비교 대상을 먼저 찾음',
      '- 공통점보다 차이점을 우선 확인함',
      '- 선택지의 단어가 다른 개념과 섞였는지 확인함',
    ],
  };
  return (specialized[type] || base).join('\n');
}

function oldProcessLines(old) {
  const lines = stripMarkdownNoise(old['풀이 과정'] || old['문제 분석'] || old.raw)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 18);
  return lines.length ? lines : ['문제에 제시된 조건과 선택지를 기준으로 판단함'];
}

function processBlock(type, q, old) {
  const ans = answerText(q);
  const lines = oldProcessLines(old);
  const one = lines[0] || '';
  const two = lines.slice(1, 8).join('\n- ') || '선택지와 핵심 개념이 서로 맞는지 확인함';
  const three = lines.slice(8).join('\n- ') || (ans ? `정답 선택지 '${ans}'가 문제 조건과 일치함` : '정답이 문제 조건과 일치함');

  if (type === 'SQL형') {
    return [
      '### 1단계',
      '- FROM',
      '- SQL에서 가장 먼저 확인하는 부분임',
      '- 문제에 테이블이나 조인 조건이 제시되면 여기서 대상 데이터가 정해짐',
      '',
      '### 2단계',
      '- WHERE',
      '- 조건에 맞지 않는 행은 제거됨',
      '- WHERE가 없으면 이 단계에서 제거되는 행은 없음',
      '',
      '### 3단계',
      '- GROUP BY',
      '- 같은 값을 가진 행을 묶음으로 만듦',
      '- GROUP BY가 없으면 묶음 계산은 하지 않음',
      '',
      '### 4단계',
      '- HAVING',
      '- GROUP BY로 묶인 결과에 조건을 적용함',
      '- HAVING이 없으면 묶음 조건으로 제거되는 결과는 없음',
      '',
      '### 5단계',
      '- SELECT',
      '- 최종적으로 보여줄 열이나 계산식을 고름',
      `- 이 문제의 판단 근거: ${one}`,
      '',
      '### 6단계',
      '- ORDER BY',
      '- 결과를 정렬함',
      '- ORDER BY가 없으면 별도 정렬 기준은 적용하지 않음',
      `- 최종적으로 ${ans ? `'${ans}'` : '정답'}이 문제 조건과 일치함`,
    ].join('\n');
  }

  if (type === '코드 해석형') {
    return [
      '### 1단계',
      '- 코드의 목적을 먼저 봄',
      `- ${one}`,
      '- 변수와 배열은 값이 바뀔 때마다 따로 추적해야 함',
      '',
      '### 2단계',
      '- 실행 흐름과 변수 변화를 확인함',
      `- ${two}`,
      '',
      '### 3단계',
      '- 출력문이 참조하는 최종 값을 확인함',
      `- ${three}`,
      `- 따라서 최종 출력 또는 결과는 ${ans ? `'${ans}'` : '정답 선택지'}와 연결됨`,
    ].join('\n');
  }

  if (type === '계산형') {
    return [
      '### 1단계',
      '- 계산에 필요한 조건을 찾음',
      `- ${one}`,
      '',
      '### 2단계',
      '- 식을 세우고 숫자를 대입함',
      `- ${two}`,
      '',
      '### 3단계',
      '- 중간 결과와 선택지를 비교함',
      `- ${three}`,
      `- 검산 기준: 계산 결과가 선택지 ${q.answer}번과 같은지 확인함`,
    ].join('\n');
  }

  if (type === '알고리즘형') {
    return [
      '### 1단계',
      '- 초기 상태와 알고리즘 규칙을 확인함',
      `- ${one}`,
      '',
      '### 2단계',
      '- 단계별로 데이터가 어떻게 바뀌는지 추적함',
      `- ${two}`,
      '',
      '### 3단계',
      '- 문제에서 요구한 단계의 결과를 선택지와 비교함',
      `- ${three}`,
    ].join('\n');
  }

  return [
    '### 1단계',
    '- 문제에서 묻는 핵심 용어를 확인함',
    `- ${one}`,
    '',
    '### 2단계',
    '- 핵심 개념과 선택지를 비교함',
    `- ${two}`,
    '',
    '### 3단계',
    '- 문제 조건과 가장 정확히 맞는 선택지를 고름',
    `- ${three}`,
    `- 그래서 ${q.answer}번이 정답임`,
  ].join('\n');
}

function optionAnalysis(q, old) {
  if (!Array.isArray(q.options) || q.options.length === 0) {
    return '- 선택지 없음';
  }
  const ans = Number(q.answer);
  const basis = firstSentence(old['문제 분석'] || old['풀이 과정'] || old.raw) || '문제의 핵심 개념';
  const negative = /(틀린 것은|아닌 것은|해당하지 않는|볼 수 없는|옳지 않은|않은 것은|없는 것은)/.test(String(q.stem || ''));
  return q.options.map((opt, idx) => {
    const n = idx + 1;
    let verdict;
    if (n === ans && negative) {
      verdict = `- 맞음. '${opt}'은/는 문제에서 요구한 '틀린 설명/해당하지 않는 것'에 해당함`;
    } else if (n === ans) {
      verdict = `- 맞음. '${opt}'은/는 문제에서 묻는 조건과 일치함`;
    } else if (negative) {
      verdict = `- 틀림. '${opt}'은/는 ${basis}에 비추어 볼 때 문제에서 요구한 오답 설명이 아님`;
    } else {
      verdict = `- 틀림. '${opt}'은/는 ${basis}와 정확히 일치하지 않음`;
    }
    return [`### ${n}번`, verdict].join('\n');
  }).join('\n\n');
}

function mistakeBlock(type) {
  const map = {
    '코드 해석형': '- 실행하지 않은 줄의 값을 미리 정답으로 고르기 쉬움\n- 배열 인덱스는 보통 0부터 시작한다는 점을 놓치기 쉬움\n- 출력문이 실제로 어떤 변수를 보는지 확인해야 함',
    'SQL형': '- SQL 작성 순서와 실행 순서를 헷갈리기 쉬움\n- WHERE는 행을 거르고 HAVING은 그룹 결과를 거름\n- SELECT보다 FROM과 WHERE가 먼저 처리됨',
    '계산형': '- 문제에 나온 숫자를 하나 빼먹기 쉬움\n- 단위를 맞추지 않고 계산하면 오답이 나옴\n- 중간 계산을 건너뛰면 선택지 함정에 걸리기 쉬움',
    '알고리즘형': '- 1회 수행 결과와 최종 결과를 헷갈리기 쉬움\n- 정렬 문제는 PASS 번호를 정확히 봐야 함\n- 현재 단계에서 바뀐 값만 확인해야 함',
    '개념 비교형': '- 비슷한 용어를 같은 뜻으로 착각하기 쉬움\n- 공통점보다 차이점을 기준으로 골라야 함\n- 선택지의 단어 하나가 바뀌면 정답이 달라질 수 있음',
    '네트워크형': '- 계층 이름과 프로토콜 이름을 섞어 외우기 쉬움\n- TCP는 신뢰성, UDP는 속도 중심이라는 큰 기준을 먼저 잡아야 함',
    '운영체제형': '- 프로세스와 스레드를 혼동하기 쉬움\n- 상태 변화나 자원 사용 흐름을 순서대로 보지 않으면 틀리기 쉬움',
    '보안형': '- 공격 기법과 방어 기법을 반대로 외우기 쉬움\n- 인증, 인가, 암호화를 같은 개념으로 착각하기 쉬움',
    '데이터베이스형': '- 키 종류와 무결성 종류를 혼동하기 쉬움\n- 릴레이션 용어는 행과 열로 바꾸어 생각하면 쉬움',
  };
  return map[type] || '- 용어의 정확한 뜻보다 익숙한 단어만 보고 고르기 쉬움\n- 문제에서 묻는 것이 맞는 설명인지 틀린 설명인지 먼저 확인해야 함';
}

function memoryTip(type, q) {
  const ans = answerText(q);
  const prefix = ans ? `- 정답 키워드: ${ans}` : '- 정답 키워드를 먼저 표시해 둠';
  const map = {
    '코드 해석형': '- 코드 문제는 “초깃값 → 변경값 → 출력값” 순서로 외움',
    'SQL형': '- SQL 실행 순서 암기: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY',
    '계산형': '- 계산 문제는 “공식 → 대입 → 중간값 → 정답” 순서로 적음',
    '알고리즘형': '- 알고리즘 문제는 “초기 상태 → 1회 수행 → 요구 단계” 순서로 적음',
    '개념 비교형': '- 비교 문제는 두 개념을 한 줄씩 나란히 놓고 차이만 표시함',
    '네트워크형': '- 네트워크는 “계층, 프로토콜, 주소, 전송 방식” 네 단어로 정리함',
    '운영체제형': '- 운영체제는 “프로세스, 메모리, 파일, 입출력 관리”를 큰 틀로 잡음',
    '보안형': '- 보안은 “공격 목적”과 “방어 방법”을 짝으로 외움',
    '데이터베이스형': '- 데이터베이스는 “행=튜플, 열=속성, 표=릴레이션”으로 바꾸어 외움',
  };
  return [prefix, map[type] || '- 용어 이름과 쉬운 뜻을 한 쌍으로 외움'].join('\n');
}

function examPoint(type) {
  const map = {
    '코드 해석형': '- 배열, 포인터, 반복문, 조건문을 섞어 출력값을 묻는 방식으로 자주 나옴\n- 변수 변화표를 만들면 실수를 줄일 수 있음',
    'SQL형': '- JOIN, GROUP BY, HAVING, ORDER BY 결과를 묻는 형태로 자주 나옴\n- DDL, DML, DCL 명령어 구분과 함께 출제될 수 있음',
    '계산형': '- IP 계산, 페이지 교체, 단편화, 복잡도처럼 공식 적용 문제로 변형됨\n- 중간 계산이 선택지로 나오는 경우가 많음',
    '알고리즘형': '- 정렬의 PASS 결과나 탐색 과정을 묻는 형태로 자주 나옴\n- 최종 결과가 아니라 중간 단계를 묻는 경우가 많음',
    '개념 비교형': '- TCP/UDP, 프로세스/스레드, 키 종류처럼 비슷한 개념 비교로 자주 나옴\n- “옳지 않은 것” 문제로 바뀌어 출제될 수 있음',
    '네트워크형': '- OSI 7계층, TCP/IP, 라우팅, 프로토콜 기능이 함께 출제됨\n- 계층과 장비를 연결하는 문제가 자주 나옴',
    '운영체제형': '- 스케줄링, 교착상태, 페이지 교체, 프로세스 상태 전이가 자주 나옴\n- 흐름도나 조건 계산과 함께 나올 수 있음',
    '보안형': '- 암호화, 인증, 접근 제어, 공격 기법을 구분하는 문제가 자주 나옴\n- 공격 이름과 동작 방식을 연결해 묻는 경우가 많음',
    '데이터베이스형': '- 정규화, 키, 무결성, 트랜잭션, SQL 명령어가 함께 출제됨\n- 용어를 행과 열의 쉬운 말로 바꾸면 빠르게 판단할 수 있음',
  };
  return map[type] || '- 정의와 특징을 바꾸어 묻는 형태로 자주 출제됨\n- 맞는 설명인지 틀린 설명인지 먼저 확인해야 함';
}

function rewriteQuestion(q, file) {
  if (String(q.explanation || '').trim().startsWith('## 문제 유형')) {
    return q;
  }

  const type = classify(q, file);
  const old = splitOldExplanation(q.explanation || '');
  const ans = answerText(q);
  const reason = firstSentence(old['풀이 과정'] || old['문제 분석'] || old.raw) || (ans ? `${ans}이 문제 조건과 일치함` : '문제 조건과 정답이 일치함');

  const out = [
    '## 문제 유형',
    `- ${type}`,
    '',
    '## 유형 판단 이유',
    `- ${typeReason(type)}`,
    '- 문제 원문과 선택지에서 요구하는 판단 방식이 이 유형의 특징과 맞음',
    '',
    '## 문제 핵심',
    `- ${typeCore(type, q)}`,
    '',
    '## 핵심 개념',
    conceptBlock(type, q, old),
    '',
    '## 풀이 전략',
    strategyBlock(type),
    '',
    '## 풀이 과정',
    processBlock(type, q, old),
    '',
    '## 선택지 분석',
    optionAnalysis(q, old),
    '',
    '## 초보자 실수 포인트',
    mistakeBlock(type),
    '',
    '## 암기 팁',
    memoryTip(type, q),
    '',
    '## 시험 출제 포인트',
    examPoint(type),
    '',
    '## 정답',
    `- 정답: ${q.answer}${ans ? `번 - ${ans}` : ''}`,
    `- 정답 이유 한 줄 요약: ${reason}`,
    '',
    '## 한 줄 요약',
    `- ${typeCore(type, q)}`,
  ].join('\n');

  return { ...q, explanation: normalize(out) };
}

function rewriteFile(file) {
  const full = path.join(DATA_DIR, file);
  const json = JSON.parse(fs.readFileSync(full, 'utf8'));
  let changed = false;

  if (Array.isArray(json)) {
    for (let i = 0; i < json.length; i += 1) {
      if ('explanation' in json[i]) {
        json[i] = rewriteQuestion(json[i], file);
        changed = true;
      }
    }
  } else if (Array.isArray(json.questions)) {
    json.questions = json.questions.map((q) => {
      if (!('explanation' in q)) return q;
      changed = true;
      return rewriteQuestion(q, file);
    });
  }

  if (changed) {
    const prev = fs.readFileSync(full, 'utf8');
    const next = `${JSON.stringify(json, null, 2)}\n`;
    if (next !== prev) {
      fs.writeFileSync(full, next, 'utf8');
      return true;
    }
  }
  return false;
}

const files = fs.readdirSync(DATA_DIR)
  .filter((file) => file.endsWith('.json'))
  .filter((file) => !['categories_index.json', 'exams_index.json', 'cbt_store.json'].includes(file));

let count = 0;
for (const file of files) {
  if (rewriteFile(file)) count += 1;
}

console.log(`Rewrote explanations in ${count} files.`);
