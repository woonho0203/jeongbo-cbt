#!/usr/bin/env python3
"""
PDF-JSON 띄어쓰기 비교 및 수정 스크립트 v3
PDF 원본 라인의 줄바꿈을 한국어 문법에 맞게 처리하여
올바른 띄어쓰기를 JSON에 적용합니다.
"""

import re
import json
import copy
import pdfplumber
from pathlib import Path

# PDF 파일 경로 매핑
PDF_MAP = {
    '2024-1': '/Users/woonho/Downloads/1. 2024년1회_정보처리기사필기기출문제.pdf',
    '2024-2': '/Users/woonho/Downloads/2. 2024년2회_정보처리기사필기기출문제.pdf',
    '2024-3': '/Users/woonho/Downloads/3. 2024년3회_정보처리기사필기기출문제.pdf',
    '2025-1': '/Users/woonho/Downloads/2025년1회_정보처리기사필기기출문제.pdf',
    '2025-2': '/Users/woonho/Downloads/2025년2회_정보처리기사필기기출문제.pdf',
    '2025-3': '/Users/woonho/Downloads/2025년3회_정보처리기사 필기_기출문제.pdf',
}

DATA_DIR = Path('/Users/woonho/Downloads/정보처리기사_CBT/data')

# 보기 번호 패턴
OPTION_MARKERS = ['①', '②', '③', '④']
OPTION_PATTERN = re.compile(r'[①②③④]')


# ─── 한국어 줄 연결 로직 ───────────────────────────────────────────

