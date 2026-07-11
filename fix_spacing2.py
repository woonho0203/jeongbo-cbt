#!/usr/bin/env python3
"""
PDF-JSON 띄어쓰기 비교 및 수정 스크립트 v2
PDF 라인 단위로 파싱하여 줄바꿈 아티팩트를 제거하고,
실제 줄 내부 띄어쓰기 기준으로 JSON을 수정합니다.
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


def join_wrapped_lines(lines):
    """
    줄바꿈으로 잘린 라인을 합치되, 줄 경계에서는 공백 없이 합침
    (PDF에서 단어가 줄 끝에서 잘린 경우 공백 제거)

    규칙:
    - 줄이 특정 패턴(문제번호, 보기번호, 정답줄 등)으로 시작하면 새 문단 시작
    - 그 외에는 이전 줄에 이어붙임 (공백 없이)

    실제로는 "줄 끝이 잘린 경우"를 감지하기 어려우므로,
    PDF 원본 라인을 유지하고 각 라인 내부 공백만 신뢰하는 방식 사용
    """
    pass


def parse_questions_preserve_lines(lines):
    """
    PDF 원본 라인 목록에서 문제 파싱
    핵심: 줄바꿈으로 연결할 때는 공백 없이 이어붙임 (PDF 줄바꿈 아티팩트 제거)
    단, 줄 내부의 공백은 그대로 유지
    """
    questions = {}

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 문제 번호 패턴
        m = re.match(r'^(\d+)\.\s*(.*)', line)
        if m:
            qnum = int(m.group(1))
            if 1 <= qnum <= 100:
                stem_first = m.group(2).strip()
                stem_lines = [stem_first] if stem_first else []
                i += 1

                # stem 수집: 보기 기호 또는 다음 문제가 나올 때까지
                while i < len(lines):
                    next_line = lines[i].strip()

                    # 다음 문제 번호
                    next_q = re.match(r'^(\d+)\.\s*', next_line)
                    if next_q and 1 <= int(next_q.group(1)) <= 100:
                        break

                    # 보기 기호로 시작
                    if OPTION_PATTERN.match(next_line):
                        break

                    # 빈 줄 건너뜀
                    if not next_line:
                        i += 1
                        continue

                    # 정답 줄 등 건너뜀
                    if re.match(r'^\d+\.[①-④①②③④]', next_line):
                        break

                    stem_lines.append(next_line)
                    i += 1

                # 보기 수집
                options_lines = []  # (marker_idx, text_so_far)
                while i < len(lines):
                    next_line = lines[i].strip()

                    if not next_line:
                        i += 1
                        continue

                    # 다음 문제 번호
                    next_q = re.match(r'^(\d+)\.\s*', next_line)
                    if next_q and 1 <= int(next_q.group(1)) <= 100:
                        break

                    # 정답 줄
                    if re.match(r'^\d+\.[①-④①②③④①②③④]', next_line):
                        break

                    # 보기가 있는 라인
                    if OPTION_PATTERN.search(next_line):
                        split_opts = split_options_line_with_continuation(next_line)
                        for marker_i, text in split_opts:
                            options_lines.append([marker_i, text])
                        i += 1
                    else:
                        # 보기 없이 이전 보기 계속
                        if options_lines:
                            # 줄바꿈으로 잘린 경우: 공백 없이 이어붙임
                            options_lines[-1][1] = options_lines[-1][1] + next_line
                        i += 1

                    if len(options_lines) >= 4 and all(
                        len(options_lines) > j and not ends_with_incomplete(options_lines[j][1])
                        for j in range(4)
                    ):
                        # 4개 보기가 완성된 것 같으면 중단
                        pass

                # stem 합치기: 줄바꿈으로 잘린 경우 공백 없이 이어붙임
                stem = join_stem_lines(stem_lines)

                # options 추출
                options = ['', '', '', '']
                for marker_i, text in options_lines[:4]:
                    if 0 <= marker_i < 4:
                        options[marker_i] = text.strip()

                # 실제로 순서대로 들어왔을 때
                if all(opt for opt in options):
                    questions[qnum] = {'stem': stem, 'options': options}
                else:
                    # marker_i가 제대로 안 들어온 경우 순서대로
                    ordered = [text.strip() for _, text in options_lines[:4]]
                    if len(ordered) == 4:
                        questions[qnum] = {'stem': stem, 'options': ordered}

                continue

        i += 1

    return questions


def split_options_line_with_continuation(line):
    """한 줄에 여러 보기가 있는 경우 분리, marker_idx와 텍스트 반환"""
    # 보기 번호 순서 매핑
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


def ends_with_incomplete(text):
    """텍스트가 완성되지 않은 상태인지 (단순 휴리스틱)"""
    text = text.strip()
    if not text:
        return True
    # 마지막 문자가 마침표, 느낌표, 물음표, 닫는 괄호 등이면 완성
    return not text[-1] in '.!?)]다나인음한'


def join_stem_lines(lines):
    """
    stem 라인들을 합침
    PDF에서 줄바꿈으로 잘린 경우를 감지하여 처리:
    - 줄 끝이 '으' 같은 음절로 끝나고 다음 줄이 '로'로 시작하면 이어붙임
    - 일반적으로 줄바꿈 = 공백 없이 이어붙임 (PDF 2컬럼 특성)
    - 단, 줄 끝이 완결된 문장이면 공백으로 분리
    """
    if not lines:
        return ''

    # 빈 라인 제거
    lines = [l.strip() for l in lines if l.strip()]
    if not lines:
        return ''

    result = lines[0]
    for line in lines[1:]:
        if not line:
            continue
        # 이전 줄 끝과 현재 줄 시작 사이에 공백 넣을지 결정
        # PDF 줄바꿈 아티팩트이므로 기본적으로 공백 없이 이어붙임
        result = result + line

    return result


def flatten_json_text(text):
    """JSON 텍스트를 순수 텍스트로 평탄화 (비교용)"""
    text = re.sub(r'\[보기\]\n?', '', text)
    lines = text.split('\n')
    result_parts = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('ㆍ'):
            line = line[1:].strip()
        result_parts.append(line)
    # 줄들을 공백 없이 이어붙임 (PDF와 동일한 방식)
    return ''.join(result_parts)


def flatten_json_text_with_space(text):
    """JSON 텍스트를 공백 포함하여 평탄화 (읽기용)"""
    text = re.sub(r'\[보기\]\n?', '', text)
    lines = text.split('\n')
    result_parts = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('ㆍ'):
            line = line[1:].strip()
        result_parts.append(line)
    return ' '.join(result_parts)


def normalize_spaces(text):
    """공백 정규화"""
    return re.sub(r'\s+', ' ', text).strip()


def find_spacing_diffs(pdf_text_ns, json_text_ns, pdf_original, json_original):
    """
    두 텍스트에서 공백만 다른 위치를 찾아 반환
    ns = no-space 버전
    """
    if pdf_text_ns != json_text_ns:
        return None  # 내용 자체가 다름

    # PDF 원본 텍스트에서 공백 패턴 추출
    # 각 비공백 문자 사이에 공백이 있는지 없는지 시퀀스 생성
    def get_space_pattern(text):
        chars = []
        spaces = []  # chars[i]와 chars[i+1] 사이에 공백이 있으면 True
        for ch in text:
            if ch == ' ':
                if spaces:
                    spaces[-1] = True
                elif chars:
                    spaces.append(True)
            else:
                chars.append(ch)
                spaces.append(False)
        return chars, spaces

    pdf_chars, pdf_spaces = get_space_pattern(pdf_original)
    json_chars, json_spaces = get_space_pattern(json_original)

    if pdf_chars != json_chars:
        return None

    # 공백 패턴이 다른 위치
    diffs = []
    for i, (ps, js) in enumerate(zip(pdf_spaces, json_spaces)):
        if ps != js:
            diffs.append((i, ps, js, ''.join(pdf_chars[max(0,i-3):i+4])))

    return diffs


def apply_pdf_spacing_to_json_option(pdf_opt, json_opt):
    """
    PDF 보기 텍스트의 띄어쓰기를 JSON 보기에 적용
    PDF 줄바꿈 아티팩트를 제거한 PDF 텍스트를 기준으로 함
    """
    # 공백 없는 버전이 같은지 확인
    pdf_ns = re.sub(r'\s', '', pdf_opt)
    json_ns = re.sub(r'\s', '', json_opt)

    if pdf_ns != json_ns:
        return json_opt  # 내용이 다름

    if pdf_opt == json_opt:
        return json_opt  # 이미 같음

    # PDF가 올바른 띄어쓰기라고 가정하고 적용
    return pdf_opt


def apply_pdf_spacing_to_json_stem(pdf_stem, json_stem_raw):
    """
    PDF stem 텍스트의 띄어쓰기를 JSON stem에 적용
    JSON의 구조화 형식([보기], ㆍ 등)은 유지
    """
    # JSON stem을 구조 파트로 분리
    # [보기] 블록과 일반 텍스트 분리

    pdf_ns = re.sub(r'\s', '', pdf_stem)
    json_flat_ns = re.sub(r'\s', '', flatten_json_text(json_stem_raw))

    if pdf_ns != json_flat_ns:
        return json_stem_raw  # 내용이 다름

    if not json_stem_raw or '\n' not in json_stem_raw:
        # 단순 텍스트 → 직접 교체
        if normalize_spaces(pdf_stem) != normalize_spaces(json_stem_raw):
            return normalize_spaces(pdf_stem)
        return json_stem_raw

    # 구조화된 텍스트 → 각 세그먼트 교체
    # PDF 텍스트를 공백 없는 포인터로 순서대로 매핑
    pdf_chars = re.sub(r'\s', '', pdf_stem)
    pdf_original = pdf_stem

    # JSON 텍스트의 각 라인을 처리
    lines = json_stem_raw.split('\n')
    result_lines = []
    pdf_char_pos = 0  # pdf_chars에서 현재 위치

    for line in lines:
        stripped = line.strip()

        if not stripped or stripped == '[보기]':
            result_lines.append(line)
            continue

        # 접두사 분리
        prefix = ''
        content = stripped
        if stripped.startswith('ㆍ'):
            prefix = 'ㆍ'
            content = stripped[1:].strip()

        content_ns = re.sub(r'\s', '', content)

        if not content_ns:
            result_lines.append(line)
            continue

        # pdf_chars에서 content_ns가 있는 위치 찾기
        idx = pdf_chars.find(content_ns, pdf_char_pos)
        if idx < 0:
            result_lines.append(line)
            continue

        # PDF 원본에서 해당 구간의 공백 포함 버전 추출
        pdf_segment = extract_segment_with_spaces(pdf_original, idx, len(content_ns))
        pdf_char_pos = idx + len(content_ns)

        if pdf_segment:
            new_line = prefix + pdf_segment
            result_lines.append(new_line)
        else:
            result_lines.append(line)

    return '\n'.join(result_lines)


def extract_segment_with_spaces(text, ns_start, ns_length):
    """
    텍스트에서 공백 없는 인덱스 기준으로 공백 포함 구간 추출
    """
    ns_count = 0
    start_char = None
    chars_collected = []
    collected_ns = 0

    for i, ch in enumerate(text):
        if ch != ' ':
            if ns_count == ns_start and start_char is None:
                start_char = i
            ns_count += 1

        if start_char is not None:
            chars_collected.append(ch)
            if ch != ' ':
                collected_ns += 1
            if collected_ns >= ns_length:
                break

    if start_char is None or collected_ns < ns_length:
        return None

    return ''.join(chars_collected).strip()


def process_exam(exam_id):
    """한 시험 파일 처리"""
    pdf_path = PDF_MAP[exam_id]
    json_path = DATA_DIR / f'exam_{exam_id}.json'

    print(f'\n{"="*60}')
    print(f'처리 중: exam_{exam_id}')

    # PDF 텍스트 추출 (원본 라인)
    print('  PDF 파싱 중...')
    pdf_lines = extract_pdf_lines(pdf_path)

    # 문제 파싱 (줄바꿈 아티팩트 제거)
    pdf_questions = parse_questions_preserve_lines(pdf_lines)
    print(f'  PDF에서 {len(pdf_questions)}개 문제 파싱')

    # JSON 로드
    with open(json_path, encoding='utf-8') as f:
        json_data = json.load(f)

    total_changes = []

    # 각 문제 비교 및 수정
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

        # JSON stem 평탄화 (공백 없는 버전)
        json_stem_flat_ns = re.sub(r'\s', '', flatten_json_text(json_stem_raw))
        pdf_stem_ns = re.sub(r'\s', '', pdf_stem)

        # stem 비교 (공백 없는 버전이 같아야 함)
        if pdf_stem_ns == json_stem_flat_ns:
            # 공백 패턴 비교
            json_stem_flat = flatten_json_text(json_stem_raw)
            if pdf_stem != json_stem_flat:
                # 띄어쓰기 차이 있음 → PDF 기준으로 수정
                new_stem = apply_pdf_spacing_to_json_stem(pdf_stem, json_stem_raw)
                if new_stem != json_stem_raw:
                    old_flat = normalize_spaces(flatten_json_text_with_space(json_stem_raw))
                    new_flat = normalize_spaces(flatten_json_text_with_space(new_stem))
                    if old_flat != new_flat:
                        changes.append(f'stem: "{old_flat[:70]}" → "{new_flat[:70]}"')
                        new_q['stem'] = new_stem

        # options 비교
        if len(pdf_options) == 4 and len(json_options) == 4:
            new_options = list(json_options)
            for j, (pdf_opt, json_opt) in enumerate(zip(pdf_options, json_options)):
                pdf_opt_ns = re.sub(r'\s', '', pdf_opt)
                json_opt_ns = re.sub(r'\s', '', json_opt)

                if pdf_opt_ns == json_opt_ns and pdf_opt != json_opt:
                    changes.append(f'opt{j+1}: "{json_opt}" → "{pdf_opt}"')
                    new_options[j] = pdf_opt

            new_q['options'] = new_options

        if changes:
            total_changes.append((qnum, changes))
            json_data['questions'][i] = new_q

    # 저장
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    print(f'  수정된 문제: {len(total_changes)}개')

    for qnum, changes in total_changes[:15]:
        print(f'  Q{qnum}:')
        for change in changes[:3]:
            print(f'    {change[:120]}')

    if len(total_changes) > 15:
        print(f'  ... 외 {len(total_changes) - 15}개 더')

    return len(total_changes), total_changes


def main():
    print('PDF-JSON 띄어쓰기 수정 시작 (v2)')

    total_all = 0
    for exam_id in ['2024-1', '2024-2', '2024-3', '2025-1', '2025-2', '2025-3']:
        count, changes = process_exam(exam_id)
        total_all += count

    print(f'\n총 수정: {total_all}개 문제')


if __name__ == '__main__':
    main()
