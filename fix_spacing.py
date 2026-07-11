#!/usr/bin/env python3
"""
PDF-JSON 띄어쓰기 비교 및 수정 스크립트
PDF를 파싱하여 JSON의 띄어쓰기 오류를 수정합니다.
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


def extract_pdf_text(pdf_path):
    """PDF에서 2컬럼 분리하여 텍스트 추출"""
    all_text = ''
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            width = page.width
            left = page.crop((0, 0, width / 2, page.height))
            right = page.crop((width / 2, 0, width, page.height))
            left_text = left.extract_text() or ''
            right_text = right.extract_text() or ''
            all_text += left_text + '\n' + right_text + '\n'
    return all_text


def parse_questions_from_text(text):
    """텍스트에서 문제 파싱"""
    lines = text.split('\n')

    questions = {}  # {qnum: {'stem': str, 'options': [str, str, str, str]}}

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 문제 번호 패턴: "1." 또는 "1 ." 으로 시작
        m = re.match(r'^(\d+)\.\s*(.*)', line)
        if m:
            qnum = int(m.group(1))
            if 1 <= qnum <= 100:
                stem_parts = [m.group(2).strip()]
                i += 1

                # stem 수집: 보기 기호가 나올 때까지
                while i < len(lines):
                    next_line = lines[i].strip()

                    # 다음 문제 번호가 나오면 중단
                    next_q = re.match(r'^(\d+)\.\s*', next_line)
                    if next_q and int(next_q.group(1)) == qnum + 1:
                        break

                    # 보기 기호로 시작하면 보기 수집 시작
                    if OPTION_PATTERN.match(next_line):
                        break

                    # 빈 줄 건너뛰기 (너무 많으면 중단)
                    if next_line == '':
                        i += 1
                        continue

                    stem_parts.append(next_line)
                    i += 1

                # 보기 수집
                options_raw = []
                while i < len(lines) and len(options_raw) < 4:
                    next_line = lines[i].strip()

                    if next_line == '':
                        i += 1
                        continue

                    # 다음 문제 번호가 나오면 중단
                    next_q = re.match(r'^(\d+)\.\s*', next_line)
                    if next_q and 1 <= int(next_q.group(1)) <= 100:
                        break

                    # 보기가 포함된 라인 처리
                    if OPTION_PATTERN.search(next_line):
                        # 한 줄에 여러 보기가 있는 경우 분리
                        parts = split_options_line(next_line)
                        options_raw.extend(parts)
                        i += 1
                    else:
                        # 보기가 없는데 이전 보기의 계속인 경우
                        if options_raw:
                            options_raw[-1] += ' ' + next_line
                        i += 1

                # stem 정제
                stem = clean_stem(stem_parts)

                # options 정제
                options = [clean_option(o) for o in options_raw[:4]]

                if stem and len(options) == 4:
                    questions[qnum] = {
                        'stem': stem,
                        'options': options
                    }

                continue

        i += 1

    return questions


def split_options_line(line):
    """한 줄에 여러 보기가 있는 경우 분리 (① A ② B → ['A', 'B'])"""
    # 보기 번호로 분리
    parts = re.split(r'([①②③④])', line)

    options = []
    current = None
    for part in parts:
        if part in OPTION_MARKERS:
            if current is not None:
                text = current.strip()
                if text:
                    options.append(text)
            current = ''
        elif current is not None:
            current += part

    if current is not None:
        text = current.strip()
        if text:
            options.append(text)

    return options


def clean_stem(parts):
    """stem 파트들을 하나로 합치고 정제"""
    # 빈 파트 제거
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        return ''

    # 하이픈으로 끝나는 줄 처리 (단어 분리)
    result_parts = []
    for part in parts:
        if result_parts and result_parts[-1].endswith('-'):
            # 하이픈 제거하고 이어붙임
            result_parts[-1] = result_parts[-1][:-1] + part
        else:
            result_parts.append(part)

    return ' '.join(result_parts)


def clean_option(opt):
    """보기 텍스트 정제"""
    # 보기 번호 제거 (혹시 남아있다면)
    opt = OPTION_PATTERN.sub('', opt).strip()
    # 연속 공백 정규화
    opt = re.sub(r'  +', ' ', opt)
    return opt.strip()


def flatten_json_text(text):
    """JSON 텍스트를 순수 텍스트로 평탄화 (비교용)"""
    # [보기]\n 제거
    text = re.sub(r'\[보기\]\n?', '', text)
    # ㆍ로 시작하는 줄의 ㆍ 제거 후 공백으로 이어붙임
    # 줄바꿈을 공백으로 (단, 보기 기호 줄은 유지)
    lines = text.split('\n')
    result_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # ㆍ 제거
        if line.startswith('ㆍ'):
            line = line[1:].strip()
        # ㉠~㉦ 등 원문자도 유지
        result_lines.append(line)

    return ' '.join(result_lines)


def normalize_spaces(text):
    """공백 정규화 (비교용)"""
    return re.sub(r'\s+', ' ', text).strip()


def texts_differ_only_in_spaces(text1, text2):
    """두 텍스트가 공백만 다른지 확인"""
    # 공백 제거 후 비교
    t1_no_space = re.sub(r'\s', '', text1)
    t2_no_space = re.sub(r'\s', '', text2)
    return t1_no_space == t2_no_space and normalize_spaces(text1) != normalize_spaces(text2)


def apply_spacing_fix_to_json_text(json_text, pdf_text_flat):
    """
    JSON 텍스트에 PDF의 올바른 띄어쓰기를 적용
    JSON의 구조화 형식은 유지하면서 각 세그먼트의 텍스트만 수정
    """
    # JSON 텍스트를 세그먼트로 분리
    # [보기]\n 이전/이후, ㆍ 줄 등 구조 유지

    # JSON 평탄화 버전과 PDF 평탄화 버전의 토큰 매핑
    # 전략: PDF 텍스트를 기준으로 JSON 세그먼트를 매핑

    # 간단한 접근: JSON 텍스트의 각 라인을 PDF 평탄화 텍스트에서 찾아 교체
    lines = json_text.split('\n')
    result_lines = []

    # PDF 토큰 리스트 (공백 없는 버전)
    pdf_no_space = re.sub(r'\s', '', pdf_text_flat)

    for line in lines:
        stripped = line.strip()
        if not stripped:
            result_lines.append(line)
            continue

        # 구조 태그는 건드리지 않음
        if stripped == '[보기]':
            result_lines.append(line)
            continue

        # ㆍ로 시작하는 항목
        prefix = ''
        content = stripped
        if stripped.startswith('ㆍ'):
            prefix = 'ㆍ'
            content = stripped[1:].strip()
        elif re.match(r'^[㉠-㉻]', stripped):
            # ㉠ 등으로 시작하는 항목
            pass  # 그대로 처리

        # 공백 없는 버전
        content_no_space = re.sub(r'\s', '', content)

        # PDF 평탄화 텍스트에서 해당 내용 찾기
        if content_no_space and content_no_space in pdf_no_space:
            # PDF에서 해당 내용의 올바른 버전 찾기
            pdf_correct = find_correct_spacing(content_no_space, pdf_text_flat)
            if pdf_correct and normalize_spaces(pdf_correct) != normalize_spaces(content):
                if prefix:
                    result_lines.append(prefix + pdf_correct)
                else:
                    result_lines.append(pdf_correct)
                continue

        result_lines.append(line)

    return '\n'.join(result_lines)


def find_correct_spacing(no_space_text, pdf_flat_text):
    """PDF 평탄화 텍스트에서 공백 없는 텍스트에 해당하는 올바른 버전 찾기"""
    # PDF 텍스트를 공백으로 분리된 토큰 시퀀스로 변환
    pdf_chars = list(pdf_flat_text)

    result = []
    pdf_i = 0
    text_i = 0

    while text_i < len(no_space_text) and pdf_i < len(pdf_chars):
        # 공백 건너뛰기
        while pdf_i < len(pdf_chars) and pdf_chars[pdf_i] == ' ':
            result.append(' ')
            pdf_i += 1

        if pdf_i >= len(pdf_chars):
            break

        if text_i < len(no_space_text) and pdf_chars[pdf_i] == no_space_text[text_i]:
            result.append(pdf_chars[pdf_i])
            text_i += 1
            pdf_i += 1
        else:
            # 매칭 실패
            return None

    if text_i < len(no_space_text):
        return None

    # 뒤에 남은 공백
    while pdf_i < len(pdf_chars) and pdf_chars[pdf_i] == ' ':
        result.append(' ')
        pdf_i += 1

    return ''.join(result).strip()


def compare_and_fix_question(pdf_q, json_q, qnum, exam_id):
    """문제 하나를 비교하고 수정"""
    changes = []
    json_q_new = copy.deepcopy(json_q)

    pdf_stem = pdf_q.get('stem', '')
    pdf_options = pdf_q.get('options', [])

    json_stem_raw = json_q.get('stem', '')
    json_options = json_q.get('options', [])

    # JSON stem 평탄화
    json_stem_flat = flatten_json_text(json_stem_raw)

    # stem 비교
    pdf_stem_norm = normalize_spaces(pdf_stem)
    json_stem_norm = normalize_spaces(json_stem_flat)

    # 공백 없는 버전으로 같은지 확인
    pdf_stem_ns = re.sub(r'\s', '', pdf_stem_norm)
    json_stem_ns = re.sub(r'\s', '', json_stem_norm)

    if pdf_stem_ns == json_stem_ns and pdf_stem_norm != json_stem_norm:
        # 띄어쓰기만 다름 - 수정 필요
        new_stem = apply_spacing_to_structured_text(json_stem_raw, pdf_stem_norm)
        if new_stem != json_stem_raw:
            changes.append(f'  stem: "{json_stem_flat[:60]}..." → "{pdf_stem_norm[:60]}..."')
            json_q_new['stem'] = new_stem
    elif pdf_stem_ns != json_stem_ns:
        # 내용 자체가 다름 (이미지/코드 등)
        pass

    # options 비교
    if len(pdf_options) == 4 and len(json_options) == 4:
        new_options = list(json_options)
        for j, (pdf_opt, json_opt) in enumerate(zip(pdf_options, json_options)):
            pdf_opt_norm = normalize_spaces(pdf_opt)
            json_opt_norm = normalize_spaces(json_opt)

            pdf_opt_ns = re.sub(r'\s', '', pdf_opt_norm)
            json_opt_ns = re.sub(r'\s', '', json_opt_norm)

            if pdf_opt_ns == json_opt_ns and pdf_opt_norm != json_opt_norm:
                changes.append(f'  opt{j+1}: "{json_opt}" → "{pdf_opt_norm}"')
                new_options[j] = pdf_opt_norm

        json_q_new['options'] = new_options

    return json_q_new, changes


def apply_spacing_to_structured_text(json_text, pdf_flat_norm):
    """
    구조화된 JSON 텍스트에 PDF의 올바른 띄어쓰기 적용
    [보기], ㆍ 등 구조는 유지하면서 텍스트 내용만 수정
    """
    # JSON 텍스트를 파트로 분리
    # 각 라인을 처리하면서 구조 태그는 유지
    lines = json_text.split('\n')

    # PDF 텍스트를 문자 단위로 파싱하여 공백 위치 파악
    # PDF 평탄화 텍스트에서 각 라인의 내용을 찾아 교체

    pdf_ns = re.sub(r'\s', '', pdf_flat_norm)

    result_lines = []
    pdf_pos = 0  # pdf_ns에서의 현재 위치

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

        # pdf_ns에서 content_ns를 찾아 PDF의 올바른 띄어쓰기 적용
        idx = pdf_ns.find(content_ns, pdf_pos)
        if idx >= 0:
            # PDF 평탄화 텍스트에서 해당 구간 추출
            # pdf_flat_norm에서 공백 포함하여 해당 내용 복원
            pdf_correct = extract_with_spaces(pdf_flat_norm, content_ns, idx)
            pdf_pos = idx + len(content_ns)

            if pdf_correct:
                result_lines.append(prefix + pdf_correct)
            else:
                result_lines.append(line)
        else:
            result_lines.append(line)

    return '\n'.join(result_lines)


def extract_with_spaces(pdf_flat, content_ns, ns_start_idx):
    """
    PDF 평탄화 텍스트에서 공백 없는 인덱스 기준으로 공백 포함 텍스트 추출
    """
    # pdf_flat에서 공백을 건너뛰며 ns_start_idx번째 비공백 문자부터 시작
    chars = []
    ns_count = 0
    in_target = False
    target_ns_count = 0

    for ch in pdf_flat:
        if ch != ' ':
            if ns_count == ns_start_idx and not in_target:
                in_target = True
            ns_count += 1

        if in_target:
            chars.append(ch)
            if ch != ' ':
                target_ns_count += 1
            if target_ns_count >= len(content_ns):
                break

    return ''.join(chars).strip()


def process_exam(exam_id):
    """한 시험 파일 처리"""
    pdf_path = PDF_MAP[exam_id]
    json_path = DATA_DIR / f'exam_{exam_id}.json'

    print(f'\n{"="*60}')
    print(f'처리 중: exam_{exam_id}')
    print(f'PDF: {pdf_path}')

    # PDF 텍스트 추출
    print('  PDF 파싱 중...')
    pdf_text = extract_pdf_text(pdf_path)

    # 문제 파싱
    pdf_questions = parse_questions_from_text(pdf_text)
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
        new_q, changes = compare_and_fix_question(pdf_q, json_q, qnum, exam_id)

        if changes:
            total_changes.append((qnum, changes))
            json_data['questions'][i] = new_q

    # 저장
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    print(f'  수정된 문제: {len(total_changes)}개')

    # 수정 내용 출력 (최대 10개)
    for qnum, changes in total_changes[:10]:
        print(f'  Q{qnum}:')
        for change in changes[:3]:
            print(f'    {change}')

    if len(total_changes) > 10:
        print(f'  ... 외 {len(total_changes) - 10}개 더')

    return len(total_changes), total_changes


def main():
    print('PDF-JSON 띄어쓰기 수정 시작')

    total_all = 0
    for exam_id in ['2024-1', '2024-2', '2024-3', '2025-1', '2025-2', '2025-3']:
        count, changes = process_exam(exam_id)
        total_all += count

    print(f'\n총 수정: {total_all}개 문제')


if __name__ == '__main__':
    main()
