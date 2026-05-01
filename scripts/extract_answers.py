"""
PDF 마지막 페이지에서 정답표를 추출합니다.
형식: "1.③ 2.② 3.① ..." → {1: 3, 2: 2, 3: 1, ...}
"""
import re
import json
import os
import pdfplumber

CIRCLE_TO_NUM = {'①': 1, '②': 2, '③': 3, '④': 4}

DOWNLOADS = '/sessions/eager-busy-heisenberg/mnt/Downloads'
OUT_DIR = '/sessions/eager-busy-heisenberg/mnt/outputs/cbt-app/data/raw'
os.makedirs(OUT_DIR, exist_ok=True)

# (파일명, 라벨)
EXAM_FILES = [
    ('1. 2024년1회_정보처리기사필기기출문제.pdf', '2024-1'),
    ('2. 2024년2회_정보처리기사필기기출문제.pdf', '2024-2'),
    ('3. 2024년3회_정보처리기사필기기출문제.pdf', '2024-3'),
    ('2025년1회_정보처리기사필기기출문제.pdf', '2025-1'),
    ('2025년2회_정보처리기사필기기출문제.pdf', '2025-2'),
    ('2025년3회_정보처리기사 필기_기출문제.pdf', '2025-3'),
]


def extract_answers(pdf_path):
    answers = {}
    with pdfplumber.open(pdf_path) as pdf:
        # 정답은 마지막 페이지에 있음
        for page in pdf.pages[::-1]:
            text = page.extract_text() or ''
            if '정답' in text and ('①' in text or '②' in text or '③' in text or '④' in text):
                # 1차: "숫자.원숫자" 정확 매칭
                pattern = re.compile(r'(\d+)\s*\.\s*([①②③④])')
                for m in pattern.finditer(text):
                    qnum = int(m.group(1))
                    ans = CIRCLE_TO_NUM[m.group(2)]
                    if 1 <= qnum <= 100 and qnum not in answers:
                        answers[qnum] = ans

                # 2차 fallback: 정답 단어 이후의 ①②③④ 순서대로 모음 (PDF 깨진 경우)
                if len(answers) < 80:
                    answers = {}
                    # '정답' 단어 이후의 텍스트만 사용
                    idx = text.find('정답')
                    body = text[idx:] if idx >= 0 else text
                    circles = re.findall(r'[①②③④]', body)
                    if len(circles) >= 100:
                        # 처음 100개를 1~100번 정답으로 사용
                        for i, c in enumerate(circles[:100], start=1):
                            answers[i] = CIRCLE_TO_NUM[c]
                if len(answers) >= 80:
                    break
    return answers


if __name__ == '__main__':
    summary = {}
    for fname, label in EXAM_FILES:
        path = os.path.join(DOWNLOADS, fname)
        if not os.path.exists(path):
            print(f'[!] 파일 없음: {fname}')
            continue
        ans = extract_answers(path)
        summary[label] = ans
        out = os.path.join(OUT_DIR, f'answers_{label}.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(ans, f, ensure_ascii=False, indent=2)
        print(f'[OK] {label}: {len(ans)}개 정답 추출 → {out}')

    # 전체 정답 요약
    with open(os.path.join(OUT_DIR, 'all_answers.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print('\n=== 정답 추출 완료 ===')
