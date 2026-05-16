#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Restore question text from the source PDFs while preserving existing images,
answers, explanations, and other metadata.

Only these fields are updated:
  - stem
  - options
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from copy import deepcopy
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PDF_DIR = Path("/Users/woonho/Downloads/정보처리기사 문제")
REPORT_PATH = ROOT / "text_restore_report.txt"

EXAM_FILES = [
    ("1. 2024년1회_정보처리기사필기기출문제.pdf", "exam_2024-1.json"),
    ("2. 2024년2회_정보처리기사필기기출문제.pdf", "exam_2024-2.json"),
    ("3. 2024년3회_정보처리기사필기기출문제.pdf", "exam_2024-3.json"),
    ("2025년1회_정보처리기사필기기출문제.pdf", "exam_2025-1.json"),
    ("2025년2회_정보처리기사필기기출문제.pdf", "exam_2025-2.json"),
    ("2025년3회_정보처리기사 필기_기출문제.pdf", "exam_2025-3.json"),
]

CATEGORY_FILES = [
    ("정보처리기사필기_01_필수계산41문제.pdf", "category_calc.json"),
    ("정보처리기사필기_02_필수코드57문제.pdf", "category_code.json"),
    ("정보처리기사필기_03_잘못된문장찾기197문제.pdf", "category_wrong-sentence.json"),
    ("정보처리기사필기_04_키워드찾기259문제.pdf", "category_keyword.json"),
    ("정보처리기사필기_05_종류순서114문제.pdf", "category_sequence.json"),
]

CIRCLE_TO_INDEX = {"①": 0, "②": 1, "③": 2, "④": 3}


