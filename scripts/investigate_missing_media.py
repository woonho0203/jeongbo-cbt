#!/usr/bin/env python3
"""
누락된 이미지/표 후보를 PDF에서 직접 확인하는 조사 스크립트
"""
import pdfplumber
import re
import os

PDF_DIR = "/Users/woonho/Downloads/정보처리기사 문제"

PDF_MAP = {
    "2017-1": "2017년1회_정보처리기사필기기출문제.pdf",
    "2020-3": "2020년 3회_정보처리기사 필기 기출문제.pdf",
    "2020-4": "2020년 4회_정보처리기사 필기 기출문제.pdf",
    "2021-1": "2021년 1회_정보처리기사 필기 기출문제.pdf",
    "2021-2": "2021년 2회_정보처리기사 필기 기출문제.pdf",
    "2021-3": "2021년 3회_정보처리기사 필기 기출문제.pdf",
    "2022-2": "2022년2회_기사필기 기출문제.pdf",
    "2023-1": "2023년1회_정보처리기사필기기출문제.pdf",
}

TARGETS = [
    ("2017-1", 2, "표"),
    ("2020-3", 100, "이미지"),
    ("2020-3", 44, "표"),
    ("2020-4", 51, "이미지+표"),
    ("2021-1", 48, "이미지+표"),
    ("2021-2", 75, "이미지"),
    ("2021-3", 43, "이미지"),
    ("2021-3", 100, "이미지"),
    ("2022-2", 100, "이미지"),
    ("2023-1", 46, "이미지+표"),
]


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


def find_pages_with_qnum(pdf, target_q):
    """해당 Q번호가 있는 페이지들을 찾는다"""
    found_pages = []
    for i, page in enumerate(pdf.pages):
        qmap = get_qnum_map(page)
        if target_q in qmap:
            found_pages.append((i + 1, page, qmap))
    return found_pages


def investigate(exam_id, q_num, media_type):
    pdf_filename = PDF_MAP[exam_id]
    pdf_path = os.path.join(PDF_DIR, pdf_filename)

    print(f"\n{'='*70}")
    print(f"[{exam_id}] Q{q_num} ({media_type} 후보)")
    print(f"파일: {pdf_filename}")
    print('='*70)

    with pdfplumber.open(pdf_path) as pdf:
        pages_found = find_pages_with_qnum(pdf, q_num)

        if not pages_found:
            print(f"  !! Q{q_num} 번호가 어떤 페이지에도 없음")
            # Q99/Q100 케이스: Q99도 확인
            if q_num == 100:
                print(f"  → Q99도 확인:")
                pages99 = find_pages_with_qnum(pdf, 99)
                for pnum, page, qmap in pages99:
                    print(f"    Q99 발견: 페이지 {pnum}, y={qmap[99]['y']:.1f}")
            return

        for pnum, page, qmap in pages_found:
            print(f"\n  페이지 {pnum}: Q{q_num} 발견 (y={qmap[q_num]['y']:.1f}, x={qmap[q_num]['x']:.1f})")
            q_y = qmap[q_num]['y']

            # 이 페이지의 모든 Q번호 목록
            all_qs = sorted(qmap.keys())
            print(f"  이 페이지의 Q번호: {all_qs}")

            # 다음 Q번호 (Q범위 파악)
            next_qs = [q for q in all_qs if q > q_num]
            next_q = next_qs[0] if next_qs else None
            if next_q:
                next_q_y = qmap[next_q]['y']
                print(f"  다음 Q: Q{next_q} (y={next_q_y:.1f})")
            else:
                next_q_y = float('inf')
                print(f"  다음 Q: 없음 (페이지 끝까지)")

            # 이미지 확인
            images = page.images
            print(f"\n  [이미지] 총 {len(images)}개:")
            if images:
                for idx, img in enumerate(images):
                    ix = float(img['x0'])
                    iy = float(img['top'])
                    iw = float(img['x1']) - ix
                    ih = float(img['bottom']) - iy
                    nearest = nearest_question_above(qmap, ix, iy)
                    in_range = (q_y - 50 <= iy <= (next_q_y + 50 if next_q else float('inf')))
                    print(f"    [{idx}] bbox=({ix:.0f},{iy:.0f},{img['x1']:.0f},{img['bottom']:.0f}) "
                          f"크기={iw:.0f}x{ih:.0f} "
                          f"nearest_q={nearest} "
                          f"{'★ Q범위 내' if in_range else '범위 밖'}")
            else:
                print("    (이미지 없음)")

            # 표 확인
            tables = page.find_tables()
            print(f"\n  [표] 총 {len(tables)}개:")
            if tables:
                for idx, tbl in enumerate(tables):
                    bbox = tbl.bbox  # (x0, top, x1, bottom)
                    tx = float(bbox[0])
                    ty = float(bbox[1])
                    nearest = nearest_question_above(qmap, tx, ty)
                    in_range = (q_y - 50 <= ty <= (next_q_y + 50 if next_q else float('inf')))
                    print(f"    [{idx}] bbox=({bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}) "
                          f"nearest_q={nearest} "
                          f"{'★ Q범위 내' if in_range else '범위 밖'}")
                    # 표 내용 샘플
                    try:
                        data = tbl.extract()
                        if data:
                            print(f"         행수={len(data)}, 열수={len(data[0]) if data else 0}")
                            # 첫 2행 출력
                            for row in data[:2]:
                                print(f"         {row}")
                    except Exception as e:
                        print(f"         (표 추출 오류: {e})")
            else:
                print("    (표 없음)")

            # Q99/Q100 특수 케이스 분석
            if q_num == 100:
                print(f"\n  [Q99/Q100 분석]")
                if 99 in qmap:
                    print(f"  Q99 y={qmap[99]['y']:.1f}, Q100 y={qmap[100]['y']:.1f}")
                    # Q99와 Q100 사이의 이미지/표
                    q99_y = qmap[99]['y']
                    q100_y = qmap[100]['y']
                    print(f"  Q99~Q100 사이 이미지:")
                    for img in images:
                        iy = float(img['top'])
                        if q99_y <= iy <= q100_y + 50:
                            nearest = nearest_question_above(qmap, float(img['x0']), iy)
                            print(f"    이미지 y={iy:.0f}, nearest={nearest}")
                else:
                    print(f"  Q99가 이 페이지에 없음")


def main():
    print("PDF 이미지/표 후보 조사 시작")
    print(f"PDF 디렉터리: {PDF_DIR}")

    for exam_id, q_num, media_type in TARGETS:
        try:
            investigate(exam_id, q_num, media_type)
        except Exception as e:
            print(f"\n[{exam_id}] Q{q_num} 처리 중 오류: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n{'='*70}")
    print("조사 완료")


if __name__ == "__main__":
    main()