def ko_syllable_info(char):
    """한국어 음절 분해 (초성, 중성, 종성 인덱스)"""
    if '가' <= char <= '힣':
        code = ord(char) - ord('가')
        jong = code % 28
        cho = (code // 28) // 21
        jung = (code // 28) % 21
        return cho, jung, jong
    return None, None, None


# 단어 중간에 나오는 글자들 (종성 없음인데 어절 미완성)
# 이것들로 끝나는 줄은 다음 줄과 공백 없이 연결
WORD_MIDDLE_CHARS = {
    '하', '로', '고', '지', '기', '리', '려', '시',   # 어간들
    '스', '트', '프', '레', '테', '데', '세', '제',   # 외래어 중간
    '케', '페', '네', '베', '메', '조', '소', '호',
    '화', '성', '적', '식', '형', '력', '률', '율',   # 한자어 파생
    '도', '포', '구', '두', '수', '무', '부', '주',   # 체언 중간
    '모', '노', '코', '보', '초', '오', '우', '아',
    '제', '미', '비', '위', '피', '히', '치', '기',
    '래', '배', '대', '해', '거', '너', '버', '어',
    '새', '마', '나', '차', '자', '파', '바', '사',
}

# 명확한 어절 끝 조사/어미들 (종성 없음인데 어절 완성)
DEFINITE_ENDINGS = {
    '가', '나', '를', '는', '이', '에', '와', '과',
    '야', '여', '며', '면', '라', '마',
    '까', '터', '처',
}


def next_line_is_continuation(prev_line, next_line):
    """
    다음 줄이 이전 줄의 단어/어절 계속인지 판단
    True이면 공백 없이 이어붙임
    False이면 공백으로 이어붙임
    """
    if not prev_line or not next_line:
        return False

    last = prev_line[-1]
    first_word = next_line.split()[0] if next_line.split() else next_line[:5]
    first = next_line[0]

    # 이전 줄이 문장부호로 끝나면 무조건 공백
    if last in r'.!?,;:)"\'。，？':
        return False

    # ── 이전 줄 끝 분석 ──
    if '가' <= last <= '힣':
        _, _, last_jong = ko_syllable_info(last)

        if last_jong == 0:
            # 종성 없음
            if first.isascii() and first.isalpha():
                # 영어로 넘어가면 → 공백 없음 (외래어 중간일 가능성) or 공백
                # 이전 글자가 한국어 단어 중간이면 공백 없음
                if last in WORD_MIDDLE_CHARS:
                    return True  # 공백 없이
                return False

            if '가' <= first <= '힣':
                # 이전 글자가 단어 중간에 오는 글자면 공백 없음
                if last in WORD_MIDDLE_CHARS:
                    return True

                # 이전 글자가 명확한 어절 끝이면 공백
                if last in DEFINITE_ENDINGS:
                    return False

                # 애매한 경우: 다음 줄이 조사/어미면 공백 없이
                if _next_is_particle_or_suffix(next_line):
                    return True

                # 기본: 공백
                return False

        else:
            # 종성 있음 → 어절 끝일 가능성 높음
            # 단, 다음 줄이 조사/어미로 시작하면 공백 없이
            if _next_is_particle_or_suffix(next_line):
                return True
            # 그 외 공백
            return False

    # 영어 처리
    if last.isalpha() and last.isascii():
        if first.isalpha() and first.isascii():
            # 소문자로 시작하면 단어 중간
            if first.islower():
                return True
        return False

    # 숫자
    if last.isdigit():
        return False

    return False


def _next_is_particle_or_suffix(next_line):
    """
    다음 줄이 조사, 어미, 접미사로 시작하여
    앞 단어와 공백 없이 붙어야 하는 경우인지 판단
    """
    if not next_line:
        return False

    first_word = next_line.split()[0] if next_line.split() else next_line

    # 명확한 한국어 조사로 시작하는 1-3음절 단어
    particle_starts = set('이가을를은는의에로도와과부까보처')
    if first_word and first_word[0] in particle_starts:
        if len(first_word) <= 4:
            return True

    # '하-' 활용형 (앞 명사에 붙는 경우)
    ha_forms = ['할', '한', '하는', '하고', '하여', '하며', '하면',
                '하기', '하지', '하여야', '하므로', '해야', '해서',
                '해도', '해주', '해왔']
    for form in ha_forms:
        if first_word.startswith(form):
            return True

    # '할 수 있다', '할 수 없다', '할 때' 등 패턴
    pattern_starts = ['할 수', '한 후', '할 때', '하는 것', '하는 데',
                      '하는 경우', '할 수도', '한다', '합니다']
    for pat in pattern_starts:
        if next_line.startswith(pat):
            return True

    # 어미/접미사 단독 (1-2음절)
    suffix_1_2 = set(['록', '며', '면', '서', '지', '고', '도', '만',
                      '기', '들', '화', '적', '성', '식', '형'])
    if first_word in suffix_1_2:
        return True

    # '다.' 또는 '다' 단독 (종결어미 - 앞 어간에 붙음)
    # '한다.', '된다.', '있다.', '없다.' 등
    if next_line.strip() in ['다.', '다', '다!"', '다!"']:
        return True
    if next_line.startswith('다.') and len(next_line) <= 5:
        return True
    # '다' + 문장부호로 끝나는 짧은 경우
    if re.match(r'^다[.!?"\']?\s*$', next_line):
        return True

    # '된', '된다', '됩니다' 등 '되-' 활용형
    doe_forms = ['된', '되는', '되어', '되고', '되며', '되면', '되지',
                 '됩니다', '됩니다.', '된다', '된다.']
    for form in doe_forms:
        if first_word.startswith(form):
            return True

    # '으로', '에서', '에게', '로서' 등
    ko_postpos = ['으로', '에서', '에게', '에게서', '로서', '로부터',
                  '이며', '이고', '이나', '이라', '이어서', '이므로',
                  '이다', '이라고', '이라는', '이란']
    for pp in ko_postpos:
        if next_line.startswith(pp):
            return True

    return False


def join_lines_korean(prev_line, next_line):
    """두 PDF 줄을 한국어 문법에 맞게 연결"""
    if not prev_line:
        return next_line
    if not next_line:
        return prev_line
    if next_line_is_continuation(prev_line, next_line):
        return prev_line + next_line
    return prev_line + ' ' + next_line


# ─── PDF 파싱 ────────────────────────────────────────────────────────

def extract_pdf_lines(pdf_path):
    """PDF에서 2컬럼 분리하여 원본 라인 목록 추출"""
    all_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            width = page.width
            left = page.crop((0, 0, width / 2, page.height))
            right = page.crop((width / 2, 0, width, page.height))
            for col in [left, right]:
                text = col.extract_text() or ''
                lines = text.split('\n')
                all_lines.extend(lines)
    return all_lines


def parse_questions(lines):
    """
    PDF 라인 목록에서 문제 파싱
    줄바꿈 연결 시 한국어 문법 고려
    """
    questions = {}

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        m = re.match(r'^(\d+)\.\s*(.*)', line)
        if m:
            qnum = int(m.group(1))
            if 1 <= qnum <= 100:
                stem_first = m.group(2).strip()
                stem_collected = [stem_first] if stem_first else []
                i += 1

                # stem 수집
                while i < len(lines):
                    nl = lines[i].strip()

                    # 다음 문제 번호
                    nq = re.match(r'^(\d+)\.\s*', nl)
                    if nq and 1 <= int(nq.group(1)) <= 100:
                        break

                    # 보기 기호
                    if OPTION_PATTERN.match(nl):
                        break

                    if not nl:
                        i += 1
                        continue

                    # 정답 줄 (예: '1.② 2.① ...')
                    if re.match(r'^\d+\.[①②③④]', nl):
                        break

                    stem_collected.append(nl)
                    i += 1

                # 보기 수집
                # options_data: list of [marker_idx, [text_lines]]
                options_data = []
                while i < len(lines):
                    nl = lines[i].strip()

                    if not nl:
                        i += 1
                        continue

                    # 다음 문제
                    nq = re.match(r'^(\d+)\.\s*', nl)
                    if nq and 1 <= int(nq.group(1)) <= 100:
                        break

                    # 정답 줄
                    if re.match(r'^\d+\.[①②③④]', nl):
                        break

                    if OPTION_PATTERN.search(nl):
                        split_opts = split_options_line(nl)
                        for marker_i, text in split_opts:
                            options_data.append([marker_i, [text]])
                        i += 1
                    else:
                        # 이전 보기의 계속
                        if options_data:
                            options_data[-1][1].append(nl)
                        i += 1

                # stem 합치기
                stem = join_stem(stem_collected)

                # options 합치기
                options = ['', '', '', '']
                for marker_i, text_lines in options_data:
                    if 0 <= marker_i < 4:
                        options[marker_i] = join_option_lines(text_lines)

                # marker_i가 없는 경우 순서대로
                if not all(options):
                    ordered = [join_option_lines(td[1]) for td in options_data[:4]]
                    if len(ordered) == 4:
                        options = ordered

                if stem and any(options):
                    questions[qnum] = {'stem': stem, 'options': options}

                continue

        i += 1

    return questions


def split_options_line(line):
    """한 줄에 여러 보기 분리, (marker_idx, text) 반환"""
    marker_map = {'①': 0, '②': 1, '③': 2, '④': 3}
    parts = re.split(r'([①②③④])', line)
    options = []
    current_marker = None
    current_text = ''
    for part in parts:
        if part in marker_map:
            if current_marker is not None:
                options.append((marker_map[current_marker], current_text.strip()))
            current_marker = part
            current_text = ''
        elif current_marker is not None:
            current_text += part
    if current_marker is not None:
        options.append((marker_map[current_marker], current_text.strip()))
    return options


def join_stem(lines):
    """stem 라인들을 한국어 문법에 맞게 합치기"""
    lines = [l.strip() for l in lines if l.strip()]
    if not lines:
        return ''
    result = lines[0]
    for line in lines[1:]:
        result = join_lines_korean(result, line)
    return result


def join_option_lines(lines):
    """보기 라인들을 합치기"""
    lines = [l.strip() for l in lines if l.strip()]
    if not lines:
        return ''
    result = lines[0]
    for line in lines[1:]:
        result = join_lines_korean(result, line)
    return result


# ─── JSON 처리 ──────────────────────────────────────────────────────

def flatten_json_text(text):
    """JSON 텍스트를 공백 없는 순수 텍스트로 평탄화 (비교용)"""
    text = re.sub(r'\[보기\]\n?', '', text)
    lines = text.split('\n')
    parts = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('ㆍ'):
            line = line[1:].strip()
        parts.append(line)
    return ''.join(re.sub(r'\s', '', p) for p in parts)


def flatten_json_text_readable(text):
    """JSON 텍스트를 읽기 가능한 형태로 평탄화"""
    text = re.sub(r'\[보기\]\n?', '', text)
    lines = text.split('\n')
    parts = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('ㆍ'):
            line = line[1:].strip()
        parts.append(line)
    return ' '.join(parts)


def apply_pdf_spacing_to_json_stem(pdf_stem, json_stem_raw):
    """
    PDF stem의 올바른 띄어쓰기를 JSON stem에 적용
    JSON의 구조화 형식([보기], ㆍ 등)은 유지
    """
    # 공백 없는 버전으로 내용 같은지 확인
    pdf_ns = re.sub(r'\s', '', pdf_stem)
    json_flat_ns = flatten_json_text(json_stem_raw)

    if pdf_ns != json_flat_ns:
        return json_stem_raw  # 내용이 다름 (이미지/표 등)

    # 단순 텍스트 (줄바꿈 없음)
    if '\n' not in json_stem_raw:
        new_stem = re.sub(r' +', ' ', pdf_stem).strip()
        return new_stem

    # 구조화된 텍스트 → 각 세그먼트 매핑
    return apply_pdf_spacing_to_structured(pdf_stem, json_stem_raw)


def apply_pdf_spacing_to_structured(pdf_text, json_text_raw):
    """
    구조화된 JSON 텍스트의 각 세그먼트에 PDF 띄어쓰기 적용
    """
    lines = json_text_raw.split('\n')
    result_lines = []

    # PDF 텍스트를 비공백 문자 인덱싱
    pdf_ns_chars = re.sub(r'\s', '', pdf_text)
    pos = 0  # pdf_ns_chars 내 현재 위치

    for line in lines:
        stripped = line.strip()

        if not stripped or stripped == '[보기]':
            result_lines.append(line)
            continue

        prefix = ''
        content = stripped
        if stripped.startswith('ㆍ'):
            prefix = 'ㆍ'
            content = stripped[1:].strip()

        content_ns = re.sub(r'\s', '', content)

        if not content_ns:
            result_lines.append(line)
            continue

        idx = pdf_ns_chars.find(content_ns, pos)
        if idx < 0:
            result_lines.append(line)
            continue

        # PDF 텍스트에서 해당 구간 추출 (공백 포함)
        segment = extract_segment(pdf_text, idx, len(content_ns))
        pos = idx + len(content_ns)

        if segment is not None:
            result_lines.append(prefix + segment)
        else:
            result_lines.append(line)

    return '\n'.join(result_lines)


def extract_segment(text, ns_start, ns_len):
    """비공백 인덱스 기준으로 공백 포함 구간 추출"""
    ns_count = 0
    in_seg = False
    chars = []
    collected_ns = 0

    for ch in text:
        if ch != ' ':
            if ns_count == ns_start and not in_seg:
                in_seg = True
            ns_count += 1

        if in_seg:
            chars.append(ch)
            if ch != ' ':
                collected_ns += 1
            if collected_ns >= ns_len:
                break

    if not in_seg or collected_ns < ns_len:
        return None

    return ''.join(chars).strip()


# ─── 메인 처리 ──────────────────────────────────────────────────────

def process_exam(exam_id, verbose=True):
    """한 시험 파일 처리"""
    pdf_path = PDF_MAP[exam_id]
    json_path = DATA_DIR / f'exam_{exam_id}.json'

    if verbose:
        print(f'\n{"="*60}')
        print(f'처리 중: exam_{exam_id}')

    # PDF 파싱
    pdf_lines = extract_pdf_lines(pdf_path)
    pdf_questions = parse_questions(pdf_lines)

    if verbose:
        print(f'  PDF에서 {len(pdf_questions)}개 문제 파싱')

    # JSON 로드
    with open(json_path, encoding='utf-8') as f:
        json_data = json.load(f)

    total_changes = []

    for i, json_q in enumerate(json_data['questions']):
        qnum = i + 1

        if qnum not in pdf_questions:
            continue

        pdf_q = pdf_questions[qnum]
        pdf_stem = pdf_q['stem']
        pdf_options = pdf_q['options']

        json_stem_raw = json_q.get('stem', '')
        json_options = json_q.get('options', [])

        changes = []
        new_q = copy.deepcopy(json_q)

        # ── stem 비교 ──
        pdf_ns = re.sub(r'\s', '', pdf_stem)
        json_flat_ns = flatten_json_text(json_stem_raw)

        if pdf_ns == json_flat_ns:
            json_stem_flat_readable = flatten_json_text_readable(json_stem_raw)
            json_stem_flat_ns_spaced = re.sub(r'\s+', ' ', json_stem_flat_readable).strip()
            pdf_stem_spaced = re.sub(r'\s+', ' ', pdf_stem).strip()

            if pdf_stem_spaced != json_stem_flat_ns_spaced:
                new_stem = apply_pdf_spacing_to_json_stem(pdf_stem, json_stem_raw)
                if new_stem != json_stem_raw:
                    old_r = re.sub(r'\s+', ' ', flatten_json_text_readable(json_stem_raw)).strip()
                    new_r = re.sub(r'\s+', ' ', flatten_json_text_readable(new_stem)).strip()
                    if old_r != new_r:
                        changes.append(f'stem: "{old_r[:65]}" → "{new_r[:65]}"')
                        new_q['stem'] = new_stem

        # ── options 비교 ──
        if len(pdf_options) == 4 and len(json_options) == 4:
            new_options = list(json_options)
            for j, (pdf_opt, json_opt) in enumerate(zip(pdf_options, json_options)):
                pdf_opt_ns = re.sub(r'\s', '', pdf_opt)
                json_opt_ns = re.sub(r'\s', '', json_opt)

                if pdf_opt_ns == json_opt_ns:
                    pdf_opt_s = re.sub(r'\s+', ' ', pdf_opt).strip()
                    json_opt_s = re.sub(r'\s+', ' ', json_opt).strip()
                    if pdf_opt_s != json_opt_s:
                        changes.append(f'opt{j+1}: "{json_opt_s[:65]}" → "{pdf_opt_s[:65]}"')
                        new_options[j] = pdf_opt_s

            new_q['options'] = new_options

        if changes:
            total_changes.append((qnum, changes))
            json_data['questions'][i] = new_q

    # 저장
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    if verbose:
        print(f'  수정된 문제: {len(total_changes)}개')
        for qnum, changes in total_changes[:15]:
            print(f'  Q{qnum}:')
            for ch in changes[:3]:
                print(f'    {ch[:120]}')
        if len(total_changes) > 15:
            print(f'  ... 외 {len(total_changes) - 15}개 더')

    return len(total_changes), total_changes


def main():
    print('PDF-JSON 띄어쓰기 수정 시작 (v3)')

    total_all = 0
    for exam_id in ['2024-1', '2024-2', '2024-3', '2025-1', '2025-2', '2025-3']:
        count, _ = process_exam(exam_id)
        total_all += count

    print(f'\n총 수정: {total_all}개 문제')


if __name__ == '__main__':
    main()
