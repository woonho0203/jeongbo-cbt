#!/usr/bin/env python3
"""
2021~2022 기출 이미지 재추출 스크립트
- 전페이지 스캔(580x574, 609x609, 1489xXXX) → 문제 영역만 크롭
- 저해상도(400px 미만) → 230DPI 재추출
- 개념 문제의 잘못 삽입된 이미지 → 삭제 판정
"""
import fitz
import os
import re

PDF_BASE = "/Users/woonho/Downloads/정보처리기사 문제/"
PDF_MAP = {
    '2021-1': '2021년 1회_정보처리기사 필기 기출문제.pdf',
    '2021-2': '2021년 2회_정보처리기사 필기 기출문제.pdf',
    '2021-3': '2021년 3회_정보처리기사 필기 기출문제.pdf',
    '2022-1': '2022년1회_기사필기 기출문제.pdf',
    '2022-2': '2022년2회_기사필기 기출문제.pdf',
    '2022-3': '2022년3회_기사필기 기출문제.pdf',
}

IMG_DIR = "/Users/woonho/Downloads/정보처리기사_CBT/public/images"

# 2열 PDF 레이아웃
LEFT_COL = (28, 272)   # x0, x1
RIGHT_COL = (308, 556) # x0, x1
PAGE_W = 595            # A4 width in points


def render_crop(pdf_path, page_idx, clip_rect, out_path, dpi=230):
    """clip_rect: (x0, y0, x1, y1) in PDF points"""
    doc = fitz.open(pdf_path)
    page = doc[page_idx]
    pix = page.get_pixmap(
        matrix=fitz.Matrix(dpi/72, dpi/72),
        clip=fitz.Rect(*clip_rect)
    )
    pix.save(str(out_path))
    doc.close()
    return pix.width, pix.height


def find_question_blocks(pdf_path, qnum, next_qnum=None):
    """Find y-coordinates of question qnum in PDF"""
    doc = fitz.open(pdf_path)
    for pg_idx in range(len(doc) - 1):  # exclude answer page
        page = doc[pg_idx]
        blocks = page.get_text("blocks")
        # Sort by y then x
        blocks = sorted(blocks, key=lambda b: (b[1], b[0]))
        for i, b in enumerate(blocks):
            text = b[4].strip()
            # Match question number at start of block
            if re.match(rf'^{qnum}\b', text) or re.search(rf'(?:^|\n)\s*{qnum}\.', text):
                q_y0 = b[1]
                page_h = page.rect.height
                x0_block = b[0]
                # Determine column
                if x0_block < 290:
                    col_x0, col_x1 = LEFT_COL
                else:
                    col_x0, col_x1 = RIGHT_COL

                # Find next question end
                next_y = page_h
                if next_qnum:
                    for j, nb in enumerate(blocks):
                        nt = nb[4].strip()
                        if re.match(rf'^{next_qnum}\b', nt) or re.search(rf'(?:^|\n)\s*{next_qnum}\.', nt):
                            # Same column check
                            if abs(nb[0] - x0_block) < 200:
                                next_y = nb[1]
                                break
                    # If same page but no next found in same col, check if next Q is on next column
                    if next_y == page_h:
                        for j, nb in enumerate(blocks):
                            nt = nb[4].strip()
                            if re.match(rf'^{next_qnum}\b', nt) or re.search(rf'(?:^|\n)\s*{next_qnum}\.', nt):
                                next_y = page_h  # end of page for this question
                                break

                doc.close()
                return pg_idx, q_y0, next_y, col_x0, col_x1
    doc.close()
    return None, None, None, None, None


def get_page_full_text(pdf_path, pg_idx):
    """Get full text of a page for debugging"""
    doc = fitz.open(pdf_path)
    page = doc[pg_idx]
    text = page.get_text()
    doc.close()
    return text


def extract_question_image(exam_id, qnum, next_qnum, out_name, margin_top=5, margin_bottom=15, dpi=230):
    """Extract image for a specific question"""
    pdf_path = os.path.join(PDF_BASE, PDF_MAP[exam_id])
    out_path = os.path.join(IMG_DIR, out_name)

    pg_idx, q_y0, next_y, col_x0, col_x1 = find_question_blocks(pdf_path, qnum, next_qnum)
    if pg_idx is None:
        print(f"  ERROR: Q{qnum} not found in {exam_id}")
        return None

    # Add margins
    y0 = max(0, q_y0 - margin_top)
    y1 = min(next_y + margin_bottom, 841)  # A4 height

    clip = (col_x0, y0, col_x1, y1)
    w, h = render_crop(pdf_path, pg_idx, clip, out_path, dpi=dpi)
    print(f"  [OK] {exam_id} Q{qnum}: page={pg_idx}, y={y0:.1f}~{y1:.1f}, col={col_x0}~{col_x1} -> {w}x{h}px -> {out_name}")
    return (w, h)


