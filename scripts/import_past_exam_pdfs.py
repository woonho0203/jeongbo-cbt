import json
import os
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PDF_DIR = Path("/Users/woonho/Downloads/정보처리기사 문제")
REPORT_PATH = ROOT / "past_exam_import_report.txt"

CIRCLE_TO_NUM = {"①": 1, "②": 2, "③": 3, "④": 4}
SUBJECT_NAMES = {
    1: "소프트웨어 설계",
    2: "소프트웨어 개발",
    3: "데이터베이스 구축",
    4: "프로그래밍 언어 활용",
    5: "정보시스템 구축 관리",
}

EXAMS = [
    ("2016년1회_정보처리기사_필기_기출문제.pdf", "2016-1", "2016년 1회"),
    ("2016년2회_정보처리기사_필기_기출문제.pdf", "2016-2", "2016년 2회"),
    ("2016년3회_정보처리기사_필기_기출문제.pdf", "2016-3", "2016년 3회"),
    ("2017년1회_정보처리기사필기기출문제.pdf", "2017-1", "2017년 1회"),
    ("2017년2회_정보처리기사필기기출문제.pdf", "2017-2", "2017년 2회"),
    ("2017년3회_정보처리기사필기기출문제.pdf", "2017-3", "2017년 3회"),
    ("2018년1회_기사필기_기출문제.pdf", "2018-1", "2018년 1회"),
    ("2018년2회_기사필기_기출문제.pdf", "2018-2", "2018년 2회"),
    ("2018년3회_기사필기_기출문제.pdf", "2018-3", "2018년 3회"),
    ("2019년1회_기사필기_기출문제.pdf", "2019-1", "2019년 1회"),
    ("2019년2회_기사필기_기출문제.pdf", "2019-2", "2019년 2회"),
    ("2020년 1, 2회_정보처리기사 필기 기출문제.pdf", "2020-1-2", "2020년 1, 2회"),
    ("2020년 3회_정보처리기사 필기 기출문제.pdf", "2020-3", "2020년 3회"),
    ("2020년 4회_정보처리기사 필기 기출문제.pdf", "2020-4", "2020년 4회"),
    ("2021년 1회_정보처리기사 필기 기출문제.pdf", "2021-1", "2021년 1회"),
    ("2021년 2회_정보처리기사 필기 기출문제.pdf", "2021-2", "2021년 2회"),
    ("2021년 3회_정보처리기사 필기 기출문제.pdf", "2021-3", "2021년 3회"),
    ("2022년1회_기사필기 기출문제.pdf", "2022-1", "2022년 1회"),
    ("2022년2회_기사필기 기출문제.pdf", "2022-2", "2022년 2회"),
    ("2022년3회_기사필기 기출문제.pdf", "2022-3", "2022년 3회"),
    ("2023년1회_정보처리기사필기기출문제.pdf", "2023-1", "2023년 1회"),
    ("2023년2회_정보처리기사필기기출문제.pdf", "2023-2", "2023년 2회"),
    ("2023년3회_정보처리기사필기기출문제.pdf", "2023-3", "2023년 3회"),
]


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def words_to_lines(words, y_tolerance=3):
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines = []
    current_top = sorted_words[0]["top"]
    current = []
    for word in sorted_words:
        if abs(word["top"] - current_top) <= y_tolerance:
            current.append(word)
        else:
            current.sort(key=lambda w: w["x0"])
            lines.append(" ".join(w["text"] for w in current))
            current = [word]
            current_top = word["top"]
    if current:
        current.sort(key=lambda w: w["x0"])
        lines.append(" ".join(w["text"] for w in current))
    return lines


def extract_two_column_lines(pdf_path: Path):
    lines = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if "정답" in text and len(re.findall(r"\d+\s*\.\s*[①②③④]", text)) >= 20:
                continue
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
            if not words:
                continue
            mid = page.width / 2
            left = [w for w in words if (w["x0"] + w["x1"]) / 2 < mid]
            right = [w for w in words if (w["x0"] + w["x1"]) / 2 >= mid]
            lines.extend(words_to_lines(left))
            lines.extend(words_to_lines(right))
    return clean_lines(lines)


