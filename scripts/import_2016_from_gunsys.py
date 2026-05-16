import html
import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from import_past_exam_pdfs import (
    DATA_DIR,
    SUBJECT_NAMES,
    assign_subject,
    build_explanation,
    update_index,
)


GUNSYS = "https://www.gunsys.com/q/qpass_takeExam.php?examUid={exam_uid}"
TARGETS = [
    ("2016-1", "2016년 1회", 2061),
    ("2016-2", "2016년 2회", 2098),
    ("2016-3", "2016년 3회", 2268),
    ("2018-1", "2018년 1회", 2781),
    ("2022-1", "2022년 1회", 4634),
]
REPORT_PATH = Path(__file__).resolve().parents[1] / "gunsys_2016_import_report.txt"


def clean_text(node):
    for tag in node.select(".rightRate, script, style"):
        tag.decompose()
    text = node.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def parse_exam(exam_id, title, exam_uid):
    response = requests.get(GUNSYS.format(exam_uid=exam_uid), timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    answers = {}
    for tag in soup.select("input[id^=ans_real]"):
        match = re.match(r"ans_real(\d+)$", tag.get("id", ""))
        value = (tag.get("value") or "").strip()
        if match and value:
            answers[int(match.group(1))] = int(value[0])

    questions = []
    for count_cell in soup.select("td.count_qpass"):
        number_text = count_cell.get_text(" ", strip=True)
        match = re.match(r"(\d{1,3})\.", number_text)
        if not match:
            continue
        qnum = int(match.group(1))
        table = count_cell.find_parent("table")
        if not table:
            continue
        stem_cell = table.select_one("td.question01_qpass")
        option_cells = table.select("td.question02_qpass")
        if not stem_cell or len(option_cells) < 4 or qnum not in answers:
            continue

        stem = clean_text(stem_cell)
        options = [re.sub(r"^[①②③④]\s*", "", clean_text(cell)).strip() for cell in option_cells[:4]]
        image = None
        if not all(options) and exam_id == "2016-1" and qnum == 91:
            options = ["①", "②", "③", "④"]
            image = "images/2016-1_q91.png"

        if not stem or not all(options):
            continue

        subject = assign_subject(qnum, exam_id)
        q = {
            "qnum": qnum,
            "subject": subject,
            "stem": stem,
            "options": options,
            "subjectName": SUBJECT_NAMES[subject],
            "answer": answers[qnum],
        }
        if image:
            q["image"] = image
        q["explanation"] = build_explanation(q)
        questions.append(q)

    questions.sort(key=lambda q: q["qnum"])
    output = {"examId": exam_id, "title": title, "questions": questions}
    (DATA_DIR / f"exam_{exam_id}.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {"examId": exam_id, "title": title, "count": len(questions), "answers": len(answers)}


def main():
    report = ["이미지형 PDF 보정 등록 보고서", ""]
    for exam_id, title, exam_uid in TARGETS:
        row = parse_exam(exam_id, title, exam_uid)
        report.append(f"{exam_id} {title}: 정답 {row['answers']} / 등록 {row['count']}")
    update_index()
    REPORT_PATH.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main()
