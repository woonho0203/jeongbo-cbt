#!/usr/bin/env python3
"""
2021~2022 이미지 세부 수정 스크립트
- Q48 2021-1: 정밀 재추출 (Q49 위치까지 크롭)
- Q17, Q62 2021-2: 개념 문제 → 이미지 삭제 표시
- Q32 2022-1: 버블정렬 텍스트 문제 확인
- Q87 2022-2: 개념 문제 → 이미지 삭제 표시
- Q61 2022-3: 개념 문제 → 이미지 삭제 표시
"""
import fitz
import os

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


def render_crop(pdf_path, page_idx, clip_rect, out_path, dpi=230):
    doc = fitz.open(pdf_path)
    page = doc[page_idx]
    pix = page.get_pixmap(
        matrix=fitz.Matrix(dpi/72, dpi/72),
        clip=fitz.Rect(*clip_rect)
    )
    pix.save(str(out_path))
    doc.close()
    return pix.width, pix.height


# 2021-1 Q48: R1/R2 테이블 포함 SQL 문제 - 정밀 재추출
# Page 3에서 Q48 y=77.5 ~ Q49 y=확인 필요
pdf_path = os.path.join(PDF_BASE, PDF_MAP['2021-1'])
doc = fitz.open(pdf_path)
page = doc[3]
import re
blocks = page.get_text('blocks')
blocks_sorted = sorted(blocks, key=lambda b: (b[1], b[0]))

q48_y0 = None
q49_y0 = None
for b in blocks_sorted:
    t = b[4].strip()
    if q48_y0 is None and re.match(r'^48[\.。]', t):
        q48_y0 = b[1]
        print(f"Q48 found at y={q48_y0:.1f}: {t[:60]}")
    if q48_y0 is not None and q49_y0 is None and re.match(r'^49[\.。]', t):
        q49_y0 = b[1]
        print(f"Q49 found at y={q49_y0:.1f}: {t[:60]}")
        break

doc.close()

if q48_y0 and q49_y0:
    # Q48은 좌열에 있음 (x≈28~272)
    clip = (28, max(0, q48_y0 - 3), 272, q49_y0 + 5)
    w, h = render_crop(pdf_path, 3, clip, os.path.join(IMG_DIR, '2021-1_q48.png'), dpi=230)
    print(f"2021-1 Q48 재추출: {w}x{h}px")

# 2021-2 Q62: C코드 문제 재추출 (stem에 코드가 있지만 이미지로 코드 포함 가능)
# PDF scan 결과로 텍스트로만 구성된 C코드 문제이므로 이미지 삭제 대상
# → 파일은 남기되 JSON에서 image 필드 제거

# 2021-3 Q43: Cartesian Product 결과 - 선택지 테이블이 이미지로 제공됨
# 현재 780x1156이면 너무 클 수 있음 - 확인
from PIL import Image
img = Image.open(os.path.join(IMG_DIR, '2021-3_q43.png'))
print(f"\n2021-3 Q43 현재 크기: {img.size[0]}x{img.size[1]}")
# Q43은 카티션 프로덕트 결과를 선택지에서 보여주는 복잡한 테이블 이미지
# → 적당한 크기이므로 유지

# 2022-1 Q32: 실제 버블정렬 관련인지 확인
# PDF scan 결과: Q32는 소프트웨어 재사용 개념 문제 (텍스트만)
# JSON Q32 stem: "버블 정렬을 이용하여 다음 자료를 오름차순으로 정렬할 경우 PASS 1의 결과는?"
# → JSON Q32는 다른 회차 문제가 섞인 것 / 버블정렬 자체가 텍스트 문제이므로 이미지 불필요
# 하지만 JSON의 stem은 유지하고 image를 그 stem에 맞는 이미지로 교체하거나 삭제

# 2022-2 Q87 재추출 결과 확인
img = Image.open(os.path.join(IMG_DIR, '2022-2_q87.png'))
print(f"\n2022-2 Q87 현재 크기: {img.size[0]}x{img.size[1]}")

print("\n완료")
