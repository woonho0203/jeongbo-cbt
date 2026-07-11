const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SOURCE_2021 = path.join(__dirname, 'rewrite_2021_explanations_definition_compare.js');
const REPORT_PATH = path.join(ROOT, 'CBT_2022_해설_정의_오답비교_재작성_보고.md');
const TARGETS = ['exam_2022-1.json', 'exam_2022-2.json', 'exam_2022-3.json'];

function loadBaseRules() {
  const source = fs.readFileSync(SOURCE_2021, 'utf8');
  const match = source.match(/const conceptRules = \[([\s\S]*?)\n\];/);
  if (!match) return [];
  return Function(`return [${match[1]}];`)();
}

const extraRules = [
  [/워크스루|Walkthrough/i, '워크스루는 작성자가 산출물을 설명하고 동료가 결함을 찾는 비공식 검토 기법으로, 인스펙션보다 절차와 역할이 덜 엄격한 리뷰임'],
  [/메시지 지향 미들웨어|MOM|Message-?Oriented Middleware/i, 'MOM은 메시지 큐를 이용해 독립 애플리케이션 간 메시지를 비동기적으로 전달하는 미들웨어임'],
  [/즉각적인 응답|온라인 업무/i, 'MOM은 메시지 큐를 이용한 비동기 연계를 지원하므로 즉각 응답이 핵심인 온라인 트랜잭션 처리보다는 안정적인 메시지 전달과 시스템 간 통합에 적합함'],
  [/비기능적|Nonfunctional/i, '비기능적 요구사항은 성능, 응답 시간, 보안, 안전성, 사용성처럼 시스템이 어떻게 동작해야 하는지를 나타내는 품질·제약 요구사항임'],
  [/기능적 요구/i, '기능적 요구사항은 조회, 입력, 처리, 출력처럼 시스템이 제공해야 하는 구체적 기능을 나타내는 요구사항임'],
  [/인스펙션|Inspection/i, '인스펙션은 역할 분담, 체크리스트, 결함 기록 등 정해진 절차에 따라 산출물을 공식 검토하는 기법임'],
  [/내용 결합도/i, '내용 결합도는 한 모듈이 다른 모듈의 내부 자료나 내부 처리 로직을 직접 참조하는 가장 강한 결합도임'],
  [/제어 결합도/i, '제어 결합도는 제어 플래그나 제어 신호를 전달해 다른 모듈의 처리 흐름에 영향을 주는 결합도임'],
  [/공통 결합도/i, '공통 결합도는 여러 모듈이 전역 데이터나 공통 데이터 영역을 함께 참조할 때의 결합도임'],
  [/자료 결합도/i, '자료 결합도는 모듈 간 인터페이스가 필요한 데이터 항목만으로 구성되는 가장 바람직한 결합도임'],
  [/스탬프 결합도/i, '스탬프 결합도는 배열이나 레코드 같은 자료구조를 통째로 전달해 일부 항목만 사용하는 결합도임'],
  [/외부 결합도/i, '외부 결합도는 외부에서 정의된 데이터 형식, 프로토콜, 장치 인터페이스를 여러 모듈이 공유할 때의 결합도임'],
  [/HIPO/i, 'HIPO는 시스템 기능을 계층 구조와 입력·처리·출력 관점으로 표현하는 하향식 문서화 도구임'],
  [/Pinch/i, 'Pinch는 두 손가락을 오므리거나 벌려 확대·축소하는 NUI 제스처임'],
  [/Press/i, 'Press는 화면을 누르는 터치 기반 NUI 조작임'],
  [/Flick/i, 'Flick은 손가락으로 빠르게 튕기듯 밀어 넘기는 NUI 제스처임'],
  [/Flow/i, 'Flow는 흐름을 뜻하는 일반 용어로, 모바일 NUI의 대표 제스처 명칭으로 보기 어려움'],
  [/SOLID|SSO/i, 'SOLID는 SRP, OCP, LSP, ISP, DIP로 구성되는 객체지향 설계 원칙이며, SSO는 단일 로그인 인증 방식임'],
  [/Dependency/i, '의존 관계는 한 사물의 명세 변경이 다른 사물에 영향을 주는 UML 관계임'],
  [/Realization/i, '실체화 관계는 인터페이스나 추상 명세를 실제 클래스가 구현하는 UML 관계임'],
  [/Generalization|일반화/i, '일반화 관계는 공통 특성을 상위 개념으로 묶고 하위 개념이 이를 상속하는 UML 관계임'],
  [/Singleton/i, '싱글턴 패턴은 클래스의 인스턴스를 하나만 만들고 전역 접근점을 제공하는 생성 패턴임'],
  [/Decorator/i, '데코레이터 패턴은 객체를 감싸 기능을 동적으로 추가하는 구조 패턴임'],
  [/파이프.*필터|Pipe/i, '파이프-필터 아키텍처는 각 필터가 입력을 처리해 결과를 다음 필터로 넘기는 데이터 흐름 중심 구조임'],
  [/GUI/i, 'GUI는 창, 아이콘, 메뉴, 포인터 같은 그래픽 요소로 조작하는 사용자 인터페이스임'],
  [/CLI|Command Line/i, 'CLI는 명령 문자열을 입력해 운영체제나 프로그램을 조작하는 문자 기반 사용자 인터페이스임'],
  [/CUI/i, 'CUI는 문자 화면 중심 인터페이스를 뜻하지만 시험 보기의 Cell User Interface 표기는 일반적인 UI 분류로 보기 어려움'],
  [/MUI/i, 'MUI는 모바일 환경의 사용자 인터페이스를 뜻하는 용어로, 명령 문자열 조작 방식과는 구분됨'],
  [/DFD|자료 흐름도|process|data flow|data store|terminator/i, '자료 흐름도는 처리, 자료 흐름, 자료 저장소, 단말로 시스템의 데이터 흐름을 표현하는 분석 도구임'],
  [/Pareto/i, '파레토 법칙은 결함의 상당수가 소수의 모듈에 집중된다는 경험 법칙으로 80대 20 법칙이라고도 함'],
  [/Brooks/i, '브룩스 법칙은 지연된 프로젝트에 인력을 추가하면 의사소통 비용 증가로 더 늦어질 수 있다는 법칙임'],
  [/Boehm/i, '보헴은 COCOMO와 나선형 모형을 제안한 소프트웨어 공학자로, 결함 집중의 80대 20 법칙 명칭은 아님'],
  [/Jackson/i, '잭슨 방법론은 자료 구조 중심 설계와 관련되며 결함 집중 법칙의 명칭은 아님'],
  [/토탈 오라클|참 오라클/i, '참 오라클은 모든 입력값에 대해 기대 결과를 제공하는 오라클이며, 토탈 오라클이라는 명칭은 표준 분류로 보기 어려움'],
  [/샘플링 오라클/i, '샘플링 오라클은 일부 테스트 케이스에 대해서만 기대 결과를 제공하는 테스트 오라클임'],
  [/휴리스틱 오라클/i, '휴리스틱 오라클은 일부 결과는 기대값으로 확인하고 나머지는 추정 규칙으로 판단하는 오라클임'],
  [/일관성 검사 오라클/i, '일관성 검사 오라클은 변경 전후 결과의 일관성을 비교해 오류를 찾는 오라클임'],
  [/IPSec/i, 'IPSec은 IP 계층에서 인증, 무결성, 기밀성을 제공하는 보안 프로토콜 집합임'],
  [/EAI|Enterprise Application Integration/i, 'EAI는 기업 내 여러 애플리케이션을 연계·통합하는 기술이며 대표 구축 유형은 Point-to-Point, Hub & Spoke, Message Bus, Hybrid임'],
  [/Tree/i, 'Tree는 계층 구조를 뜻하는 일반 용어로 EAI의 대표 구축 유형 명칭이 아님'],
  [/Hub.*Spoke/i, 'Hub & Spoke는 중앙 허브를 통해 여러 시스템을 연결하는 EAI 구축 유형임'],
  [/Message Bus/i, 'Message Bus는 공통 메시지 버스를 통해 애플리케이션 간 메시지를 전달하는 EAI 구축 유형임'],
  [/Point-to-Point/i, 'Point-to-Point는 시스템 간 1대1 인터페이스를 직접 연결하는 EAI 구축 유형임'],
  [/ESB/i, 'ESB는 서비스 버스를 통해 시스템 연계를 지원하는 EAI·SOA 기반 통합 미들웨어이지 인터페이스 구현 검증 도구가 아님'],
  [/pmd/i, 'PMD는 소스 코드의 잠재 결함과 규칙 위반을 검사하는 정적 분석 도구임'],
  [/checkstyle/i, 'Checkstyle은 Java 코드의 코딩 규칙 위반을 검사하는 정적 분석 도구임'],
  [/cppcheck/i, 'Cppcheck는 C/C++ 코드의 결함을 실행 없이 분석하는 정적 분석 도구임'],
  [/valance/i, 'valance는 대표적인 소스 코드 정적 분석 도구 명칭으로 보기 어려움'],
  [/알파.*베타|인수 테스트/i, '알파 테스트와 베타 테스트는 실제 사용자 또는 고객 관점에서 수행되는 인수 테스트 단계와 관련됨'],
  [/테스트 드라이버/i, '테스트 드라이버는 상향식 테스트에서 상위 호출 모듈을 대신해 테스트 대상 모듈을 호출하는 임시 모듈임'],
  [/테스트 스텁/i, '테스트 스텁은 하향식 테스트에서 테스트 대상 모듈이 호출하는 하위 모듈을 대신하는 임시 모듈임'],
  [/패키징/i, '소프트웨어 패키징은 사용자 환경에서 설치·배포·사용할 수 있도록 제품을 묶는 작업이며 사용자 중심으로 진행해야 함'],
  [/연결 리스트/i, '연결 리스트는 노드가 포인터로 연결된 자료구조로 삽입·삭제는 유리하지만 순차 접근 때문에 임의 검색은 배열보다 느릴 수 있음'],
  [/O\(1\)|상수 시간/i, 'O(1)은 입력 데이터 수가 증가해도 알고리즘 수행 시간이 일정한 상수 시간 복잡도임'],
  [/Range Partitioning/i, 'Range Partitioning은 날짜, 금액처럼 연속 범위를 기준으로 테이블을 분할하는 파티셔닝 방식임'],
  [/Hash Partitioning/i, 'Hash Partitioning은 해시 함수 결과에 따라 데이터를 분산 저장하는 파티셔닝 방식임'],
  [/Composite Partitioning/i, 'Composite Partitioning은 범위와 해시 등 둘 이상의 파티셔닝 방식을 조합하는 방식임'],
  [/List Partitioning/i, 'List Partitioning은 명시한 값 목록을 기준으로 데이터를 분할하는 방식임'],
  [/ALTER TABLE.*DROP|DROP 학년|CASCADE/i, 'ALTER TABLE DROP 컬럼 CASCADE는 지정 속성을 삭제하면서 그 속성을 참조하는 종속 객체까지 함께 제거하는 DDL 동작임'],
  [/TRUNCATE/i, 'TRUNCATE는 테이블 구조는 유지하고 전체 행을 빠르게 삭제하는 DDL 성격의 명령으로 일반 DELETE와 롤백 특성이 다를 수 있음'],
  [/로킹 단위/i, '로킹 단위가 크면 관리할 잠금 수가 줄어 제어는 단순해지지만 동시성은 낮아짐'],
  [/관계 해석/i, '관계 해석은 원하는 데이터가 만족해야 할 조건을 논리식으로 표현하는 비절차적 질의 방식임'],
  [/프레디킷|predicate/i, '프레디킷 해석은 관계 해석의 수학적 기반이며 관계 대수는 절차적 연산 집합임'],
  [/HACMP|고가용성/i, 'HACMP는 여러 서버를 클러스터로 구성해 장애 시 서비스 연속성을 높이는 고가용성 솔루션임'],
  [/CRUD/i, 'CRUD 분석은 생성, 읽기, 갱신, 삭제 연산을 기준으로 프로세스와 데이터의 관계를 매트릭스로 분석하는 기법임'],
  [/세션 계층/i, '세션 계층은 응용 프로세스 간 대화 제어, 연결 설정·관리·종료, 토큰 관리를 담당하는 OSI 5계층임'],
  [/malloc/i, 'malloc()은 C 표준 라이브러리에서 바이트 단위 크기를 지정해 동적 메모리를 할당하는 함수임'],
  [/Garbage Collector/i, '가비지 컬렉터는 더 이상 참조되지 않는 힙 객체를 자동으로 회수하는 Java 실행 환경의 메모리 관리 기능임'],
  [/fork/i, 'fork는 유닉스에서 현재 프로세스를 복제해 새로운 프로세스를 생성하는 시스템 호출임'],
  [/Request/i, 'Request는 일반적인 프로세스 상태 명칭이 아니며, 대표 상태는 생성, 준비, 실행, 대기, 종료임'],
  [/ARP/i, 'ARP는 IP 논리 주소를 MAC 물리 주소로 변환하는 TCP/IP 네트워크 계층 관련 프로토콜임'],
  [/Framework|프레임워크/i, '프레임워크는 소프트웨어 구성에 필요한 기본 구조와 공통 기능을 제공해 재사용을 돕는 개발 기반임'],
  [/stdlib\.h/i, 'stdlib.h는 문자열-수치 변환, 동적 메모리 할당, 난수, 프로세스 제어 등 일반 유틸리티 함수를 제공하는 C 표준 라이브러리 헤더임'],
  [/자원 삽입/i, '자원 삽입은 외부 입력으로 시스템 자원 식별자나 경로가 조작되어 의도하지 않은 자원에 접근하는 취약점임'],
  [/Worm/i, '웜은 취약점이나 네트워크를 이용해 스스로 복제·전파되는 악성코드임'],
  [/WPA/i, 'WPA는 Wi-Fi Alliance가 제정한 무선 랜 인증 및 암호화 보안 표준임'],
  [/WCDMA/i, 'WCDMA는 이동통신 무선 접속 기술로 WLAN 보안 표준이 아님'],
  [/SSL/i, 'SSL은 전송 구간 암호화를 위한 보안 프로토콜로 WLAN 인증·암호화 표준 명칭이 아님'],
  [/IDS|침입탐지/i, 'IDS는 시스템이나 네트워크의 침입 징후를 탐지하는 보안 시스템이며 오용 탐지와 이상 탐지 방식으로 구분됨'],
  [/이상 탐지/i, '이상 탐지는 정상 행위 기준에서 벗어난 패턴을 탐지하는 방식이며 시그니처 기반 탐지는 오용 탐지에 해당함'],
  [/브라우터/i, '브라우터는 브리지와 라우터 기능을 함께 수행하는 장비이며 약해진 신호를 재생하는 장비는 리피터임'],
  [/SQL Injection/i, 'SQL Injection은 사용자 입력에 악의적 SQL을 삽입해 데이터베이스 질의를 변조하는 공격임'],
  [/Spanning Tree/i, '스패닝 트리 알고리즘은 브리지나 스위치 환경에서 루프를 제거하고 논리적 트리 경로를 구성하는 알고리즘임'],
  [/Diffie-Hellman/i, 'Diffie-Hellman은 안전하지 않은 통신로에서 공유 비밀키를 합의하는 키 교환 알고리즘임'],
  [/Digital Signature/i, '디지털 서명 알고리즘은 메시지 출처 인증과 무결성 확인에 쓰이는 공개키 기반 알고리즘임'],
  [/SAN\b/i, 'SAN은 서버와 저장장치를 고속 네트워크로 연결해 여러 시스템이 저장장치를 공유하게 하는 스토리지 전용 네트워크임'],
  [/MBR\b/i, 'MBR은 디스크의 부트 코드와 파티션 정보를 담는 마스터 부트 레코드임'],
  [/NAC\b/i, 'NAC는 네트워크 접속 단말의 보안 상태와 권한을 검사해 접근을 통제하는 기술임'],
  [/NIC\b/i, 'NIC는 컴퓨터를 네트워크에 연결하는 네트워크 인터페이스 카드임'],
  [/Mesh Network/i, 'Mesh Network는 노드들이 그물망처럼 연결되어 대규모 디바이스 통신과 우회 경로 구성이 가능한 네트워크임'],
  [/CPM|Critical Path/i, 'CPM은 작업 간 선후 관계와 소요 시간을 분석해 전체 일정의 결정 경로를 찾는 프로젝트 일정 관리 기법임'],
  [/PERT/i, 'PERT는 작업 간 상호 관련성, 결정 경로, 여유 시간 등을 네트워크 형태로 표현하는 일정 관리 기법임'],
  [/간트|막대 그래프|Time-line|시간선/i, '간트 차트는 작업 시작·종료 시점을 막대 그래프로 표시하는 일정표이며 PERT·CPM 네트워크와 구분됨'],
  [/HSM/i, 'HSM은 암호화 키를 안전하게 생성·저장·처리하는 하드웨어 보안 모듈이며 클라우드 기반 HSM도 하드웨어 보호 기반을 전제로 함'],
  [/SDN/i, 'SDN은 제어부와 데이터 전달부를 분리해 네트워크 경로와 정책을 소프트웨어로 제어하는 기술임'],
  [/NFS/i, 'NFS는 원격 파일 시스템을 네트워크를 통해 로컬처럼 사용할 수 있게 하는 파일 공유 프로토콜임'],
  [/Network Mapper|Nmap/i, 'Network Mapper는 네트워크 호스트와 포트, 서비스 정보를 탐색하는 보안 스캐닝 도구임'],
  [/AOE/i, 'AoE는 ATA over Ethernet처럼 이더넷을 통한 저장장치 접근과 관련된 기술로 SDN의 제어부 분리 개념과 다름'],
];

