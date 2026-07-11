#!/usr/bin/env python3
"""Q100 케이스 - PDF 마지막 페이지 텍스트 및 이미지 상세 확인"""
import pdfplumber, re

PDF_DIR = "/Users/woonho/Downloads/정보처리기사 문제"

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

CASES = [
    ("2020-3", "2020년 3회_정보처리기사 필기 기출문제.pdf", 7),  # Q99 페이지=7
    ("2021-3", "2021년 3회_정보처리기사 필기 기출문제.pdf", 8),  # Q99 페이지=8
    ("2022-2", "2022년2회_기사필기 기출문제.pdf", 9),  # Q99 페이지=9
]

for label, fname, q99_pnum in CASES:
    pdf_path = f"{PDF_DIR}/{fname}"
    print(f"\n{'='*70}")
    print(f"[{label}] Q99/Q100 분석 (Q99 페이지={q99_pnum})")
    print('='*70)
    with pdfplumber.open(pdf_path) as pdf:
        # Q99가 있는 페이지
        page99 = pdf.pages[q99_pnum - 1]
        qmap99 = get_qnum_map(page99)
        q99_y = qmap99.get(99, {}).get('y', None)
        print(f"  Q99 페이지({q99_pnum}) Q번호: {sorted(qmap99.keys())}")
        print(f"  페이지 높이: {page99.height:.0f}")
        if q99_y:
            print(f"  Q99 y={q99_y:.1f}")

        # Q99 페이지 이미지
        print(f"\n  [Q99 페이지 이미지]")
        for idx, img in enumerate(page99.images):
            ix, iy = float(img['x0']), float(img['top'])
            ib = float(img['bottom'])
            iw = float(img['x1']) - ix
            ih = ib - iy
            nearest = nearest_question_above(qmap99, ix, iy)
            print(f"    [{idx}] bbox=({ix:.0f},{iy:.0f},{img['x1']:.0f},{ib:.0f}) "
                  f"크기={iw:.0f}x{ih:.0f} nearest={nearest}")

        # Q99 이후 텍스트 (Q99 문제 내용)
        if q99_y:
            print(f"\n  [Q99 문제 텍스트 (y={q99_y:.0f} ~ 페이지 끝)]")
            words = page99.extract_words()
            for w in words:
                if float(w['top']) >= q99_y - 5:
                    print(f"    y={w['top']:.0f} x={w['x0']:.0f}: '{w['text']}'")

        # 다음 페이지 (Q100이 있을 가능성)
        if q99_pnum < len(pdf.pages):
            next_page = pdf.pages[q99_pnum]
            next_qmap = get_qnum_map(next_page)
            print(f"\n  [다음 페이지({q99_pnum+1}) 내용]")
            print(f"  Q번호: {sorted(next_qmap.keys())}")
            print(f"  페이지 높이: {next_page.height:.0f}")

            print(f"  이미지:")
            for idx, img in enumerate(next_page.images):
                ix, iy = float(img['x0']), float(img['top'])
                ib = float(img['bottom'])
                iw = float(img['x1']) - ix
                ih = ib - iy
                nearest = nearest_question_above(next_qmap, ix, iy)
                print(f"    [{idx}] bbox=({ix:.0f},{iy:.0f},{img['x1']:.0f},{ib:.0f}) "
                      f"크기={iw:.0f}x{ih:.0f} nearest={nearest}")

            tables = next_page.find_tables()
            print(f"  표: {len(tables)}개")
            for idx, tbl in enumerate(tables):
                bbox = tbl.bbox
                nearest = nearest_question_above(next_qmap, float(bbox[0]), float(bbox[1]))
                print(f"    [{idx}] bbox=({bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}) nearest={nearest}")
                try:
                    data = tbl.extract()
                    print(f"         {data[:2]}")
                except:
                    pass

            # 다음 페이지 전체 텍스트 (Q100 내용 확인)
            print(f"\n  [다음 페이지 전체 텍스트]")
            words2 = next_page.extract_words()
            for w in words2[:40]:  # 처음 40개만
                print(f"    y={w['top']:.0f} x={w['x0']:.0f}: '{w['text']}'")
