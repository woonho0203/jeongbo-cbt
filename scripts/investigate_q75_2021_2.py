#!/usr/bin/env python3
"""2021-2 Q75 이미지 상세 분석 및 Q75 문제 범위 파악"""
import pdfplumber, re

PDF_PATH = "/Users/woonho/Downloads/정보처리기사 문제/2021년 2회_정보처리기사 필기 기출문제.pdf"

def get_qnum_map(page):
    qnums = {}
    for w in page.extract_words():
        if re.match(r'^\d{1,2}\.$', w['text']):
            q = int(w['text'][:-1])
            if 1 <= q <= 100:
                qnums[q] = {'x': float(w['x0']), 'y': float(w['top'])}
    return qnums

def nearest_question_above(qnums, ix, iy, col_threshold=300):
    left_col = ix < col_threshold
    candidates = {
        q: v for q, v in qnums.items()
        if v['y'] <= iy + 30
        and ((left_col and v['x'] < col_threshold) or (not left_col and v['x'] >= col_threshold))
    }
    if not candidates:
        candidates = {q: v for q, v in qnums.items() if v['y'] <= iy + 30}
    return max(candidates, key=lambda q: candidates[q]['y']) if candidates else None

with pdfplumber.open(PDF_PATH) as pdf:
    for i, page in enumerate(pdf.pages):
        qmap = get_qnum_map(page)
        if 75 in qmap:
            print(f"페이지 {i+1}에서 Q75 발견")
            print(f"페이지 높이: {page.height:.0f}")
            print(f"\n전체 Q번호 및 위치:")
            for q in sorted(qmap.keys()):
                print(f"  Q{q}: y={qmap[q]['y']:.1f}, x={qmap[q]['x']:.1f}")

            q75_y = qmap[75]['y']
            q76_y = qmap[76]['y']
            print(f"\nQ75 y={q75_y:.1f} ~ Q76 y={q76_y:.1f}")

            print(f"\n[이미지 상세]")
            for idx, img in enumerate(page.images):
                ix, iy = float(img['x0']), float(img['top'])
                ib = float(img['bottom'])
                iw = float(img['x1']) - ix
                ih = ib - iy
                nearest = nearest_question_above(qmap, ix, iy)
                in_q75 = (q75_y - 10 <= iy <= q76_y + 10)
                print(f"  [{idx}] x={ix:.0f}, y={iy:.0f}~{ib:.0f}, 크기={iw:.0f}x{ih:.0f}, "
                      f"nearest={nearest}, in_Q75_range={in_q75}")

            # Q75 텍스트 추출
            print(f"\n[Q75~Q76 영역 텍스트]")
            words = page.extract_words()
            for w in words:
                if q75_y - 5 <= float(w['top']) <= q76_y + 5:
                    print(f"  y={w['top']:.0f}: '{w['text']}'")
            break
