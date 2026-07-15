#!/usr/bin/env python3
"""Import the canonical DOCX into the website's structured content model."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path

from docx import Document
from docx.document import Document as DocumentType
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph


ARTICLE_RE = re.compile(r"^ARTICLE\s+([IVXLCDM]+)\s+(.+)$", re.IGNORECASE)
SCHEDULE_RE = re.compile(r"^SCHEDULE\s+([A-Z])\s+(.+)$", re.IGNORECASE)
SECTION_RE = re.compile(r"^(Section(?:\s+\d+)?)\s*[—-]\s*(.+)$", re.IGNORECASE)
GENERIC_WORDS = {
    "and", "the", "of", "for", "national", "public", "community", "state",
    "commonwealth", "office", "authority", "agency", "system", "service",
}
SOURCE_OVERRIDES = {
    "National Challenge System": ["article-xiii"],
    "National Transportation Authority": ["article-xxxvii"],
    "National Education Authority": ["article-xxxi"],
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def slugify(value: str) -> str:
    value = value.lower().encode("ascii", "ignore").decode("ascii")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", value)) or "entry"


def title_case_heading(value: str) -> str:
    if not value.isupper():
        return value
    small = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to"}
    words = value.lower().split()
    return " ".join(word if index and word in small else word[:1].upper() + word[1:] for index, word in enumerate(words))


def iter_blocks(parent: DocumentType | _Cell):
    element = parent.element.body if isinstance(parent, DocumentType) else parent._tc
    for child in element.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def table_block(table: Table) -> dict:
    matrix = [[clean(cell.text) for cell in row.cells] for row in table.rows]
    return {
        "type": "table",
        "headers": matrix[0] if matrix else [],
        "rows": matrix[1:] if len(matrix) > 1 else [],
    }


def heading_block(text: str) -> dict:
    text = clean(text)
    match = SECTION_RE.match(text)
    if match:
        return {"type": "heading", "label": clean(match.group(1)).title(), "text": clean(match.group(2))}
    return {"type": "heading", "label": "", "text": title_case_heading(text)}


def append_paragraph(blocks: list[dict], paragraph: Paragraph) -> None:
    text = clean(paragraph.text)
    if not text:
        return
    if paragraph.style.name == "Canonical Section Heading":
        blocks.append(heading_block(text))
        return
    if paragraph.style.name == "Canonical Bullet":
        item = clean(text.lstrip("•\u2022 "))
        if blocks and blocks[-1].get("type") == "unordered-list":
            blocks[-1]["items"].append(item)
        else:
            blocks.append({"type": "unordered-list", "items": [item]})
        return
    if paragraph.style.name not in {"Table Spacer", "Figure Caption"}:
        blocks.append({"type": "paragraph", "text": text})


def entry_type(name: str) -> str:
    lowered = name.lower()
    if "authority" in lowered:
        return "authority"
    if "agency" in lowered:
        return "agency"
    if "office" in lowered:
        return "office"
    if "court" in lowered:
        return "court"
    if any(word in lowered for word in ("program", "campaign", "dividend")):
        return "program"
    if any(word in lowered for word in (
        "system", "network", "database", "registry", "repository", "ledger",
        "dashboard", "exchange", "data node",
    )):
        return "national-system"
    return "institution"


def searchable_text(article: dict) -> str:
    parts = [article["title"]]
    for block in article["blocks"]:
        parts.extend(block.get("items", []))
        parts.append(block.get("text", ""))
        parts.extend(block.get("headers", []))
        for row in block.get("rows", []):
            parts.extend(row)
    return clean(" ".join(parts)).casefold()


def find_sources(name: str, articles: list[dict]) -> list[str]:
    if name in SOURCE_OVERRIDES:
        return SOURCE_OVERRIDES[name]
    texts = {article["slug"]: searchable_text(article) for article in articles}
    base = clean(re.sub(r"\s*\([^)]*\)\s*", " ", name)).casefold()
    exact = [slug for slug, text in texts.items() if base in text]
    if exact:
        return exact

    tokens = [token for token in re.findall(r"[a-z0-9]+", base) if len(token) > 3 and token not in GENERIC_WORDS]
    scored = []
    for article in articles:
        text = texts[article["slug"]]
        score = sum(token in text for token in tokens)
        if tokens and score >= max(2, len(tokens) - 1):
            scored.append((score, article["order"], article["slug"]))
    return [item[2] for item in sorted(scored, key=lambda item: (-item[0], item[1]))[:3]]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--flag-output", type=Path)
    args = parser.parse_args()

    document = Document(args.docx)
    ordered = list(iter_blocks(document))

    toc_table = document.tables[2]
    toc = {clean(row.cells[0].text): clean(row.cells[1].text) for row in toc_table.rows[1:]}

    preliminary = {"title": "Preliminary Declaration", "blocks": []}
    identity = {
        "title": "National Purpose and Identity",
        "flag": {"title": "The National Flag", "blocks": []},
        "animal": {"title": "The American Builder Beaver", "species": "Castor canadensis", "blocks": []},
    }
    branches = {"title": "Constitutional Government", "introduction": "", "items": [], "flow": []}
    directory_sections: list[dict] = []
    articles: list[dict] = []
    schedules: list[dict] = []
    attestation = {"identifier": "Final Attestation", "title": "Oath and Public Trust", "slug": "final-attestation", "blocks": []}

    mode = "front"
    identity_part = None
    current_article = None
    current_schedule = None
    current_directory = None
    next_table_role = None

    for block in ordered:
        if isinstance(block, Paragraph):
            text = clean(block.text)
            style = block.style.name
            if not text:
                continue

            if style == "Front Matter Heading":
                if text == "PRELIMINARY DECLARATION":
                    mode = "preliminary"
                elif text == "ARTICLE OF NATIONAL IDENTITY AND SYMBOLS":
                    mode = "identity"
                elif text == "TABLE OF CONTENTS":
                    mode = "toc"
                elif text == "CONSTITUTIONAL BRANCHES OF GOVERNMENT":
                    mode = "branches"
                elif text == "AGENCIES, AUTHORITIES, INSTITUTIONS, AND NATIONAL SYSTEMS":
                    mode = "directory"
                continue

            article_match = ARTICLE_RE.match(text) if style == "Canonical Article Heading" else None
            schedule_match = SCHEDULE_RE.match(text) if style == "Canonical Article Heading" else None
            if article_match:
                roman = article_match.group(1).upper()
                identifier = f"Article {roman}"
                current_article = {
                    "identifier": identifier,
                    "roman": roman,
                    "number": len(articles) + 1,
                    "order": len(articles) + 1,
                    "title": toc.get(identifier, title_case_heading(article_match.group(2))),
                    "slug": f"article-{roman.lower()}",
                    "blocks": [],
                }
                articles.append(current_article)
                mode = "article"
                continue
            if schedule_match:
                letter = schedule_match.group(1).upper()
                identifier = f"Schedule {letter}"
                current_schedule = {
                    "identifier": identifier,
                    "letter": letter,
                    "title": toc.get(identifier, title_case_heading(schedule_match.group(2))),
                    "slug": f"schedule-{letter.lower()}",
                    "blocks": [],
                }
                schedules.append(current_schedule)
                mode = "schedule"
                continue
            if style == "Canonical Article Heading" and text == "FINAL ATTESTATION OATH AND PUBLIC TRUST":
                mode = "attestation"
                continue

            if mode == "preliminary":
                append_paragraph(preliminary["blocks"], block)
            elif mode == "identity":
                if style == "Canonical Section Heading":
                    identity_part = "flag" if "FLAG" in text else "animal"
                elif identity_part:
                    append_paragraph(identity[identity_part]["blocks"], block)
            elif mode == "branches":
                if style == "Canonical Section Heading" and "Core Decision Flow" in text:
                    next_table_role = "flow"
                elif not branches["introduction"] and style == "Normal":
                    branches["introduction"] = text
            elif mode == "directory":
                if style == "Canonical Section Heading":
                    current_directory = {"title": text, "slug": slugify(text), "entries": []}
                    directory_sections.append(current_directory)
            elif mode == "article" and current_article:
                append_paragraph(current_article["blocks"], block)
            elif mode == "schedule" and current_schedule:
                append_paragraph(current_schedule["blocks"], block)
            elif mode == "attestation":
                append_paragraph(attestation["blocks"], block)
            continue

        table = table_block(block)
        if mode == "identity" and identity_part:
            identity[identity_part]["blocks"].append(table)
        elif mode == "branches":
            if next_table_role == "flow":
                branches["flow"] = table["rows"]
                next_table_role = None
            else:
                branches["items"] = [
                    {
                        "name": row[0],
                        "slug": slugify(row[0]),
                        "composition": row[1],
                        "authority": row[2],
                        "checks": row[3],
                        "entryType": "government-structure",
                    }
                    for row in table["rows"]
                ]
        elif mode == "directory" and current_directory:
            for row in table["rows"]:
                current_directory["entries"].append({
                    "name": row[0],
                    "slug": slugify(row[0]),
                    "role": row[1],
                    "entryType": entry_type(row[0]),
                    "directorySection": current_directory["title"],
                })
        elif mode == "article" and current_article:
            current_article["blocks"].append(table)
        elif mode == "schedule" and current_schedule:
            current_schedule["blocks"].append(table)
        elif mode == "attestation":
            attestation["blocks"].append(table)

    for article in articles:
        first_paragraph = next((b["text"] for b in article["blocks"] if b["type"] == "paragraph"), "")
        article["summary"] = first_paragraph
        article["sectionCount"] = sum(block["type"] == "heading" for block in article["blocks"])

    for branch in branches["items"]:
        branch["sourceArticles"] = find_sources(branch["name"], articles)
    for section in directory_sections:
        for entry in section["entries"]:
            entry["sourceArticles"] = find_sources(entry["name"], articles)

    output = {
        "site": {
            "formalName": "The Generational Commonwealth",
            "constitutionTitle": "The Constitution of the Generational Commonwealth",
            "edition": "Comprehensive Canonical Structural Edition",
            "date": "July 2026",
            "description": "A fictional constitutional design for civic analysis, institutional modeling, and computational simulation.",
            "flag": "/assets/generational-commonwealth-flag.png",
            "animal": "/assets/american-builder-beaver.png",
        },
        "preliminary": preliminary,
        "identity": identity,
        "branches": branches,
        "directorySections": directory_sections,
        "articles": articles,
        "schedules": schedules,
        "attestation": attestation,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if args.flag_output:
        args.flag_output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(args.docx) as archive:
            args.flag_output.write_bytes(archive.read("word/media/image1.png"))

    directory_entries = [entry for section in directory_sections for entry in section["entries"]]
    unresolved = [entry["name"] for entry in directory_entries if not entry["sourceArticles"]]
    print(f"Imported {len(articles)} articles, {len(schedules)} schedules, {len(branches['items'])} branches, and {len(directory_entries)} directory entries.")
    print(f"Directory entries without a matched source article: {len(unresolved)}")
    for name in unresolved:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
