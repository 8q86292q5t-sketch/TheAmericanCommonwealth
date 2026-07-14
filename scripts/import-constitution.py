#!/usr/bin/env python3
"""Import structured constitutional text from the source PDFs into site-data.json."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROMANS = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI",
    "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII",
    "XXIX", "XXX", "XXXI", "XXXII", "XXXIII", "XXXIV", "XXXV", "XXXVI",
    "XXXVII",
]
VALID_ARTICLES = {"PRELIMINARY", *ROMANS}
NUMBERED_RE = re.compile(r"^(\d+)\.\s*(.*)$")


def clean_space(value: str) -> str:
    value = value.replace("\u00a0", " ").strip()
    value = re.sub(r"\s+", " ", value)
    return re.sub(r"^(\d+)\.(?=[A-Za-z])", r"\1. ", value)


def join_wrapped(left: str, right: str) -> str:
    left = clean_space(left)
    right = clean_space(right)
    if not left:
        return right
    if not right:
        return left
    if left.endswith("-") and right[:1].islower():
        return left + right
    return f"{left} {right}"


def line_size(line: dict) -> float:
    sizes = [round(float(char.get("size", 0)), 1) for char in line.get("chars", [])]
    return Counter(sizes).most_common(1)[0][0] if sizes else 0


def table_cells(words: list[dict], starts: list[float]) -> list[str]:
    cells = [[] for _ in starts]
    for word in sorted(words, key=lambda item: item["x0"]):
        text = word["text"].strip()
        if not text:
            continue
        x0 = word["x0"]
        index = 0
        for candidate, start in enumerate(starts):
            if x0 >= start - 3:
                index = candidate
        cells[index].append(text)
    return [clean_space(" ".join(cell)) for cell in cells]


def header_cells(words: list[dict]) -> tuple[list[str], list[float]]:
    words = sorted(words, key=lambda item: item["x0"])
    groups = []
    current = []
    previous_x1 = None
    for word in words:
        if previous_x1 is not None and word["x0"] - previous_x1 > 70 and current:
            groups.append(current)
            current = []
        current.append(word)
        previous_x1 = word["x1"]
    if current:
        groups.append(current)
    starts = [group[0]["x0"] for group in groups]
    headers = [clean_space(" ".join(word["text"] for word in group)) for group in groups]
    return headers, starts


def add_text_block(blocks: list[dict], text: str) -> None:
    text = clean_space(text)
    if not text:
        return
    numbered = NUMBERED_RE.match(text)
    if not numbered:
        blocks.append({"type": "paragraph", "text": text})
        return

    number = int(numbered.group(1))
    item = clean_space(numbered.group(2))
    previous = blocks[-1] if blocks else None
    expected = previous["start"] + len(previous["items"]) if previous and previous["type"] == "ordered-list" else None
    if previous and previous["type"] == "ordered-list" and expected == number:
        previous["items"].append(item)
    else:
        blocks.append({"type": "ordered-list", "start": number, "items": [item]})


def parse_structural_pdf(path: Path) -> dict[str, dict]:
    parsed: dict[str, dict] = {}
    current = None
    body = ""
    body_page = None
    body_top = None
    table = None

    def flush_body() -> None:
        nonlocal body, body_page, body_top
        if current and body:
            add_text_block(current["blocks"], body)
        body = ""
        body_page = None
        body_top = None

    def flush_table() -> None:
        nonlocal table
        table = None

    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            lines = page.extract_text_lines(return_chars=True)
            words_by_top = {}
            for word in page.extract_words(extra_attrs=["size"]):
                words_by_top.setdefault(round(float(word["top"]), 1), []).append(word)
            for line in lines:
                top = float(line["top"])
                if top < 58 or top > 735:
                    continue
                text = clean_space(line["text"])
                if not text:
                    continue
                size = line_size(line)

                if text == "TABLE OF CONTENTS":
                    flush_body()
                    flush_table()
                    current = None
                    continue

                if size == 18.0 and text.startswith("ARTICLE "):
                    flush_body()
                    flush_table()
                    label = text.removeprefix("ARTICLE ")
                    key = "PRELIMINARY" if label == "PRELIMINARY DECLARATION" else label
                    if key not in VALID_ARTICLES:
                        current = None
                        continue
                    current = {"title_lines": [], "blocks": []}
                    parsed[key] = current
                    continue

                if current is None:
                    continue

                if size == 18.0:
                    flush_body()
                    flush_table()
                    if current["blocks"]:
                        current["blocks"].append({"type": "heading", "text": text.title() if text.isupper() else text})
                    else:
                        current["title_lines"].append(text)
                    continue

                if size == 12.0:
                    flush_body()
                    flush_table()
                    current["blocks"].append({"type": "heading", "text": text})
                    continue

                if size == 9.5:
                    flush_body()
                    words = words_by_top.get(round(top, 1), [])
                    headers, starts = header_cells(words)
                    previous = current["blocks"][-1] if current["blocks"] else None
                    if previous and previous.get("type") == "table" and previous.get("headers") == headers:
                        block = previous
                    else:
                        block = {"type": "table", "headers": headers, "rows": []}
                        current["blocks"].append(block)
                    table = {"block": block, "starts": starts, "last_top": None, "last_page": None}
                    continue

                if size == 9.0 and table:
                    words = words_by_top.get(round(top, 1), [])
                    cells = table_cells(words, table["starts"])
                    rows = table["block"]["rows"]
                    is_continuation = (
                        rows
                        and table["last_page"] == page_number
                        and table["last_top"] is not None
                        and top - table["last_top"] <= 15.5
                    )
                    if (cells[0] and not is_continuation) or not rows:
                        rows.append(cells)
                    else:
                        rows[-1] = [join_wrapped(old, new) for old, new in zip(rows[-1], cells)]
                    table["last_top"] = top
                    table["last_page"] = page_number
                    continue

                flush_table()
                if not 10.7 <= size <= 11.2:
                    continue

                starts_number = bool(NUMBERED_RE.match(text))
                previous_numbered = bool(NUMBERED_RE.match(body))
                page_changed = body_page is not None and body_page != page_number
                gap = top - body_top if body_top is not None and body_page == page_number else 0
                prior_complete = bool(re.search(r"[.!?;:]$", body))

                if body and (
                    starts_number
                    or (previous_numbered and prior_complete)
                    or (gap > 18.5 and prior_complete)
                    or (page_changed and prior_complete)
                ):
                    flush_body()

                body = join_wrapped(body, text)
                body_page = page_number
                body_top = top

    flush_body()
    return parsed


def clean_chat_lines(path: Path) -> list[str]:
    reader = PdfReader(path)
    lines = []
    for page_number, page in enumerate(reader.pages, 1):
        if page_number == 1:
            continue
        for raw in (page.extract_text() or "").splitlines():
            text = clean_space(raw)
            if not text:
                continue
            if re.match(r"^\d+/\d+/\d+,", text):
                continue
            if re.match(r"^Page \d+ of \d+", text):
                continue
            if text.startswith("https://chatgpt.com/") or text in {"Edit", "To d ay 6:18 PM"}:
                continue
            lines.append(text)
    return lines


def parse_chat_body(lines: list[str]) -> list[dict]:
    blocks: list[dict] = []
    paragraph = ""
    ordered_items = None
    bullet_items = None
    bullet_mode = False

    def flush_paragraph() -> None:
        nonlocal paragraph, bullet_mode
        if paragraph:
            blocks.append({"type": "paragraph", "text": clean_space(paragraph)})
            bullet_mode = paragraph.rstrip().endswith(":")
        paragraph = ""

    def finish_lists() -> None:
        nonlocal ordered_items, bullet_items
        if ordered_items:
            blocks.append({"type": "ordered-list", "start": ordered_items[0][0], "items": [item for _, item in ordered_items]})
        if bullet_items:
            blocks.append({"type": "unordered-list", "items": bullet_items})
        ordered_items = None
        bullet_items = None

    index = 0
    while index < len(lines):
        text = lines[index]
        numbered = NUMBERED_RE.match(text)

        if numbered:
            flush_paragraph()
            bullet_mode = False
            if bullet_items:
                finish_lists()
            number = int(numbered.group(1))
            item = numbered.group(2)
            index += 1
            while index < len(lines) and not NUMBERED_RE.match(lines[index]):
                if re.search(r"[.!?]$", item):
                    break
                item = join_wrapped(item, lines[index])
                index += 1
            if ordered_items is None:
                ordered_items = []
            ordered_items.append((number, clean_space(item)))
            continue

        if ordered_items:
            finish_lists()

        if bullet_mode:
            item = text
            index += 1
            while index < len(lines) and not re.search(r"[;.!?]$", item):
                if NUMBERED_RE.match(lines[index]):
                    break
                item = join_wrapped(item, lines[index])
                index += 1
            if bullet_items is None:
                bullet_items = []
            bullet_items.append(clean_space(item))
            if re.search(r"[.!?]$", item):
                finish_lists()
                bullet_mode = False
            continue

        paragraph = join_wrapped(paragraph, text)
        index += 1
        if re.search(r"[.!?:]$", paragraph):
            flush_paragraph()

    flush_paragraph()
    finish_lists()
    return blocks


def parse_chat_sanitation(path: Path) -> list[dict]:
    lines = clean_chat_lines(path)
    sections = []
    current_heading = None
    current_lines = []

    def flush_section() -> None:
        nonlocal current_heading, current_lines
        if current_heading:
            sections.append({"type": "heading", "text": current_heading})
            sections.extend(parse_chat_body(current_lines))
        current_heading = None
        current_lines = []

    for text in lines:
        if re.match(r"^Section \d+ — ", text):
            flush_section()
            current_heading = text
        elif current_heading:
            current_lines.append(text)
    flush_section()
    return sections


def normalize_housing_tables(blocks: list[dict]) -> list[dict]:
    normalized = list(blocks)

    ownership_index = next(
        index for index, block in enumerate(normalized)
        if block.get("type") == "heading" and block.get("text") == "Section 1 — Residential Ownership Limits"
    )
    ownership_text = normalized[ownership_index + 1]["text"]
    ownership_prose = ownership_text.split("Ownership includes", 1)[1]
    normalized[ownership_index + 1:ownership_index + 2] = [
        {
            "type": "table",
            "headers": ["Certified individual annual income", "Maximum residential properties"],
            "rows": [
                ["Below $500,000", "One"],
                ["$500,000 through $1,000,000", "Two"],
                ["Above $1,000,000", "Three"],
            ],
        },
        {"type": "paragraph", "text": f"Ownership includes{ownership_prose}"},
    ]

    tiers_index = next(
        index for index, block in enumerate(normalized)
        if block.get("type") == "heading" and block.get("text") == "Section 8 — Tiered Housing Values"
    )
    tier_rows = [
        ["I", "Up to 600 sq. ft."],
        ["II", "601-1,200 sq. ft."],
        ["III", "1,201-1,800 sq. ft."],
        ["IV", "1,801-2,500 sq. ft."],
        ["V", "2,501-3,500 sq. ft."],
        ["VI", "More than 3,500 sq. ft."],
    ]
    normalized[tiers_index + 1:tiers_index + 7] = [
        {"type": "table", "headers": ["Tier", "Habitable area"], "rows": tier_rows},
    ]
    return normalized


def block_text(block: dict) -> str:
    if block["type"] in {"heading", "paragraph"}:
        return block["text"]
    if block["type"] in {"ordered-list", "unordered-list"}:
        return " ".join(block["items"])
    if block["type"] == "table":
        return " ".join(block["headers"] + [cell for row in block["rows"] for cell in row])
    return ""


def first_paragraph(blocks: list[dict]) -> str:
    return next((block["text"] for block in blocks if block["type"] == "paragraph"), "")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--constitution", required=True, type=Path)
    parser.add_argument("--chat-export", required=True, type=Path)
    args = parser.parse_args()

    data = json.loads(args.data.read_text(encoding="utf-8"))
    parsed = parse_structural_pdf(args.constitution)
    existing = {article["roman"]: article for article in data["articles"]}

    articles = []
    for order, roman in enumerate(["PRELIMINARY", *ROMANS]):
        source = parsed[roman]
        if roman == "XXXV":
            source["blocks"] = parse_chat_sanitation(args.chat_export)
        elif roman == "XXX":
            source["blocks"] = normalize_housing_tables(source["blocks"])

        if roman == "XXXVII":
            article = {
                "number": "XXXVII",
                "roman": "XXXVII",
                "title": "National Identity, Flag, and the American Builder Beaver",
                "slug": "article-xxxvii",
                "order": order,
            }
        else:
            article = existing[roman]

        blocks = source["blocks"]
        article["order"] = order
        article["summary"] = first_paragraph(blocks)
        article["sections"] = [block["text"] for block in blocks if block["type"] == "heading"]
        article["excerpt"] = [block_text(block) for block in blocks[:6] if block_text(block)]
        article["textBlocks"] = blocks
        article["fullText"] = [block_text(block) for block in blocks if block_text(block)]
        articles.append(article)

    data["articles"] = articles
    identity_article = next(article for article in articles if article["roman"] == "XXXVII")
    identity = data["identity"]
    identity["source"] = "Article XXXVII"
    identity["summary"] = identity_article["summary"]
    identity["sections"] = identity_article["sections"]
    identity["excerpt"] = identity_article["excerpt"]
    identity["textBlocks"] = identity_article["textBlocks"]
    identity["fullText"] = identity_article["fullText"]
    identity["animal"] = next(
        block["text"] for block in identity_article["textBlocks"]
        if block["type"] == "paragraph" and "represents the values" in block["text"]
    )
    identity["flagMeaning"] = next(
        block["text"] for block in identity_article["textBlocks"]
        if block["type"] == "paragraph" and "deep midnight-blue field" in block["text"]
    )

    args.data.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(articles)} constitutional entries with {sum(len(article['textBlocks']) for article in articles)} structured blocks.")


if __name__ == "__main__":
    main()