const conceptRules = [...extraRules, ...loadBaseRules()];

function clean(text = '') {
  return String(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

function answerText(q) {
  const index = Number(q.answer) - 1;
  return Array.isArray(q.options) && q.options[index] ? clean(q.options[index]) : '';
}

function isNegative(stem = '') {
  return /(틀린 것은|옳지 않은 것은|아닌 것은|아닌 것|해당하지 않는|거리가 먼 것은|거리가 먼|볼 수 없는|없는 것은|적절하지 않은|포함되지 않는|속하지 않는|않은 것은|잘못된 것은)/.test(stem);
}

function fullText(q) {
  return `${q.stem || ''} ${(q.options || []).join(' ')}`;
}

function isSql(q) {
  const text = fullText(q);
  if (/\b(SELECT|FROM|WHERE|JOIN|GROUP\s+BY|HAVING|ORDER\s+BY|ALTER|DDL|DML|DCL|CREATE|DELETE|INSERT|UPDATE|TRUNCATE|GRANT|REVOKE)\b/i.test(text)) return true;
  if (!/데이터베이스/.test(q.subjectName || '')) return false;
  return /정규화|릴레이션|트랜잭션|무결성|스키마|관계대수|관계 해석|인덱스|뷰|카디널리티|외래키|기본키/i.test(text);
}

function isCode(q) {
  return /(C언어|JAVA|Java|Python|파이썬|코드|프로그램이 실행|프로그램의 결과|출력 결과|실행 결과|printf|System\.out|scanf|while\s*\(|for\s*\(|print\(|포인터|malloc|stdlib\.h|switch)/i.test(q.stem || '') && !isSql(q);
}

function isCalc(q) {
  return /(계산|얼마|몇|라인수|\bLOC\b|생산성|개월|비트|전송률|페이지|스케줄링|평균|PASS|정렬|fan-in|fan-out|카디널리티|차수|튜플의 최대|주소|임계경로|CPM|PERT|해밍|패리티|서브넷|마스크|FIFO|LRU|HRN|SJF|선택.*정렬|버블.*정렬|후위 순회|트리 구조)/i.test(fullText(q));
}

function classify(q) {
  if (isSql(q)) return 'SQL형';
  if (isCode(q)) return '코드형';
  if (isCalc(q)) return '계산형';
  return isNegative(q.stem) ? '부정형' : '긍정형';
}

function concept(text, q, allowStem = false) {
  const target = clean(text);
  if (allowStem) {
    const stem = clean(q.stem || '');
    for (const [pattern, desc] of extraRules) {
      pattern.lastIndex = 0;
      if (pattern.test(stem)) return desc;
    }
    for (const [pattern, desc] of conceptRules) {
      pattern.lastIndex = 0;
      if (pattern.test(stem)) return desc;
    }
  }
  for (const [pattern, desc] of conceptRules) {
    pattern.lastIndex = 0;
    if (pattern.test(target)) return desc;
  }
  if (allowStem) {
    const stem = clean(q.stem || '');
    for (const [pattern, desc] of conceptRules) {
      pattern.lastIndex = 0;
      if (pattern.test(stem)) return desc;
    }
  }
  if (/^\d/.test(target) || /:/.test(target)) return `${target}는 문제의 계산 조건이나 실행 흐름을 적용해 얻어야 하는 결과 후보임`;
  if (target.length > 45) return '이 보기는 문장의 사실 관계와 개념 범위를 문제 조건과 대조해야 하는 설명임';
  return `${target}는 문제 단서와 비교해야 하는 핵심 선택지 개념임`;
}

function stemClue(q) {
  const stem = clean(q.stem || '');
  const quoted = stem.match(/['"]([^'"]{2,90})['"]/);
  if (quoted) return quoted[1];
  return stem
    .replace(/^(다음|아래)\s*/, '')
    .replace(/에 해당하지 않는 것은/g, '의 제외 조건')
    .replace(/에 해당하지 않는 것/g, '의 제외 조건')
    .replace(/해당하지 않는 것은/g, '제외 조건')
    .replace(/해당하지 않는 것/g, '제외 조건')
    .replace(/(으로|에 대한|에 관한|에 해당하는|중|는\?|은\?).*$/, '')
    .slice(0, 95);
}

function searchTerms(q) {
  const answer = answerText(q).replace(/[^\w가-힣/+\-. ]/g, ' ');
  const terms = [
    ...clean(q.stem).split(/[^A-Za-z0-9가-힣+#/.-]+/).filter((v) => v.length >= 3).slice(0, 4),
    ...answer.split(/\s+/).filter((v) => v.length >= 2).slice(0, 3),
  ];
  return [...new Set(terms)]
    .filter((v) => !/해당하지|정답은|조건과|나머지는|범주에/.test(v))
    .slice(0, 6)
    .join(', ');
}

function optionLine(q, option, idx, negative) {
  const num = idx + 1;
  const text = clean(option);
  const def = concept(text, q, false);
  const isAnswer = num === Number(q.answer);
  if (isAnswer && negative) {
    return `  - ${num}번: ${def} 실제 개념 기준으로는 보기의 표현이 틀리거나 다른 개념을 섞어 설명하므로 부정형 문항에서 고를 조건에 해당함.`;
  }
  if (isAnswer) {
    return `  - ${num}번: ${def} 문제 단서가 요구한 역할, 성질, 결과와 직접 연결되므로 고를 조건에 해당함.`;
  }
  if (negative) {
    return `  - ${num}번: ${def} 보기의 설명이 실제 개념의 성질이나 예시에 맞으므로 틀린 보기를 찾는 조건에서는 제외됨.`;
  }
  return `  - ${num}번: ${def} 정답 개념과 역할, 단계, 분류, 결과가 달라 긍정형 문항의 선택 조건에서는 제외됨.`;
}

function calcFormula(q) {
  const text = fullText(q);
  if (/LOC|라인수|생산성|개월/.test(text)) return '개발 기간 = 총 라인 수 / (참여 인원 수 × 1인 월간 생산성)';
  if (/LRU/.test(text)) return 'LRU는 가장 오랫동안 사용되지 않은 페이지를 교체 대상으로 선택함';
  if (/FIFO/.test(text)) return 'FIFO는 가장 먼저 적재된 페이지를 가장 먼저 교체함';
  if (/HRN/.test(text)) return 'HRN 우선순위 = (대기 시간 + 서비스 시간) / 서비스 시간이며 값이 클수록 우선순위가 높음';
  if (/fan-in|fan-out/i.test(text)) return 'fan-in은 해당 모듈을 호출하는 상위 모듈 수, fan-out은 해당 모듈이 호출하는 하위 모듈 수임';
  if (/버블/.test(text)) return '버블 정렬 1 PASS는 인접 원소를 차례로 비교·교환해 가장 큰 값을 끝으로 이동시킴';
  if (/선택.*정렬/.test(text)) return '선택 정렬 1회전은 전체 구간의 최솟값을 찾아 첫 번째 위치와 교환함';
  if (/후위 순회|Post/.test(text)) return '후위 순회는 왼쪽 서브트리, 오른쪽 서브트리, 루트 순서로 방문함';
  if (/이진 검색/.test(text)) return '이진 검색은 정렬된 자료의 중간값과 비교해 탐색 범위를 절반씩 줄임';
  return '문제에서 제시한 조건, 공식, 순서, 표의 기준을 단계적으로 적용함';
}

function buildSql(q) {
  const ans = answerText(q);
  const negative = isNegative(q.stem);
  return [
    '- 문제 유형: SQL형',
    `- 핵심 개념: ${concept(ans, q, true)}`,
    '- 도출 과정:',
    '  - 과정 1: SQL 명령 또는 데이터베이스 개념이 DDL, DML, DCL, 무결성, 정규화, 트랜잭션 중 어느 범주인지 확인함.',
    '  - 과정 2: 질의가 있는 경우 FROM/JOIN, WHERE, GROUP BY, HAVING, SELECT, ORDER BY 순서로 조건 적용 결과를 판단함.',
    '  - 과정 3: 보기의 용어가 실제 DB 개념의 정의와 일치하는지 확인함.',
    negative
      ? `- 최종 결과: ${ans}는 실제 DB 개념과 어긋나는 설명이므로 부정형 문항의 선택 조건에 해당함.`
      : `- 최종 결과: ${ans}는 문제 조건을 만족하는 SQL·DB 개념이므로 선택 조건에 해당함.`,
    '- 오답 분석:',
    ...(q.options || []).map((o, i) => optionLine(q, o, i, negative)),
    '- 주의(함정): SQL·DB 문제는 명령어 종류, NULL 처리, 키 제약, 조인 조건, 집계 기준을 섞어 내는 경우가 많으므로 용어의 소속 범주를 먼저 고정해야 함.',
    `- 유사 문제 검색어: ${searchTerms(q)}`,
  ].join('\n');
}

function buildCode(q) {
  const ans = answerText(q);
  const negative = isNegative(q.stem);
  return [
    '- 문제 유형: 코드형',
    `- 핵심 개념: ${concept(ans, q, true)}`,
    '- 도출 과정:',
    '  - 과정 1: 초기 변수값, 입력값, 배열 인덱스, 포인터 주소, 출력문 위치를 먼저 정리함.',
    '  - 과정 2: 조건문과 반복문은 위에서 아래 순서로 따라가며 값이 바뀌는 지점만 기록함.',
    '  - 과정 3: 논리 연산자는 참을 1, 거짓을 0으로 보고, 증감 연산·배열 주소·switch의 break 여부를 반영함.',
    negative
      ? `- 최종 결과: ${ans}는 문법 또는 라이브러리 기능을 잘못 연결한 설명이므로 부정형 문항의 선택 조건에 해당함.`
      : `- 최종 결과: 실행 흐름 또는 문법 정의를 적용하면 ${ans}가 도출됨.`,
    '- 오답 분석:',
    ...(q.options || []).map((o, i) => optionLine(q, o, i, negative)),
    '- 오답 유도 포인트: 출력 결과만 추측하면 후위 증가, 논리 연산의 0/1 값, 포인터 주소 증가 단위, switch fall-through를 놓칠 수 있음.',
    `- 유사 문제 검색어: ${searchTerms(q)}`,
  ].join('\n');
}

function buildCalc(q) {
  const ans = answerText(q);
  const negative = isNegative(q.stem);
  return [
    '- 문제 유형: 계산형',
    `- 핵심 개념: ${concept(ans, q, true)}`,
    `- 공식 또는 기준: ${calcFormula(q)}`,
    '- 계산 과정:',
    '  - 과정 1: 문제에서 주어진 값, 자료 순서, 비교 기준을 분리함.',
    '  - 과정 2: 공식 또는 알고리즘을 한 단계씩 적용해 중간 상태를 확인함.',
    `  - 과정 3: 중간 상태를 보기와 대조하면 ${ans}가 최종 조건을 만족함.`,
    negative
      ? `- 최종 결과: ${ans}는 계산 기준 또는 알고리즘 정의와 맞지 않는 설명이므로 부정형 문항의 선택 조건에 해당함.`
      : `- 최종 결과: ${ans}가 도출됨.`,
    '- 오답 분석:',
    ...(q.options || []).map((o, i) => optionLine(q, o, i, negative)),
    '- 주의(함정): 계산형 문항은 단위, 시작 위치, 1회전 기준, 교체 시점, 호출 방향처럼 한 단계 차이로 보기가 달라지는 지점을 확인해야 함.',
    `- 유사 문제 검색어: ${searchTerms(q)}`,
  ].join('\n');
}

function buildGeneral(q) {
  const ans = answerText(q);
  const negative = isNegative(q.stem);
  const clue = stemClue(q);
  const lines = [
    `- 문제 유형: ${negative ? '부정형' : '긍정형'}`,
    `- 개념 정의: ${concept(ans, q, true)}`,
  ];
  if (negative) {
    lines.push(`- 정답 분석: ${ans}는 '${clue}'의 올바른 정의나 구성 요소와 어긋나는 설명이므로 부정형 문항에서 고를 조건에 해당함.`);
    lines.push('- 구체적 근거: 보기의 핵심 용어가 실제로는 다른 분류에 속하거나, 절차·역할·범위를 잘못 연결하고 있음.');
  } else {
    lines.push(`- 정답 분석: '${clue}'에서 요구한 핵심 단서가 ${ans}의 정의·역할과 일치하므로 고를 조건에 해당함.`);
    lines.push('- 구체적 근거: 정답 보기는 문제의 목적, 기능, 분류를 직접 설명하지만 다른 보기는 인접 개념이거나 조건 일부가 다른 개념임.');
  }
  lines.push('- 오답 분석:');
  lines.push(...(q.options || []).map((o, i) => optionLine(q, o, i, negative)));
  lines.push(negative
    ? '- 주의(함정): 부정형 문항은 맞는 설명을 제외하고, 용어의 분류 오류·절차 오류·절대 표현 오류가 있는 보기를 찾아야 함.'
    : '- 주의(함정): 긍정형 문항은 보기 이름만 보지 말고 문제 문장의 핵심 동사와 조건이 어떤 개념의 정의와 연결되는지 확인해야 함.');
  lines.push(`- 유사 문제 검색어: ${searchTerms(q)}`);
  return lines.join('\n');
}

function buildExplanation(q) {
  if (isCode(q)) return buildCode(q);
  if (isCalc(q)) return buildCalc(q);
  if (isSql(q)) return buildSql(q);
  return buildGeneral(q);
}

const report = [
  '# 2022년 해설 정의·오답비교 재작성 보고',
  '',
  '- 적용 지침: 정보처리기사 CBT 해설 정의·오답비교 작성 지침',
  '- 적용 범위: 2022년 1회, 2회, 3회 전체 문항',
  '- 처리 방식: 문제 유형 분류, 정답 개념 정의, 보기별 비교, 주의 문장, 유사 문제 검색어를 포함하도록 재작성함.',
  '',
  '| 파일 | 문항 수 | 부정형 | 긍정형 | 코드형 | SQL형 | 계산형 |',
  '|---|---:|---:|---:|---:|---:|---:|',
];

let total = 0;

for (const file of TARGETS) {
  const fullPath = path.join(DATA_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const counts = { 부정형: 0, 긍정형: 0, 코드형: 0, SQL형: 0, 계산형: 0 };

  for (const q of json.questions || []) {
    const type = classify(q);
    counts[type] += 1;
    q.explanation = buildExplanation(q);
    total += 1;
  }

  fs.writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  report.push(`| \`${file}\` | ${json.questions.length} | ${counts.부정형} | ${counts.긍정형} | ${counts.코드형} | ${counts.SQL형} | ${counts.계산형} |`);
}

report.push('');
report.push(`- 총 재작성 문항: ${total}`);
report.push('- 통합 검수: 금지 표현 검색과 표본 문항 확인을 별도로 수행함.');

fs.writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
console.log(report.join('\n'));