def clean_lines(lines):
    skip = [
        "저작권 안내",
        "시나공 카페",
        "개인적인 용도로만",
        "허락 없이",
        "상업적 용도",
        "답란",
        "표기하시오",
        "기출문제 & 정답",
        "정답 및 해설",
    ]
    cleaned = []
    for line in lines:
        line = compact(line)
        if not line:
            continue
        if any(word in line for word in skip):
            continue
        if re.fullmatch(r"-?\s*\d+\s*-?", line):
            continue
        if re.fullmatch(r"\d+\s*회", line):
            continue
        cleaned.append(line)
    return cleaned


def extract_answers(pdf_path: Path):
    answers = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in reversed(pdf.pages):
            text = page.extract_text() or ""
            if not text:
                continue
            pairs = re.findall(r"(\d{1,3})\s*\.\s*([①②③④])", text)
            for qnum, circle in pairs:
                qnum = int(qnum)
                if 1 <= qnum <= 100 and qnum not in answers:
                    answers[qnum] = CIRCLE_TO_NUM[circle]
            if len(answers) >= 80:
                break
    return answers


def parse_questions(lines):
    qstart_re = re.compile(r"^(\d{1,3})\.\s*(.*)$")
    option_re = re.compile(r"([①②③④])\s*")
    questions = []
    current = None
    target = "stem"

    def push():
        nonlocal current
        if not current:
            return
        current["stem"] = compact(current["stem"])
        current["options"] = [compact(o) for o in current["options"]]
        questions.append(current)
        current = None

    for line in lines:
        if re.match(r"^제\s*\d?\s*과목", line):
            continue

        match = qstart_re.match(line)
        if match and 1 <= int(match.group(1)) <= 100:
            push()
            current = {
                "qnum": int(match.group(1)),
                "stem": match.group(2).strip(),
                "options": ["", "", "", ""],
            }
            target = "stem"
            continue

        if current is None:
            continue

        option_starts = list(option_re.finditer(line))
        if option_starts:
            prefix = line[: option_starts[0].start()].strip()
            if prefix:
                if target == "stem":
                    current["stem"] += " " + prefix
                elif isinstance(target, int):
                    current["options"][target - 1] += " " + prefix

            for pos, opt in enumerate(option_starts):
                idx = "①②③④".index(opt.group(1)) + 1
                start = opt.end()
                end = option_starts[pos + 1].start() if pos + 1 < len(option_starts) else len(line)
                current["options"][idx - 1] += " " + line[start:end].strip()
                target = idx
            continue

        if target == "stem":
            current["stem"] += " " + line
        elif isinstance(target, int):
            current["options"][target - 1] += " " + line

    push()

    deduped = []
    seen = set()
    for q in questions:
        if q["qnum"] in seen:
            continue
        seen.add(q["qnum"])
        deduped.append(q)
    return sorted(deduped, key=lambda q: q["qnum"])


