"""
유형별 자료 PDF에서 문제/보기/해설/정답을 추출.
- 단일 컬럼 형식
- "[해설]" 키워드로 해설 분리
- 해설 첫 부분에서 ①②③④ 또는 "정답은 N" 패턴으로 정답 추정
"""
import re
import json
import os
import pdfplumber

DOWNLOADS = '/sessions/eager-busy-heisenberg/mnt/Downloads'
OUT_DIR = '/sessions/eager-busy-heisenberg/mnt/outputs/cbt-app/data'

CATEGORY_FILES = [
    ('정보처리기사필기_01_필수계산41문제.pdf', 'calc', '필수 계산 41문제'),
    ('정보처리기사필기_02_필수코드57문제.pdf', 'code', '필수 코드 57문제'),
    ('정보처리기사필기_03_잘못된문장찾기197문제.pdf', 'wrong-sentence', '잘못된 문장 찾기 197문제'),
    ('정보처리기사필기_04_키워드찾기259문제.pdf', 'keyword', '키워드 찾기 259문제'),
    ('정보처리기사필기_05_종류순서114문제.pdf', 'sequence', '종류·순서 114문제'),
]

CIRCLE_TO_NUM = {'①': 1, '②': 2, '③': 3, '④': 4}


def extract_text(pdf_path):
    out = ''
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            t = p.extract_text() or ''
            out += '\n' + t
    return out


def split_questions(text):
    """문제 시작 패턴 '\n숫자. ' 으로 분할."""
    # 라인 시작에 "1. ", "2. " 식으로
    parts = re.split(r'(?m)^\s*(\d{1,3})\.\s+', text)
    # parts[0]은 첫 문제 이전 텍스트, 이후 [번호, 본문, 번호, 본문, ...]
    questions = []
    for i in range(1, len(parts), 2):
        qnum = int(parts[i])
        body = parts[i + 1] if i + 1 < len(parts) else ''
        questions.append((qnum, body))
    return questions


def parse_one_question(qnum, body):
    """문제 한 덩어리에서 stem/options/explanation 분리."""
    # [해설] 분리
    m = re.search(r'\[\s*해설\s*\]', body)
    if m:
        front = body[:m.start()]
        explanation = body[m.end():].strip()
    else:
        front = body
        explanation = ''

    # 다음 문제로 이어지지 않도록, explanation에서 다음 줄에 나오는 "N. " 잘라내기
    next_q = re.search(r'(?m)^\s*\d{1,3}\.\s+', explanation)
    if next_q:
        explanation = explanation[:next_q.start()].strip()

    # front에서 보기 ①②③④ 추출
    # "보기 시작" 위치 찾기
    opt_positions = []
    for c in '①②③④':
        for m in re.finditer(re.escape(c), front):
            opt_positions.append((m.start(), c))
    opt_positions.sort()

    if len(opt_positions) < 4:
        # 보기가 4개 미만이면 파싱 실패
        return None

    # 첫 ① 이전 = stem
    stem = front[:opt_positions[0][0]].strip()
    options = ['', '', '', '']
    for i, (pos, c) in enumerate(opt_positions):
        end = opt_positions[i + 1][0] if i + 1 < len(opt_positions) else len(front)
        options[CIRCLE_TO_NUM[c] - 1] = front[pos + 1:end].strip()
        # 첫 4개만
        if i == 3:
            break

    # 같은 번호의 보기가 중복되어 나타날 수 있으니, 첫 ① ② ③ ④만 사용
    return {
        'qnum': qnum,
        'stem': re.sub(r'\s+', ' ', stem).strip(),
        'options': [re.sub(r'\s+', ' ', o).strip() for o in options],
        'explanation': re.sub(r'\s+', ' ', explanation).strip(),
        'answer': guess_answer(stem, explanation),
    }


def guess_answer(stem, explanation):
    """해설에서 정답을 추정."""
    if not explanation:
        return None
    # "정답은 ②", "정답: 2", "②번이 정답" 등 명시적 패턴
    patterns = [
        r'정답[은이가:\s]*([①②③④])',
        r'정답[은이가:\s]*([1-4])\s*번',
        r'([①②③④])\s*번?이?\s*정답',
        r'답[은이:\s]*([①②③④])',
    ]
    for pat in patterns:
        m = re.search(pat, explanation)
        if m:
            ans = m.group(1)
            if ans in CIRCLE_TO_NUM:
                return CIRCLE_TO_NUM[ans]
            return int(ans)

    # 해설 첫 부분에서 등장하는 첫 ①②③④ (50자 이내)
    first50 = explanation[:80]
    m = re.search(r'([①②③④])', first50)
    if m:
        # 다만 "①번을 ..." 같은 부정문 표현 체크 안 함, 그냥 후보로
        return CIRCLE_TO_NUM[m.group(1)]

    return None


def process_category(fname, cat_id, title):
    path = os.path.join(DOWNLOADS, fname)
    if not os.path.exists(path):
        return None
    text = extract_text(path)
    raw_qs = split_questions(text)

    questions = []
    for qnum, body in raw_qs:
        parsed = parse_one_question(qnum, body)
        if parsed and all(parsed['options']):
            questions.append(parsed)

    return {
        'categoryId': cat_id,
        'title': title,
        'questions': questions,
    }


def main():
    index = []
    for fname, cat_id, title in CATEGORY_FILES:
        result = process_category(fname, cat_id, title)
        if not result:
            continue
        out_path = os.path.join(OUT_DIR, f'category_{cat_id}.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        with_ans = sum(1 for q in result['questions'] if q['answer'])
        print(f'[OK] {title}: {len(result["questions"])}문제 (정답추정 {with_ans})')
        index.append({'categoryId': cat_id, 'title': title, 'count': len(result['questions'])})

    with open(os.path.join(OUT_DIR, 'categories_index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
