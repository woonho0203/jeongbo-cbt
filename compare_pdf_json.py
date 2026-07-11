#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF와 JSON 데이터 비교 검수 스크립트
"""

import json
import re
import os
import pdfplumber

PDF_DIR = "/Users/woonho/Downloads"
JSON_DIR = "/Users/woonho/Downloads/정보처리기사_CBT/data"

MAPPING = {
    "1. 2024년1회_정보처리기사필기기출문제.pdf":    "exam_2024-1.json",
    "2. 2024년2회_정보처리기사필기기출문제.pdf":    "exam_2024-2.json",
    "3. 2024년3회_정보처리기사필기기출문제.pdf":    "exam_2024-3.json",
    "2025년1회_정보처리기사필기기출문제.pdf":       "exam_2025-1.json",
    "2025년2회_정보처리기사필기기출문제.pdf":       "exam_2025-2.json",
    "2025년3회_정보처리기사 필기_기출문제.pdf":     "exam_2025-3.json",
    "정보처리기사필기_04_키워드찾기259문제.pdf":     "category_keyword.json",
    "정보처리기사필기_01_필수계산41문제.pdf":        "category_calc.json",
    "정보처리기사필기_02_필수코드57문제.pdf":        "category_code.json",
    "정보처리기사필기_03_잘못된문장찾기197문제.pdf": "category_wrong-sentence.json",
    "정보처리기사필기_05_종류순서114문제.pdf":       "category_sequence.json",
}


def normalize(text):
    """비교를 위한 텍스트 정규화: 공백/줄바꿈 제거, 특수문자 통일"""
    if not text:
        return ""
    # 전각 기호 → 반각
    text = text.replace('＋', '+').replace('＝', '=').replace('（', '(').replace('）', ')')
    text = text.replace('​', '').replace('\xa0', ' ')
    # 연속 공백/줄바꿈 → 단일 공백
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_pdf_text(pdf_path):
    """pdfplumber로 전체 텍스트 추출"""
    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t)
    return "\n".join(pages_text)


def find_in_pdf(text_norm, pdf_norm, threshold=0.85):
    """
    JSON의 텍스트가 PDF 텍스트에 포함되어 있는지 확인.
    완전 포함이면 True, 아니면 가장 유사한 매칭 길이 비율 반환.
    """
    if not text_norm:
        return True, 1.0
    if text_norm in pdf_norm:
        return True, 1.0

    # 앞 30자로 부분 검색
    head = text_norm[:30]
    if head in pdf_norm:
        # 문장이 있긴 한데 내용이 다를 수 있음 → 유사도 체크
        idx = pdf_norm.find(head)
        window = pdf_norm[idx:idx + len(text_norm) + 50]
        # 공통 문자 비율
        common = sum(1 for a, b in zip(text_norm, window) if a == b)
        ratio = common / len(text_norm)
        return ratio >= threshold, ratio

    # 완전히 없음
    return False, 0.0


def load_json(json_path):
    with open(json_path, encoding='utf-8') as f:
        return json.load(f)


def get_questions(data):
    """JSON에서 문제 목록 추출 (exam / category 모두 처리)"""
    if 'questions' in data:
        return data['questions']
    # category 파일은 subject별로 묶여있을 수 있음
    questions = []
    if isinstance(data, list):
        for item in data:
            questions.extend(item.get('questions', []))
    elif isinstance(data, dict):
        for key, val in data.items():
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, dict) and 'stem' in item:
                        questions.append(item)
                    elif isinstance(item, dict) and 'questions' in item:
                        questions.extend(item['questions'])
    return questions


def compare_file(pdf_name, json_name):
    pdf_path = os.path.join(PDF_DIR, pdf_name)
    json_path = os.path.join(JSON_DIR, json_name)

    print(f"\n{'='*70}")
    print(f"[비교] {pdf_name}")
    print(f"       → {json_name}")
    print(f"{'='*70}")

    if not os.path.exists(pdf_path):
        print(f"  [오류] PDF 파일 없음: {pdf_path}")
        return

    if not os.path.exists(json_path):
        print(f"  [오류] JSON 파일 없음: {json_path}")
        return

    # PDF 텍스트 추출
    try:
        pdf_raw = extract_pdf_text(pdf_path)
    except Exception as e:
        print(f"  [오류] PDF 추출 실패: {e}")
        return

    pdf_norm = normalize(pdf_raw)

    # JSON 로드
    json_data = load_json(json_path)
    questions = get_questions(json_data)

    total = len(questions)
    mismatches = []

    for q in questions:
        qnum = q.get('qnum', q.get('id', '?'))
        stem = q.get('stem', '')
        options = q.get('options', [])

        issues = []

        # stem 검사 (앞 40자로 PDF 내 존재 여부 확인)
        stem_norm = normalize(stem)
        found_stem, ratio_stem = find_in_pdf(stem_norm, pdf_norm)
        if not found_stem:
            if ratio_stem == 0.0:
                issues.append(f"stem 없음 (PDF에서 찾을 수 없음)")
            else:
                issues.append(f"stem 불일치 (유사도 {ratio_stem:.0%})")

        # options 검사
        for i, opt in enumerate(options):
            opt_norm = normalize(str(opt))
            if len(opt_norm) < 3:
                continue  # 너무 짧으면 skip
            found_opt, ratio_opt = find_in_pdf(opt_norm, pdf_norm)
            if not found_opt:
                if ratio_opt == 0.0:
                    issues.append(f"보기{i+1} '{opt_norm[:30]}' → PDF에서 찾을 수 없음")
                else:
                    issues.append(f"보기{i+1} '{opt_norm[:30]}' → 유사도 {ratio_opt:.0%}")

        if issues:
            mismatches.append({'qnum': qnum, 'issues': issues, 'stem_preview': stem[:60]})

    # 결과 출력
    print(f"  총 문제 수: {total}")
    print(f"  불일치 문제 수: {len(mismatches)}")

    if mismatches:
        print(f"\n  [불일치 상세]")
        for m in mismatches:
            print(f"  문제 {m['qnum']}: {m['stem_preview']}...")
            for iss in m['issues']:
                print(f"    - {iss}")
    else:
        print("  → 모든 문제/보기가 PDF와 일치합니다.")

    return total, len(mismatches), mismatches


def main():
    grand_total = 0
    grand_mismatch = 0

    results = {}
    for pdf_name, json_name in MAPPING.items():
        res = compare_file(pdf_name, json_name)
        if res:
            total, mismatch, details = res
            grand_total += total
            grand_mismatch += mismatch
            results[json_name] = {'total': total, 'mismatch': mismatch}

    print(f"\n{'='*70}")
    print(f"[전체 요약]")
    print(f"  총 문제 수: {grand_total}")
    print(f"  불일치 문제 수: {grand_mismatch}")
    print(f"\n  파일별 요약:")
    for fname, r in results.items():
        status = "OK" if r['mismatch'] == 0 else f"불일치 {r['mismatch']}건"
        print(f"    {fname}: {r['total']}문제 / {status}")


if __name__ == '__main__':
    main()
