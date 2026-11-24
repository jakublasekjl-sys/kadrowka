"""Generate the shareable Word edition of the security standard."""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "SECURE_DEVELOPMENT_STANDARD.md"
DESTINATION = ROOT / "docs" / "Standard_bezpieczenstwa_aplikacji_ZHP_v1_1.docx"
INLINE = re.compile(r"(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|(?<!\*)\*[^*]+\*(?!\*))")
LINK = re.compile(r"^\[([^\]]+)\]\(([^)]+)\)$")


def add_link(paragraph, label: str, url: str) -> None:
    part = paragraph.part
    rel = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rel)
    run = OxmlElement("w:r")
    properties = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "5B2B87")
    properties.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    properties.append(underline)
    run.append(properties)
    text = OxmlElement("w:t")
    text.text = label
    run.append(text)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def add_inline(paragraph, value: str) -> None:
    for fragment in INLINE.split(value):
        if not fragment:
            continue
        linked = LINK.match(fragment)
        if linked:
            add_link(paragraph, linked.group(1), linked.group(2))
        elif fragment.startswith("**") and fragment.endswith("**"):
            paragraph.add_run(fragment[2:-2]).bold = True
        elif fragment.startswith("`") and fragment.endswith("`"):
            run = paragraph.add_run(fragment[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9)
        elif fragment.startswith("*") and fragment.endswith("*"):
            paragraph.add_run(fragment[1:-1]).italic = True
        else:
            paragraph.add_run(fragment)


def add_page_number(paragraph) -> None:
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    paragraph._p.append(field)


def build() -> None:
    document = Document()
    section = document.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.68)
    section.left_margin = Inches(0.84)
    section.right_margin = Inches(0.84)
    section.header_distance = Inches(0.32)
    section.footer_distance = Inches(0.32)

    normal = document.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor(37, 42, 48)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.13

    title = document.styles["Title"]
    title.font.name = "Aptos Display"
    title.font.size = Pt(20)
    title.font.bold = True
    title.font.color.rgb = RGBColor(31, 34, 39)
    title.paragraph_format.space_after = Pt(10)

    heading = document.styles["Heading 1"]
    heading.font.name = "Aptos Display"
    heading.font.size = Pt(12)
    heading.font.bold = True
    heading.font.color.rgb = RGBColor(91, 43, 135)
    heading.paragraph_format.space_before = Pt(12)
    heading.paragraph_format.space_after = Pt(5)
    heading.paragraph_format.keep_with_next = True

    for style_name in ("List Bullet", "List Number"):
        style = document.styles[style_name]
        style.font.name = "Aptos"
        style.font.size = Pt(10)
        style.paragraph_format.left_indent = Inches(0.28)
        style.paragraph_format.first_line_indent = Inches(-0.17)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.keep_together = True

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.style = normal
    footer.add_run("Standard bezpieczeństwa aplikacji webowych ZHP  |  ")
    add_page_number(footer)
    for run in footer.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(105, 111, 117)

    for raw in SOURCE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("# "):
            document.add_paragraph(line[2:], style="Title")
        elif line.startswith("## "):
            document.add_paragraph(line[3:], style="Heading 1")
        elif line.startswith("- "):
            paragraph = document.add_paragraph(style="List Bullet")
            add_inline(paragraph, line[2:])
        elif re.match(r"^\d+\. ", line):
            paragraph = document.add_paragraph(style="List Number")
            add_inline(paragraph, re.sub(r"^\d+\. ", "", line))
        else:
            paragraph = document.add_paragraph()
            add_inline(paragraph, line)

    document.core_properties.title = "Standard bezpieczeństwa aplikacji webowych ZHP"
    document.core_properties.subject = "Wersja 1.1 - repozytorium, CI/CD, materiały i wdrożenie"
    document.save(DESTINATION)
    print(DESTINATION)


if __name__ == "__main__":
    build()
