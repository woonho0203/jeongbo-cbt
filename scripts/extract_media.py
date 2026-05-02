"""
PDF에서 이미지와 표를 추출해서 exam JSON에 추가합니다.
- 이미지: public/images/{examId}_q{qnum}.png 저장 후 JSON에 image 필드 추가
- 표: HTML 문자열로 변환 후 JSON에 table 필드 추가
"""

import fitz
import pdfplumber
import json
import os
import re
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, 'data')
IMG_DIR = os.path.join(BASE, 'public', 'images')
os.makedirs(IMG_DIR, exist_ok=True)

PDF_MAP = {
    '2024-1': os.path.join(os.path.expanduser('~/Downloads'), '1. 2024년1회_정보처리기사필기기출문제.pdf'),
    '2024-2': os.path.join(os.path.expanduser('~/Downloads'), '2. 2024년2회_정보처리기사필기기출문제.pdf'),
    '2024-3': os.path.join(os.path.expanduser('~/Downloads'), '3. 2024년3회_정보처리기사필기기출문제.pdf'),
    '2025-1': os.path.join(os.path.expanduser('~/Downloads'), '2025년1회_정보처리기사필기기출문제.pdf'),
    '2025-2': os.path.join(os.path.expanduser('~/Downloads'), '2025년2회_정보처리기사필기기출문제.pdf'),
    '2025-3': os.path.join(os.path.expanduser('~/Downloads'), '2025년3회_정보처리기사 필기_기출문제.pdf'),
}


def get_repeat_sizes(doc, threshold=5):
    """전체 페이지에서 반복 등장하는 이미지 사이즈(워터마크/헤더) 파악"""
    size_count = defaultdict(int)
    for pno in range(min(len(doc) - 1, 7)):  # 정답 페이지 제외
        for img in doc[pno].get_images(full=True):
            base = doc.extract_image(img[0])
            size_count[f"{base['width']}x{base['height']}"] += 1
    return {k for k, v in size_count.items() if v >= threshold}


def get_qnum_map(page):
    """페이지에서 질문 번호와 y 위치 매핑 반환"""
    qnums = {}
    for w in page.extract_words():
        if re.match(r'^\d{1,2}\.$', w['text']):
            q = int(w['text'][:-1])
            if 1 <= q <= 100:
                qnums[q] = {'x': float(w['x0']), 'y': float(w['top'])}
    return qnums


def nearest_question_above(qnums, ix, iy, col_threshold=300):
    """이미지/표의 x, y 기준으로 위에 있는 가장 가까운 질문 번호 반환"""
    left_col = ix < col_threshold
    candidates = {
        q: v for q, v in qnums.items()
        if v['y'] <= iy + 30
        and ((left_col and v['x'] < col_threshold) or (not left_col and v['x'] >= col_threshold))
    }
    if not candidates:
        # 컬럼 구분 없이 y 위쪽 탐색
        candidates = {q: v for q, v in qnums.items() if v['y'] <= iy + 30}
    return max(candidates, key=lambda q: candidates[q]['y']) if candidates else None


def extract_question_image(doc, pno, plumber_page, img_info, exam_id, qnum):
    """pdfplumber 이미지 bbox를 pymupdf로 렌더링해서 저장"""
    out_path = os.path.join(IMG_DIR, f'{exam_id}_q{qnum}.png')
    if os.path.exists(out_path):
        return f'images/{exam_id}_q{qnum}.png'

    page = doc[pno]
    # pdfplumber bbox (x0, top, x1, bottom) → fitz rect
    x0 = img_info['x0']
    y0 = img_info['top']
    x1 = img_info['x1']
    y1 = img_info['bottom']

    # 여백 추가
    pad = 8
    rect = fitz.Rect(max(0, x0 - pad), max(0, y0 - pad),
                     min(page.rect.width, x1 + pad), min(page.rect.height, y1 + pad))

    mat = fitz.Matrix(2.5, 2.5)  # 2.5× 해상도
    clip = rect
    pix = page.get_pixmap(matrix=mat, clip=clip)
    pix.save(out_path)
    return f'images/{exam_id}_q{qnum}.png'


def table_to_html(data):
    """pdfplumber 테이블 데이터 → HTML 문자열"""
    rows = []
    for ri, row in enumerate(data):
        cells = []
        for cell in row:
            txt = (cell or '').strip()
            tag = 'th' if ri == 0 else 'td'
            cells.append(f'<{tag}>{txt}</{tag}>')
        rows.append('<tr>' + ''.join(cells) + '</tr>')
    return '<table>' + ''.join(rows) + '</table>'


def process_exam(exam_id):
    pdf_path = PDF_MAP[exam_id]
    json_path = os.path.join(DATA_DIR, f'exam_{exam_id}.json')

    with open(json_path, encoding='utf-8') as f:
        exam = json.load(f)

    # 질문 번호 → 인덱스 맵
    qmap = {q['qnum']: i for i, q in enumerate(exam['questions'])}

    doc = fitz.open(pdf_path)
    repeat_sizes = get_repeat_sizes(doc)

    img_count = 0
    table_count = 0

    with pdfplumber.open(pdf_path) as pdf:
        # 정답 페이지(마지막) 제외
        question_pages = pdf.pages[:-1]

        for pno, page in enumerate(question_pages):
            qnums = get_qnum_map(page)
            if not qnums:
                continue

            # ── 이미지 처리 ──
            for img in page.images:
                w = img['width']
                h = img['height']
                size_key = f"{round(w)}x{round(h)}"

                # 워터마크/헤더 제외
                if size_key in repeat_sizes:
                    continue
                if w < 80 or h < 40:
                    continue
                if img['top'] < 80 and w > 400:  # 최상단 헤더
                    continue

                ix = img.get('x0', img.get('doctop', 0))
                iy = img['top']

                qnum = nearest_question_above(qnums, ix, iy)
                if qnum and qnum in qmap:
                    idx = qmap[qnum]
                    if not exam['questions'][idx].get('image'):
                        img_file = extract_question_image(doc, pno, page, img, exam_id, qnum)
                        exam['questions'][idx]['image'] = img_file
                        img_count += 1
                        print(f'  [{exam_id}] Q{qnum} 이미지 → {img_file}')

            # ── 표 처리 ──
            for t in page.find_tables():
                data = t.extract()
                if not data or len(data) < 2:
                    continue
                # 과목 구분선 테이블 제외
                flat = ' '.join(str(x) for row in data for x in row if x)
                if '과목' in flat and len(data) <= 2:
                    continue
                if '제' in flat and '과목' in flat and len(data[0]) <= 3:
                    continue

                ty = t.bbox[1]
                tx = t.bbox[0]
                qnum = nearest_question_above(qnums, tx, ty)
                if qnum and qnum in qmap:
                    idx = qmap[qnum]
                    if not exam['questions'][idx].get('table'):
                        html = table_to_html(data)
                        exam['questions'][idx]['table'] = html
                        table_count += 1
                        print(f'  [{exam_id}] Q{qnum} 표 추가')

    doc.close()

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(exam, f, ensure_ascii=False, indent=2)

    print(f'[{exam_id}] 완료: 이미지 {img_count}개, 표 {table_count}개')


if __name__ == '__main__':
    for eid in ['2024-1', '2024-2', '2024-3', '2025-1', '2025-2', '2025-3']:
        print(f'\n=== {eid} 처리 중... ===')
        try:
            process_exam(eid)
        except Exception as e:
            print(f'[{eid}] 오류: {e}')
            import traceback; traceback.print_exc()
