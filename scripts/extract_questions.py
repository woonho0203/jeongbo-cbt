"""
회차별 기출문제 PDF에서 문제·보기·과목을 추출합니다.
- 단어별 x좌표로 좌/우 컬럼 정확히 분리
- 좌측 전체 → 우측 전체 순서로 합침
- '제N과목' 라벨로 과목 분리
- 정규식으로 문제(번호.) + 보기(①②③④) 파싱
- 정답표(이미 추출된 JSON)와 매칭
"""
import re
import json
import os
import pdfplumber

DOWNLOADS = '/sessions/eager-busy-heisenberg/mnt/Downloads'
RAW_DIR = '/sessions/eager-busy-heisenberg/mnt/outputs/cbt-app/data/raw'
OUT_DIR = '/sessions/eager-busy-heisenberg/mnt/outputs/cbt-app/data'

EXAM_FILES = [
    ('1. 2024년1회_정보처리기사필기기출문제.pdf', '2024-1', '2024년 1회'),
    ('2. 2024년2회_정보처리기사필기기출문제.pdf', '2024-2', '2024년 2회'),
    ('3. 2024년3회_정보처리기사필기기출문제.pdf', '2024-3', '2024년 3회'),
    ('2025년1회_정보처리기사필기기출문제.pdf', '2025-1', '2025년 1회'),
    ('2025년2회_정보처리기사필기기출문제.pdf', '2025-2', '2025년 2회'),
    ('2025년3회_정보처리기사 필기_기출문제.pdf', '2025-3', '2025년 3회'),
]

SUBJECTS = {
    1: '소프트웨어 설계',
    2: '소프트웨어 개발',
    3: '데이터베이스 구축',
    4: '프로그래밍 언어 활용',
    5: '정보시스템 구축 관리',
}


def words_to_lines(words, y_tolerance=3):
    """단어 리스트를 같은 y라인끼리 묶어 라인 텍스트로 변환."""
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (w['top'], w['x0']))
    lines = []
    cur_top = sorted_words[0]['top']
    cur_line = []
    for w in sorted_words:
        if abs(w['top'] - cur_top) <= y_tolerance:
            cur_line.append(w)
        else:
            cur_line.sort(key=lambda x: x['x0'])
            lines.append(' '.join(x['text'] for x in cur_line))
            cur_line = [w]
            cur_top = w['top']
    if cur_line:
        cur_line.sort(key=lambda x: x['x0'])
        lines.append(' '.join(x['text'] for x in cur_line))
    return lines


def extract_two_column_text(pdf_path):
    """단어 좌표로 좌/우 컬럼 분리 후 좌측 전체 → 우측 전체 순서로 합침."""
    out_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for pi, page in enumerate(pdf.pages):
            words = page.extract_words(use_text_flow=False)
            if not words:
                continue

            # 정답 페이지 스킵 (① 갯수 50개 이상 + 짧은 텍스트)
            txt = page.extract_text() or ''
            circle_count = sum(txt.count(c) for c in '①②③④')
            if circle_count > 60 and '정답' in txt:
                continue

            mid = page.width / 2
            left_words = [w for w in words if (w['x0'] + w['x1']) / 2 < mid]
            right_words = [w for w in words if (w['x0'] + w['x1']) / 2 >= mid]

            out_lines.extend(words_to_lines(left_words))
            out_lines.extend(words_to_lines(right_words))
    return out_lines


def clean_lines(lines):
    skip_keywords = [
        '저작권', '시나공', '카페', '회원을 대상', '복제하거나', '상업적', '매체에 옮겨',
        '※ 다음 문제를 읽고', '답란', '기출문제', '필기 기출', '정정답답',
        '안내', '용도로만', '기출문제 & 정답',
    ]
    cleaned = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if any(k in s for k in skip_keywords):
            continue
        if re.fullmatch(r'-?\s*\d+\s*-?', s):
            continue
        if re.fullmatch(r'\d+회', s):
            continue
        if re.fullmatch(r'\d{4}\s*년\s*\d+회.*', s):
            continue
        if re.fullmatch(r'\d+\s*-', s):  # "1 -"
            continue
        cleaned.append(s)
    return cleaned