def nfc(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def resolve_pdf(name: str) -> Path:
    target = nfc(name)
    for path in PDF_DIR.iterdir():
        if nfc(path.name) == target:
            return path
    raise FileNotFoundError(f"PDF not found: {PDF_DIR / name}")


def normalize_text(text: str) -> str:
    text = text.replace("\u200b", "").replace("\xa0", " ")
    text = text.replace("∼", "~")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def flatten(text: str) -> str:
    return re.sub(r"\s+", " ", normalize_text(text)).strip()


def compare_key(text: str) -> str:
    text = re.sub(r"\[보기\]", "", str(text))
    return re.sub(r"\s+", "", text)


BROKEN_TERM_FIXES = (
    ("시스 템", "시스템"),
    ("데 이터", "데이터"),
    ("소프트 웨어", "소프트웨어"),
    ("프로그 램", "프로그램"),
    ("네트 워크", "네트워크"),
    ("인터 페이스", "인터페이스"),
    ("릴 레이션", "릴레이션"),
    ("트랜 잭션", "트랜잭션"),
    ("컴포 넌트", "컴포넌트"),
    ("애트 리뷰트", "애트리뷰트"),
    ("애튜 리뷰트", "애튜리뷰트"),
    ("테스 트", "테스트"),
    ("메모 리", "메모리"),
    ("서 비스", "서비스"),
    ("알고 리즘", "알고리즘"),
    ("데이터 베이스", "데이터베이스"),
)


def fix_broken_terms(text: str) -> str:
    fixed = text
    for before, after in BROKEN_TERM_FIXES:
        fixed = fixed.replace(before, after)
    fixed = re.sub(r"의 미(?=(하|한|를|는|가|로|와|과|이다|임|$))", "의미", fixed)
    return fixed


ALWAYS_SPACE_PREFIXES = (
    "것",
    "때",
    "경우",
    "중",
    "후",
    "전",
    "뒤",
    "위해",
    "위한",
    "위하여",
    "의해",
    "통해",
    "대한",
    "대해",
    "따라",
    "않",
    "아닌",
    "없는",
    "및",
    "또는",
    "그리고",
    "의미",
)


def should_transfer_space(prev_text: str, next_text: str) -> bool:
    if any(next_text.startswith(prefix) for prefix in ALWAYS_SPACE_PREFIXES):
        return True
    if next_text.startswith("수"):
        return prev_text.endswith(("할", "될", "볼", "갈", "올", "줄", "둘", "쓸", "낼", "받을", "얻을"))
    if next_text.startswith("할"):
        return prev_text.endswith(("해야", "되어야", "하고자", "가져야", "있어야"))
    if next_text.startswith(("하는", "하며", "하면", "하고", "하여")):
        return prev_text.endswith(("해야", "되어야", "도록", "고자"))
    if next_text.startswith(("있는", "없는")):
        return prev_text.endswith(("되어", "수", "할"))
    if next_text.startswith(("되는", "된다", "되어", "되고", "되며", "된")):
        return prev_text.endswith(("게", "야"))
    if next_text.startswith("한"):
        return prev_text.endswith(("으로", "대한", "위한", "기반으로"))
    if next_text.startswith("데이터"):
        return prev_text.endswith(("해도", "있어도", "없어도"))
    return False


def transfer_safe_pdf_spaces(current: str, source: str) -> str:
    """Add only conservative PDF word-boundary spaces to current text."""
    current_flat = fix_broken_terms(flatten(current))
    source_flat = fix_broken_terms(flatten(source))
    if compare_key(current_flat) != compare_key(source_flat):
        return current_flat if current_flat != flatten(current) else current

    source_space_boundaries: set[int] = set()
    source_index = 0
    current_chars = list(compare_key(current_flat))

    for idx, char in enumerate(current_chars):
        while source_index < len(source_flat) and source_flat[source_index].isspace():
            source_index += 1

        if source_index >= len(source_flat) or source_flat[source_index] != char:
            return current

        source_index += 1

        saw_space = False
        while source_index < len(source_flat) and source_flat[source_index].isspace():
            saw_space = True
            source_index += 1

        if saw_space and idx + 1 < len(current_chars):
            next_text = "".join(current_chars[idx + 1 : idx + 12])
            prev_text = "".join(current_chars[max(0, idx - 10) : idx + 1])
            if should_transfer_space(prev_text, next_text):
                source_space_boundaries.add(idx)

    result: list[str] = []
    ns_idx = -1
    chars = list(current_flat)
    for i, char in enumerate(chars):
        result.append(char)
        if char.isspace():
            continue
        ns_idx += 1
        next_char = chars[i + 1] if i + 1 < len(chars) else ""
        if ns_idx in source_space_boundaries and next_char and not next_char.isspace():
            result.append(" ")

    transferred = re.sub(r"\s+", " ", "".join(result)).strip()
    if transferred and transferred != flatten(current):
        return transferred
    return current_flat if current_flat != flatten(current) else current


def words_to_lines(words: list[dict], y_tolerance: int = 3) -> list[str]:
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines: list[str] = []
    current_top = sorted_words[0]["top"]
    current: list[dict] = []
    for word in sorted_words:
        if abs(word["top"] - current_top) <= y_tolerance:
            current.append(word)
            continue
        current.sort(key=lambda w: w["x0"])
        lines.append(" ".join(w["text"] for w in current))
        current = [word]
        current_top = word["top"]
    if current:
        current.sort(key=lambda w: w["x0"])
        lines.append(" ".join(w["text"] for w in current))
    return lines


def clean_exam_lines(lines: list[str]) -> list[str]:
    skip_keywords = [
        "저작권",
        "시나공",
        "카페",
        "회원을 대상",
        "복제하거나",
        "상업적",
        "매체에 옮겨",
        "※ 다음 문제를 읽고",
        "답란",
        "기출문제",
        "필기 기출",
        "정정답답",
        "안내",
        "용도로만",
        "기출문제 & 정답",
    ]
    cleaned: list[str] = []
    for line in lines:
        value = line.strip()
        if not value:
            continue
        if any(keyword in value for keyword in skip_keywords):
            continue
        if re.fullmatch(r"-?\s*\d+\s*-?", value):
            continue
        if re.fullmatch(r"\d+회", value):
            continue
        if re.fullmatch(r"\d{4}\s*년\s*\d+회.*", value):
            continue
        if re.fullmatch(r"\d+\s*-", value):
            continue
        cleaned.append(value)
    return cleaned


def extract_exam_lines(pdf_path: Path) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            circle_count = sum(text.count(c) for c in "①②③④")
            if circle_count > 60 and "정답" in text:
                continue

            words = page.extract_words(use_text_flow=False)
            if not words:
                continue

            mid = page.width / 2
            left = [w for w in words if (w["x0"] + w["x1"]) / 2 < mid]
            right = [w for w in words if (w["x0"] + w["x1"]) / 2 >= mid]
            lines.extend(words_to_lines(left))
            lines.extend(words_to_lines(right))
    return clean_exam_lines(lines)


def parse_exam_questions(lines: list[str]) -> dict[int, dict]:
    subject_re = re.compile(r"^제\s*[1-5]\s*과목\s*.+$")
    qstart_re = re.compile(r"^(\d{1,3})\.\s*(.*)$")
    opt_re = re.compile(r"([①②③④])\s*([^①②③④]*)")
    questions: list[dict] = []
    current: dict | None = None
    target: str | int | None = None

    def push() -> None:
        nonlocal current
        if current:
            questions.append(current)
        current = None

    for line in lines:
        if subject_re.match(line):
            push()
            target = None
            continue

        qmatch = qstart_re.match(line)
        if qmatch and 1 <= int(qmatch.group(1)) <= 100:
            push()
            current = {"qnum": int(qmatch.group(1)), "stem": qmatch.group(2), "options": ["", "", "", ""]}
            target = "stem"
            continue

        if not current:
            continue

        if any(mark in line for mark in CIRCLE_TO_INDEX):
            parts = list(opt_re.finditer(line))
            if not parts:
                continue
            prefix = line[: parts[0].start()].strip()
            if prefix:
                if target == "stem":
                    current["stem"] += "\n" + prefix
                elif isinstance(target, int):
                    current["options"][target] += "\n" + prefix
            for i, part in enumerate(parts):
                idx = CIRCLE_TO_INDEX[part.group(1)]
                end = parts[i + 1].start() if i + 1 < len(parts) else len(line)
                value = line[part.start() + 1 : end].strip()
                if current["options"][idx]:
                    current["options"][idx] += "\n" + value
                else:
                    current["options"][idx] = value
                target = idx
            continue

        if target == "stem":
            current["stem"] += "\n" + line
        elif isinstance(target, int):
            current["options"][target] += "\n" + line

    push()
    parsed: dict[int, dict] = {}
    for q in questions:
        q["stem"] = flatten(q["stem"])
        q["options"] = [flatten(option) for option in q["options"]]
        if q["stem"] and all(q["options"]):
            parsed[q["qnum"]] = q
    return parsed


def extract_category_text(pdf_path: Path) -> str:
    chunks: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def parse_category_questions(text: str) -> dict[int, dict]:
    parts = re.split(r"(?m)^\s*(\d{1,3})\.\s+", text)
    parsed: dict[int, dict] = {}
    for i in range(1, len(parts), 2):
        qnum = int(parts[i])
        body = parts[i + 1] if i + 1 < len(parts) else ""
        front = re.split(r"\[\s*해설\s*\]", body, maxsplit=1)[0]
        positions: list[tuple[int, str]] = []
        for mark in CIRCLE_TO_INDEX:
            for match in re.finditer(re.escape(mark), front):
                positions.append((match.start(), mark))
        positions.sort()
        if len(positions) < 4:
            continue

        first_four = positions[:4]
        stem = front[: first_four[0][0]]
        options = ["", "", "", ""]
        for idx, (start, mark) in enumerate(first_four):
            end = first_four[idx + 1][0] if idx + 1 < len(first_four) else len(front)
            options[CIRCLE_TO_INDEX[mark]] = front[start + 1 : end]
        cleaned = {"qnum": qnum, "stem": flatten(stem), "options": [flatten(o) for o in options]}
        if cleaned["stem"] and all(cleaned["options"]):
            parsed[qnum] = cleaned
    return parsed


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def compact(value: str, limit: int = 120) -> str:
    value = flatten(value)
    if len(value) <= limit:
        return value
    return value[:limit] + "..."


def update_file(json_name: str, extracted: dict[int, dict], dry_run: bool) -> tuple[int, int, list[str]]:
    path = DATA_DIR / json_name
    data = load_json(path)
    questions = data.get("questions", [])
    next_data = deepcopy(data)
    changed = 0
    missing = 0
    details: list[str] = []

    for idx, question in enumerate(questions):
        qnum = question.get("qnum")
        source = extracted.get(qnum)
        if not source:
            missing += 1
            continue

        next_question = deepcopy(question)
        local_changes: list[str] = []
        if source["stem"]:
            new_stem = transfer_safe_pdf_spaces(question.get("stem", ""), source["stem"])
            if new_stem != question.get("stem", ""):
                local_changes.append(f"stem: {compact(question.get('stem', ''))} -> {compact(new_stem)}")
                next_question["stem"] = new_stem

        if source["options"] and len(source["options"]) == len(question.get("options", [])):
            new_options = []
            option_changed = False
            for current_option, source_option in zip(question.get("options", []), source["options"]):
                new_option = transfer_safe_pdf_spaces(current_option, source_option)
                new_options.append(new_option)
                if new_option != current_option:
                    option_changed = True
            if option_changed:
                local_changes.append("options")
                next_question["options"] = new_options

        if local_changes:
            changed += 1
            details.append(f"{json_name} {qnum}번: " + "; ".join(local_changes))
            next_data["questions"][idx] = next_question

    if changed and not dry_run:
        save_json(path, next_data)
    return changed, missing, details


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Show changes without writing JSON files.")
    args = parser.parse_args()

    report: list[str] = ["정보처리기사 문제 문자 원문 복원 보고서", ""]
    total_changed = 0
    total_missing = 0

    for pdf_name, json_name in EXAM_FILES:
        pdf_path = resolve_pdf(pdf_name)
        extracted = parse_exam_questions(extract_exam_lines(pdf_path))
        changed, missing, details = update_file(json_name, extracted, args.dry_run)
        total_changed += changed
        total_missing += missing
        report.append(f"{json_name}: PDF 추출 {len(extracted)}문제, 수정 {changed}문제, 추출 누락 {missing}문제")
        report.extend(f"  - {line}" for line in details[:80])
        if len(details) > 80:
            report.append(f"  - 외 {len(details) - 80}건")
        report.append("")

    for pdf_name, json_name in CATEGORY_FILES:
        pdf_path = resolve_pdf(pdf_name)
        extracted = parse_category_questions(extract_category_text(pdf_path))
        changed, missing, details = update_file(json_name, extracted, args.dry_run)
        total_changed += changed
        total_missing += missing
        report.append(f"{json_name}: PDF 추출 {len(extracted)}문제, 수정 {changed}문제, 추출 누락 {missing}문제")
        report.extend(f"  - {line}" for line in details[:80])
        if len(details) > 80:
            report.append(f"  - 외 {len(details) - 80}건")
        report.append("")

    report.append(f"전체 수정 문제 수: {total_changed}")
    report.append(f"전체 추출 누락 문제 수: {total_missing}")
    if args.dry_run:
        report.append("실행 모드: dry-run, 파일은 수정하지 않음")

    REPORT_PATH.write_text("\n".join(report).rstrip() + "\n", encoding="utf-8")
    print("\n".join(report[-4:]))
    print(f"Report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