def assign_subject(qnum: int, exam_id: str):
    year = int(exam_id.split("-")[0])
    if year >= 2020:
        return min(5, ((qnum - 1) // 20) + 1)

    # 2016~2019 구 필기 과목을 현재 앱 과목 축으로 최대한 대응한다.
    old_block = min(5, ((qnum - 1) // 20) + 1)
    return {1: 3, 2: 5, 3: 4, 4: 1, 5: 5}.get(old_block, 1)


def is_negative(stem: str):
    return bool(re.search(r"틀린|옳지 않은|아닌|거리가 먼|맞지 않은|해당하지 않는|없는 것은", stem or ""))


def build_explanation(q):
    answer = int(q.get("answer") or 0)
    answer_text = q["options"][answer - 1] if 1 <= answer <= len(q["options"]) else ""
    negative = is_negative(q["stem"])
    core = f"{answer_text}를 문제 조건과 비교하는 문제"
    if negative:
        core = f"{answer_text}가 문제에서 요구한 틀린 설명이다"

    blocks = [
        "✅ 정답",
        "",
        f"정답 이유 한 줄 요약: {core}.",
        f"정답: {answer}번 {answer_text}",
        "",
        "🔔 한 줄 요약",
        "",
        core,
        "",
        "📖 문제 해석",
        "",
        "문제 문장에서 묻는 조건을 찾는다.",
        "그 조건과 가장 맞는 보기를 고른다.",
        "",
        "🧠 사고 과정",
        "",
        "1단계: 문제의 핵심 단어를 표시한다.",
        "2단계: 각 보기가 그 조건에 맞는지 비교한다.",
        f"3단계: 남는 보기 {answer}번을 정답으로 고른다.",
        f"왜냐하면 {core}이기 때문이다.",
        "",
        "🟦 보기 제거",
        "",
    ]

    for index, option in enumerate(q["options"], start=1):
        if index == answer:
            if negative:
                blocks.append(f"정답 보기: {option}")
                blocks.append("왜 정답: 문제에서 틀린 설명을 고르라고 했고, 이 보기가 그 조건에 해당한다.")
            else:
                blocks.append(f"정답 보기: {option}")
                blocks.append("왜 정답: 문제에서 묻는 핵심 조건과 이 보기가 일치한다.")
        else:
            blocks.append(f"오답 보기: {option}")
            if negative:
                blocks.append("왜 오답: 이 보기는 틀린 설명이 아니라 올바른 설명 쪽에 가까워서 문제의 답이 아니다.")
            else:
                blocks.append("왜 오답: 정답 기준과 다른 개념이거나 문제 조건을 만족하지 않는다.")
        blocks.append(f"판단 근거: 정답 기준은 {answer_text}이다.")

    blocks.extend(
        [
            "",
            "⚠️ 함정 포인트",
            "",
            "문제에서 맞는 것을 묻는지 틀린 것을 묻는지 먼저 확인한다.",
            "",
            "📝 시험 암기법",
            "",
            "정답 보기의 핵심 단어를 문제 조건과 한 쌍으로 외운다.",
        ]
    )
    return "\n".join(blocks).strip()


def import_exam(filename, exam_id, title):
    pdf_path = PDF_DIR / filename
    lines = extract_two_column_lines(pdf_path)
    answers = extract_answers(pdf_path)
    questions = parse_questions(lines)

    imported = []
    for q in questions:
        if q["qnum"] not in answers:
            continue
        if not all(q["options"]):
            continue
        subject = assign_subject(q["qnum"], exam_id)
        q["subject"] = subject
        q["subjectName"] = SUBJECT_NAMES[subject]
        q["answer"] = answers[q["qnum"]]
        q["explanation"] = build_explanation(q)
        imported.append(q)

    output = {"examId": exam_id, "title": title, "questions": imported}
    (DATA_DIR / f"exam_{exam_id}.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "examId": exam_id,
        "title": title,
        "questions": len(questions),
        "answers": len(answers),
        "complete": len(imported),
        "missingOptions": [q["qnum"] for q in questions if not all(q["options"])][:20],
        "missingAnswers": [q["qnum"] for q in questions if q["qnum"] not in answers][:20],
    }


def update_index():
    exams = []
    for path in sorted(DATA_DIR.glob("exam_*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        exams.append(
            {
                "examId": data["examId"],
                "title": data["title"],
                "count": len(data.get("questions", [])),
            }
        )
    exams.sort(key=lambda row: row["examId"])
    (DATA_DIR / "exams_index.json").write_text(
        json.dumps(exams, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main():
    report = ["기출 PDF 등록 보고서", ""]
    summaries = []
    for filename, exam_id, title in EXAMS:
        summary = import_exam(filename, exam_id, title)
        summaries.append(summary)
        report.append(
            f"{exam_id} {title}: 문제추출 {summary['questions']} / 정답 {summary['answers']} / 등록 {summary['complete']}"
        )
        if summary["missingOptions"]:
            report.append(f"  보기 누락 예: {summary['missingOptions']}")
        if summary["missingAnswers"]:
            report.append(f"  정답 누락 예: {summary['missingAnswers']}")
    update_index()
    total = sum(row["complete"] for row in summaries)
    report.append("")
    report.append(f"총 등록 문항: {total}")
    REPORT_PATH.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main()