def parse_questions(lines):
    subj_re = re.compile(r'^제\s*([1-5])\s*과목\s*(.+)$')
    qstart_re = re.compile(r'^(\d{1,3})\.\s*(.*)$')
    opt_pattern = re.compile(r'([①②③④])\s*([^①②③④]*)')

    questions = []
    cur_subject = None
    cur_q = None
    cur_target = None  # 'stem' or 1-4

    def push_current():
        nonlocal cur_q
        if cur_q is not None:
            questions.append(cur_q)
        cur_q = None

    for ln in lines:
        m = subj_re.match(ln)
        if m:
            push_current()
            cur_subject = int(m.group(1))
            continue

        # 한 줄에 보기 ①②③④가 여러 개 들어있을 수도 있음
        # 보기 시작 라인이면 기존 stem/option 마무리
        if cur_q is not None and re.match(r'^[①②③④]', ln):
            # 라인 내 모든 ①②③④ 항목 분해
            parts = list(opt_pattern.finditer(ln))
            if parts:
                for p in parts:
                    idx = '①②③④'.index(p.group(1)) + 1
                    cur_q['options'][idx - 1] = p.group(2).strip()
                # 마지막 인덱스를 cur_target으로 (이어쓰기 위해)
                cur_target = '①②③④'.index(parts[-1].group(1)) + 1
                continue

        # 문제 시작?
        m = qstart_re.match(ln)
        if m:
            qnum = int(m.group(1))
            if 1 <= qnum <= 100:
                push_current()
                cur_q = {
                    'qnum': qnum,
                    'subject': cur_subject,
                    'stem': m.group(2).strip(),
                    'options': ['', '', '', ''],
                }
                cur_target = 'stem'
                continue

        if cur_q is None:
            continue

        # 이어쓰기 (라인 내에 ① 등이 있으면 옵션 갱신)
        if '①' in ln or '②' in ln or '③' in ln or '④' in ln:
            parts = list(opt_pattern.finditer(ln))
            # 라인 앞 부분(첫 옵션 전)은 stem에 이어쓰기
            first_idx = parts[0].start() if parts else len(ln)
            prefix = ln[:first_idx].strip()
            if prefix:
                if cur_target == 'stem':
                    cur_q['stem'] += ' ' + prefix
                elif isinstance(cur_target, int):
                    cur_q['options'][cur_target - 1] += ' ' + prefix
            for p in parts:
                idx = '①②③④'.index(p.group(1)) + 1
                # 이미 채워져있고 추가 텍스트면 이어쓰기
                if cur_q['options'][idx - 1]:
                    cur_q['options'][idx - 1] += ' ' + p.group(2).strip()
                else:
                    cur_q['options'][idx - 1] = p.group(2).strip()
                cur_target = idx
            continue

        if cur_target == 'stem':
            cur_q['stem'] += ' ' + ln
        elif isinstance(cur_target, int):
            cur_q['options'][cur_target - 1] += ' ' + ln

    push_current()

    # 정리: 공백 정규화, 중복 제거 (같은 qnum 여러개일 경우 첫 번째만)
    seen = set()
    deduped = []
    for q in questions:
        if q['qnum'] in seen:
            continue
        if not q['stem']:
            continue
        # 보기 4개 중 빈 게 있으면 일단 유지 (수동 보정 가능)
        q['stem'] = re.sub(r'\s+', ' ', q['stem']).strip()
        q['options'] = [re.sub(r'\s+', ' ', o).strip() for o in q['options']]
        seen.add(q['qnum'])
        deduped.append(q)
    return deduped


def assign_subject_by_qnum(qnum):
    if qnum <= 20:
        return 1
    if qnum <= 40:
        return 2
    if qnum <= 60:
        return 3
    if qnum <= 80:
        return 4
    return 5


def process_exam(fname, label, title):
    path = os.path.join(DOWNLOADS, fname)
    if not os.path.exists(path):
        print(f'[!] 파일 없음: {fname}')
        return None
    raw_lines = extract_two_column_text(path)
    lines = clean_lines(raw_lines)
    questions = parse_questions(lines)

    for q in questions:
        if q['subject'] is None:
            q['subject'] = assign_subject_by_qnum(q['qnum'])
        q['subjectName'] = SUBJECTS[q['subject']]

    # 정답 매칭
    ans_path = os.path.join(RAW_DIR, f'answers_{label}.json')
    if os.path.exists(ans_path):
        with open(ans_path, encoding='utf-8') as f:
            answers = json.load(f)
        for q in questions:
            key = str(q['qnum'])
            q['answer'] = answers.get(key)

    return {
        'examId': label,
        'title': title,
        'questions': sorted(questions, key=lambda x: x['qnum']),
    }


def main():
    all_exams = []
    for fname, label, title in EXAM_FILES:
        result = process_exam(fname, label, title)
        if not result:
            continue
        out_path = os.path.join(OUT_DIR, f'exam_{label}.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        ok = sum(1 for q in result['questions'] if q.get('answer'))
        complete = sum(1 for q in result['questions'] if q.get('answer') and all(q['options']))
        print(f'[OK] {title}: 추출 {len(result["questions"])} | 정답매칭 {ok} | 완전한문제 {complete}')
        all_exams.append({'examId': label, 'title': title, 'count': len(result['questions'])})

    with open(os.path.join(OUT_DIR, 'exams_index.json'), 'w', encoding='utf-8') as f:
        json.dump(all_exams, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