def scan_pdf_for_question(exam_id, qnum):
    """Scan all pages for a question and print surrounding text"""
    pdf_path = os.path.join(PDF_BASE, PDF_MAP[exam_id])
    doc = fitz.open(pdf_path)
    print(f"\n=== {exam_id} Q{qnum} PDF scan ===")
    for pg_idx in range(min(len(doc), 20)):
        page = doc[pg_idx]
        text = page.get_text()
        # Search for question number
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if re.match(rf'^\s*{qnum}[\.。]', line.strip()):
                context = '\n'.join(lines[max(0,i-1):i+8])
                print(f"  Page {pg_idx}: ...{context[:300]}...")
                break
    doc.close()


if __name__ == "__main__":
    results = []

    print("=" * 60)
    print("2021~2022 이미지 재추출 작업 시작")
    print("=" * 60)

    # ===========================
    # exam_2021-1
    # ===========================
    print("\n[2021-1]")

    # Q12: 430x294 - 충분한 크기, 하지만 재추출로 품질 개선
    print("\nQ12 (fan-in/fan-out 다이어그램, 430x294 재추출):")
    r = extract_question_image('2021-1', 12, 13, '2021-1_q12.png', margin_top=2, margin_bottom=5)
    results.append(('2021-1', 'Q12', 'image', r))

    # Q37: 355x327 저해상도 트리
    print("\nQ37 (트리 Preorder, 355x327 저해상도 재추출):")
    r = extract_question_image('2021-1', 37, 38, '2021-1_q37.png', margin_top=2, margin_bottom=5)
    results.append(('2021-1', 'Q37', 'image', r))

    # Q48: 1489x1297 전페이지 스캔 - SQL 문제 (텍스트만, 이미지 삭제 검토)
    print("\nQ48 (SQL 문제 stem 확인 - 이미지 삭제 후보):")
    scan_pdf_for_question('2021-1', 48)
    # stem에 이미 SQL 텍스트가 있음, image는 R1/R2 테이블일 가능성
    r = extract_question_image('2021-1', 48, 49, '2021-1_q48.png', margin_top=2, margin_bottom=5)
    results.append(('2021-1', 'Q48', 'image', r))

    # Q87: 513x224 LAN 토폴로지 다이어그램
    print("\nQ87 (LAN 토폴로지, 513x224 재추출):")
    r = extract_question_image('2021-1', 87, 88, '2021-1_q87.png', margin_top=2, margin_bottom=5)
    results.append(('2021-1', 'Q87', 'image', r))

    # ===========================
    # exam_2021-2
    # ===========================
    print("\n[2021-2]")

    # Q17: 580x574 전페이지 스캔 - 개념 설명 문제
    print("\nQ17 (개념 설명 문제, 580x574 전페이지 스캔 - 이미지 삭제 검토):")
    scan_pdf_for_question('2021-2', 17)

    # Q62: 580x574 전페이지 스캔 - C코드 문제
    print("\nQ62 (C언어 코드 문제, 580x574 전페이지 스캔 - 코드만 있으면 삭제):")
    scan_pdf_for_question('2021-2', 62)

    # Q82: 658x444 방화벽 구조 다이어그램
    print("\nQ82 (방화벽 구조, 658x444 재추출):")
    r = extract_question_image('2021-2', 82, 83, '2021-2_q82.png', margin_top=2, margin_bottom=5)
    results.append(('2021-2', 'Q82', 'image', r))

    # ===========================
    # exam_2021-3
    # ===========================
    print("\n[2021-3]")

    # Q23: 300x320 저해상도 그래프
    print("\nQ23 (DFS 그래프, 300x320 저해상도 재추출):")
    r = extract_question_image('2021-3', 23, 24, '2021-3_q23.png', margin_top=2, margin_bottom=5)
    results.append(('2021-3', 'Q23', 'image', r))

    # Q28: 596x465 사용자 매뉴얼 작성 절차 플로우
    print("\nQ28 (매뉴얼 작성절차 다이어그램, 596x465 재추출):")
    r = extract_question_image('2021-3', 28, 29, '2021-3_q28.png', margin_top=2, margin_bottom=5)
    results.append(('2021-3', 'Q28', 'image', r))

    # Q38: 317x220 저해상도 트리
    print("\nQ38 (트리 중위순회, 317x220 저해상도 재추출):")
    r = extract_question_image('2021-3', 38, 39, '2021-3_q38.png', margin_top=2, margin_bottom=5)
    results.append(('2021-3', 'Q38', 'image', r))

    # Q43: 1489x932 전페이지 스캔 - Cartesian Product 결과
    print("\nQ43 (Cartesian Product, 1489x932 전페이지 스캔 - 릴레이션 테이블):")
    scan_pdf_for_question('2021-3', 43)
    r = extract_question_image('2021-3', 43, 44, '2021-3_q43.png', margin_top=2, margin_bottom=5)
    results.append(('2021-3', 'Q43', 'image', r))

    # Q71: 580x574 전페이지 스캔 - C코드 문제
    print("\nQ71 (C언어 코드, 580x574 전페이지 스캔):")
    scan_pdf_for_question('2021-3', 71)
    r = extract_question_image('2021-3', 71, 72, '2021-3_q71.png', margin_top=2, margin_bottom=5)
    results.append(('2021-3', 'Q71', 'image', r))

    # ===========================
    # exam_2022-1
    # ===========================
    print("\n[2022-1]")

    # Q32: 609x609 전페이지 스캔 - 버블정렬 과정
    print("\nQ32 (버블정렬, 609x609 전페이지 스캔 - 텍스트만이면 삭제):")
    scan_pdf_for_question('2022-1', 32)
    r = extract_question_image('2022-1', 32, 33, '2022-1_q32.png', margin_top=2, margin_bottom=5)
    results.append(('2022-1', 'Q32', 'image', r))

    # Q62: 609x609 전페이지 스캔 - C코드 문제
    print("\nQ62 (C언어 코드, 609x609 전페이지 스캔):")
    scan_pdf_for_question('2022-1', 62)
    r = extract_question_image('2022-1', 62, 63, '2022-1_q62.png', margin_top=2, margin_bottom=5)
    results.append(('2022-1', 'Q62', 'image', r))

    # ===========================
    # exam_2022-2
    # ===========================
    print("\n[2022-2]")

    # Q33: 595x178 인스펙션 과정 플로우
    print("\nQ33 (인스펙션 과정, 595x178 재추출):")
    r = extract_question_image('2022-2', 33, 34, '2022-2_q33.png', margin_top=2, margin_bottom=5)
    results.append(('2022-2', 'Q33', 'image', r))

    # Q37: 292x271 저해상도 트리
    print("\nQ37 (트리 후위순회, 292x271 저해상도 재추출):")
    r = extract_question_image('2022-2', 37, 38, '2022-2_q37.png', margin_top=2, margin_bottom=5)
    results.append(('2022-2', 'Q37', 'image', r))

    # Q87: 609x609 전페이지 스캔 - 네트워크 개념 설명
    print("\nQ87 (Mesh 네트워크 개념, 609x609 전페이지 스캔 - 텍스트 설명이면 삭제):")
    scan_pdf_for_question('2022-2', 87)
    r = extract_question_image('2022-2', 87, 88, '2022-2_q87.png', margin_top=2, margin_bottom=5)
    results.append(('2022-2', 'Q87', 'image', r))

    # ===========================
    # exam_2022-3
    # ===========================
    print("\n[2022-3]")

    # Q17: 609x609 전페이지 스캔 - fan-in/fan-out 다이어그램
    print("\nQ17 (fan-in/fan-out 다이어그램, 609x609 전페이지 스캔):")
    r = extract_question_image('2022-3', 17, 18, '2022-3_q17.png', margin_top=2, margin_bottom=5)
    results.append(('2022-3', 'Q17', 'image', r))

    # Q24: 289x212 저해상도 트리
    print("\nQ24 (트리 후위순회, 289x212 저해상도 재추출):")
    r = extract_question_image('2022-3', 24, 25, '2022-3_q24.png', margin_top=2, margin_bottom=5)
    results.append(('2022-3', 'Q24', 'image', r))

    # Q42: 312x332 트랜잭션 상태 다이어그램
    print("\nQ42 (트랜잭션 상태, 312x332 재추출):")
    r = extract_question_image('2022-3', 42, 43, '2022-3_q42.png', margin_top=2, margin_bottom=5)
    results.append(('2022-3', 'Q42', 'image', r))

    # Q61: 609x609 전페이지 스캔 - OSI 계층 개념
    print("\nQ61 (OSI 계층 개념, 609x609 전페이지 스캔 - 텍스트 설명이면 삭제):")
    scan_pdf_for_question('2022-3', 61)
    r = extract_question_image('2022-3', 61, 62, '2022-3_q61.png', margin_top=2, margin_bottom=5)
    results.append(('2022-3', 'Q61', 'image', r))

    print("\n\n=== 추출 결과 요약 ===")
    for exam_id, qnum, type_, size in results:
        if size:
            print(f"  {exam_id} {qnum} ({type_}): {size[0]}x{size[1]}px")
        else:
            print(f"  {exam_id} {qnum} ({type_}): FAILED")
