#!/usr/bin/env python3
"""Q99/Q100 케이스 및 2021-3 Q43 추가 조사"""
import pdfplumber
import re
import os

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

def investigate_q99_page(pdf_path, label):
    print(f"\n{'='*70}")
    print(f"{label} - Q99/Q100 페이지 상세 조사")
    print('='*70)
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            qmap = get_qnum_map(page)
            if 99 in qmap:
                print(f"\n  Q99 발견: 페이지 {i+1}, y={qmap[99]['y']:.1f}")
                print(f"  페이지 전체 Q번호: {sorted(qmap.keys())}")
                page_height = float(page.height)
                print(f"  페이지 높이: {page_height:.0f}")

                # 이미지
                images = page.images
                print(f"\n  [이미지] {len(images)}개:")
                for idx, img in enumerate(images):
                    ix, iy = float(img['x0']), float(img['top'])
                    iw = float(img['x1']) - ix
                    ih = float(img['bottom']) - iy
                    nearest = nearest_question_above(qmap, ix, iy)
                    print(f"    [{idx}] bbox=({ix:.0f},{iy:.0f},{img['x1']:.0f},{img['bottom']:.0f}) "
                          f"크기={iw:.0f}x{ih:.0f} nearest={nearest}")

                # 표
                tables = page.find_tables()
                print(f"\n  [표] {len(tables)}개:")
                for idx, tbl in enumerate(tables):
                    bbox = tbl.bbox
                    tx, ty = float(bbox[0]), float(bbox[1])
                    nearest = nearest_question_above(qmap, tx, ty)
                    print(f"    [{idx}] bbox=({bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}) nearest={nearest}")

                # Q99 다음 페이지 확인
                if i + 1 < len(pdf.pages):
                    next_page = pdf.pages[i + 1]
                    next_qmap = get_qnum_map(next_page)
                    print(f"\n  다음 페이지({i+2}) Q번호: {sorted(next_qmap.keys())}")
                    next_images = next_page.images
                    next_tables = next_page.find_tables()
                    print(f"  다음 페이지 이미지: {len(next_images)}개")
                    for idx, img in enumerate(next_images):
                        ix, iy = float(img['x0']), float(img['top'])
                        iw = float(img['x1']) - ix
                        ih = float(img['bottom']) - iy
                        nearest = nearest_question_above(next_qmap, ix, iy)
                        print(f"    [{idx}] bbox=({ix:.0f},{iy:.0f},{img['x1']:.0f},{img['bottom']:.0f}) "
                              f"크기={iw:.0f}x{ih:.0f} nearest={nearest}")
                    print(f"  다음 페이지 표: {len(next_tables)}개")
                break

def investigate_2021_3_q43():
    """2021-3 Q43 이미지들 - nearest_question_above 동작 분석"""
    pdf_path = os.path.join(PDF_DIR, "2021년 3회_정보처리기사 필기 기출문제.pdf")
    print(f"\n{'='*70}")
    print(f"[2021-3] Q43 상세 분석")
    print('='*70)
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            qmap = get_qnum_map(page)
            if 43 in qmap:
                print(f"\n  Q43 발견: 페이지 {i+1}")
                print(f"  페이지 Q번호 전체:")
                for q in sorted(qmap.keys()):
                    print(f"    Q{q}: y={qmap[q]['y']:.1f}, x={qmap[q]['x']:.1f}")

                q43_y = qmap[43]['y']
                # 다음 Q (Q44) 위치 파악
                all_qs_sorted = sorted(qmap.keys())
                idx_43 = all_qs_sorted.index(43)
                # Q44가 같은 페이지에 있는지 확인
                if 44 in qmap:
                    q44_y = qmap[44]['y']
                    print(f"\n  Q43 y={q43_y:.1f}, Q44 y={q44_y:.1f}")
                    print(f"  주목: Q44의 y({q44_y:.1f}) < Q43의 y({q43_y:.1f}) → 다음 컬럼/다음 페이지임")

                print(f"\n  [이미지 분석]")
                for idx, img in enumerate(page.images):
                    ix, iy = float(img['x0']), float(img['top'])
                    nearest = nearest_question_above(qmap, ix, iy)
                    print(f"    [{idx}] y={iy:.0f}, x={ix:.0f}, nearest_question_above={nearest}")
                    # nearest_question_above 내부 동작 추적
                    col_threshold = 300
                    left_col = ix < col_threshold
                    candidates = {
                        q: v for q, v in qmap.items()
                        if v['y'] <= iy + 30
                        and ((left_col and v['x'] < col_threshold) or (not left_col and v['x'] >= col_threshold))
                    }
                    print(f"       left_col={left_col}, candidates={list(candidates.keys())}")
                break

def investigate_2017_1_q2():
    """2017-1 Q2 표 - nearest_question_above 동작 분석"""
    pdf_path = os.path.join(PDF_DIR, "2017년1회_정보처리기사필기기출문제.pdf")
    print(f"\n{'='*70}")
    print(f"[2017-1] Q2 표 상세 분석")
    print('='*70)
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        qmap = get_qnum_map(page)
        print(f"  페이지 1 Q번호:")
        for q in sorted(qmap.keys()):
            print(f"    Q{q}: y={qmap[q]['y']:.1f}, x={qmap[q]['x']:.1f}")

        print(f"\n  [표 분석]")
        for idx, tbl in enumerate(page.find_tables()):
            bbox = tbl.bbox
            tx, ty = float(bbox[0]), float(bbox[1])
            nearest = nearest_question_above(qmap, tx, ty)
            col_threshold = 300
            left_col = tx < col_threshold
            candidates = {
                q: v for q, v in qmap.items()
                if v['y'] <= ty + 30
                and ((left_col and v['x'] < col_threshold) or (not left_col and v['x'] >= col_threshold))
            }
            print(f"    표[{idx}] y={ty:.0f}, x={tx:.0f}, nearest={nearest}, candidates={list(candidates.keys())}")
            try:
                data = tbl.extract()
                print(f"           내용: {data[:1]}")
            except:
                pass

investigate_2017_1_q2()
investigate_2021_3_q43()

investigate_q99_page(
    os.path.join(PDF_DIR, "2020년 3회_정보처리기사 필기 기출문제.pdf"),
    "[2020-3] Q100"
)
investigate_q99_page(
    os.path.join(PDF_DIR, "2021년 3회_정보처리기사 필기 기출문제.pdf"),
    "[2021-3] Q100"
)
investigate_q99_page(
    os.path.join(PDF_DIR, "2022년2회_기사필기 기출문제.pdf"),
    "[2022-2] Q100"
)
