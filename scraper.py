"""
scraper.py
----------
Scrapes IIUI (Ibadat International University, Islamabad) website pages
(programs, admission criteria, FAQs) plus the per-program fee-structure
PDFs, extracts clean text from everything, and compiles it all into a
single output PDF report (+ optionally raw .json / .md files you can feed
straight into a DocumentManager / RAG knowledge base).

Run this on YOUR OWN machine (needs open internet access to iiui.edu.pk).

Requirements:
    pip install requests beautifulsoup4 pdfplumber reportlab

Usage:
    python scraper.py
    # Output goes to ./scraped_output/
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ------------------------------------------------------------------ #
# Configuration
# ------------------------------------------------------------------ #
BASE_URL = "https://iiui.edu.pk"
OUTPUT_DIR = "scraped_output"
PDF_DIR = os.path.join(OUTPUT_DIR, "fee_pdfs")
REQUEST_DELAY_SECONDS = 1.5      # be polite - don't hammer the server
REQUEST_TIMEOUT = 20
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# The pages we want as clean text sections.
TARGET_PAGES = {
    "programs": f"{BASE_URL}/faculties-departments/",
    "admission_criteria": f"{BASE_URL}/admission-criteria/",
    "fee_structure_index": f"{BASE_URL}/fee-structure/",
    "faqs": f"{BASE_URL}/faqs/",
    "academic_calendar": f"{BASE_URL}/academic-calendar/",
}


@dataclass
class ScrapedPage:
    key: str
    url: str
    title: str
    text: str


@dataclass
class ScrapedPDF:
    filename: str
    url: str
    local_path: str
    text: str
    extraction_ok: bool
    note: str = ""


@dataclass
class ScrapeResult:
    pages: List[ScrapedPage] = field(default_factory=list)
    pdfs: List[ScrapedPDF] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


# ------------------------------------------------------------------ #
# Step 1: fetch + clean a normal HTML page
# ------------------------------------------------------------------ #
def fetch_page(url: str) -> Optional[BeautifulSoup]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as exc:
        print(f"  [!] Failed to fetch {url}: {exc}")
        return None


def clean_page_text(soup: BeautifulSoup) -> str:
    """Strips nav/header/footer/script/style junk, keeps the main content."""
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()

    # Most WordPress/Elementor sites keep real content inside <main> or
    # a content wrapper; fall back to <body> if not found.
    main = soup.find("main") or soup.find(id="content") or soup.body or soup

    lines = [line.strip() for line in main.get_text("\n").splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)


def scrape_html_pages(result: ScrapeResult) -> None:
    for key, url in TARGET_PAGES.items():
        print(f"[*] Scraping page: {key} -> {url}")
        soup = fetch_page(url)
        if soup is None:
            result.errors.append(f"Could not load page '{key}' ({url})")
            continue

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else key
        text = clean_page_text(soup)

        result.pages.append(ScrapedPage(key=key, url=url, title=title, text=text))
        time.sleep(REQUEST_DELAY_SECONDS)


# ------------------------------------------------------------------ #
# Step 2: find + download every fee-structure PDF linked on that page
# ------------------------------------------------------------------ #
def find_pdf_links(fee_page_url: str) -> List[str]:
    soup = fetch_page(fee_page_url)
    if soup is None:
        return []

    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().endswith(".pdf"):
            links.add(urljoin(fee_page_url, href))
    return sorted(links)


def download_pdf(url: str, dest_dir: str) -> Optional[str]:
    filename = os.path.basename(url.split("?")[0])
    local_path = os.path.join(dest_dir, filename)

    if os.path.exists(local_path):
        return local_path  # already downloaded, skip re-fetching

    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(resp.content)
        return local_path
    except requests.RequestException as exc:
        print(f"  [!] Failed to download {url}: {exc}")
        return None


# ------------------------------------------------------------------ #
# Step 3: extract text from each downloaded PDF (with OCR fallback)
# ------------------------------------------------------------------ #
def extract_pdf_text(local_path: str) -> tuple[str, bool, str]:
    """Returns (text, success, note). Tries pdfplumber first (fast, works
    for text-based PDFs). If that yields nothing, tries OCR as a fallback
    (slow, needed for scanned/image-only PDFs)."""
    try:
        import pdfplumber

        text_parts = []
        with pdfplumber.open(local_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        text = "\n".join(text_parts).strip()
        if text:
            return text, True, "extracted via pdfplumber"
    except Exception as exc:  # noqa: BLE001
        print(f"  [!] pdfplumber failed on {local_path}: {exc}")

    # Fallback: OCR (only works if pytesseract + poppler + tesseract are
    # installed on your machine -- this is optional/slow).
    try:
        import pytesseract
        from pdf2image import convert_from_path

        images = convert_from_path(local_path)
        ocr_text = "\n".join(pytesseract.image_to_string(img) for img in images)
        ocr_text = ocr_text.strip()
        if ocr_text:
            return ocr_text, True, "extracted via OCR (scanned PDF)"
    except Exception as exc:  # noqa: BLE001
        print(f"  [!] OCR fallback unavailable/failed on {local_path}: {exc}")

    return "", False, "no extractable text (likely a scanned image with no OCR available)"


def scrape_fee_pdfs(result: ScrapeResult) -> None:
    os.makedirs(PDF_DIR, exist_ok=True)
    fee_index_url = TARGET_PAGES["fee_structure_index"]

    print(f"[*] Finding fee-structure PDF links on {fee_index_url}")
    pdf_links = find_pdf_links(fee_index_url)
    print(f"[*] Found {len(pdf_links)} PDF(s).")

    for i, pdf_url in enumerate(pdf_links, start=1):
        filename = os.path.basename(pdf_url.split("?")[0])
        print(f"  ({i}/{len(pdf_links)}) Downloading {filename}")

        local_path = download_pdf(pdf_url, PDF_DIR)
        if local_path is None:
            result.errors.append(f"Failed to download {pdf_url}")
            continue

        text, ok, note = extract_pdf_text(local_path)
        result.pdfs.append(
            ScrapedPDF(
                filename=filename,
                url=pdf_url,
                local_path=local_path,
                text=text,
                extraction_ok=ok,
                note=note,
            )
        )
        time.sleep(REQUEST_DELAY_SECONDS)


# ------------------------------------------------------------------ #
# Step 4: save raw structured data (JSON + Markdown, ready for a RAG /
# DocumentManager-style knowledge base)
# ------------------------------------------------------------------ #
def save_raw_outputs(result: ScrapeResult) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # JSON dump -- easy to load into any DB later.
    data = {
        "pages": [p.__dict__ for p in result.pages],
        "pdfs": [
            {k: v for k, v in p.__dict__.items()} for p in result.pdfs
        ],
        "errors": result.errors,
    }
    json_path = os.path.join(OUTPUT_DIR, "scraped_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[*] Saved raw JSON -> {json_path}")

    # One markdown file per scraped HTML page (drop straight into docs/).
    for page in result.pages:
        md_path = os.path.join(OUTPUT_DIR, f"{page.key}.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(f"# {page.title}\n\nSource: {page.url}\n\n{page.text}\n")
    print(f"[*] Saved per-page Markdown files -> {OUTPUT_DIR}/*.md")


# ------------------------------------------------------------------ #
# Step 5: compile EVERYTHING into a single output PDF report
# ------------------------------------------------------------------ #
def build_pdf_report(result: ScrapeResult, out_path: str) -> None:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        PageBreak,
    )

    doc = SimpleDocTemplate(out_path, pagesize=letter)
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"], fontSize=9.5, leading=13, spaceAfter=6
    )

    story = []
    story.append(Paragraph("IIUI Website Scrape Report", styles["Title"]))
    story.append(Spacer(1, 12))

    # --- HTML pages ---
    for page in result.pages:
        story.append(Paragraph(page.title, styles["Heading1"]))
        story.append(Paragraph(f"Source: {page.url}", styles["Italic"]))
        story.append(Spacer(1, 6))
        for para in page.text.split("\n"):
            if para.strip():
                # Escape any characters that would break ReportLab's mini-XML
                safe = (
                    para.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                )
                story.append(Paragraph(safe, body_style))
        story.append(PageBreak())

    # --- Fee PDFs summary ---
    story.append(Paragraph("Fee Structure PDFs (Extracted Text)", styles["Heading1"]))
    story.append(Spacer(1, 6))
    for pdf in result.pdfs:
        story.append(Paragraph(pdf.filename, styles["Heading2"]))
        story.append(Paragraph(f"Source: {pdf.url}", styles["Italic"]))
        story.append(Paragraph(f"Status: {pdf.note}", styles["Italic"]))
        story.append(Spacer(1, 4))
        if pdf.text:
            for para in pdf.text.split("\n"):
                if para.strip():
                    safe = (
                        para.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                    )
                    story.append(Paragraph(safe, body_style))
        else:
            story.append(
                Paragraph(
                    "No text could be extracted (scanned/image PDF, OCR unavailable).",
                    body_style,
                )
            )
        story.append(Spacer(1, 10))

    # --- Errors log ---
    if result.errors:
        story.append(PageBreak())
        story.append(Paragraph("Errors / Warnings", styles["Heading1"]))
        for err in result.errors:
            story.append(Paragraph(err, body_style))

    doc.build(story)
    print(f"[*] Compiled final PDF report -> {out_path}")


# ------------------------------------------------------------------ #
# Main
# ------------------------------------------------------------------ #
def main() -> None:
    result = ScrapeResult()

    print("=== Step 1/3: Scraping HTML pages ===")
    scrape_html_pages(result)

    print("\n=== Step 2/3: Downloading + extracting fee-structure PDFs ===")
    scrape_fee_pdfs(result)

    print("\n=== Step 3/3: Saving outputs ===")
    save_raw_outputs(result)
    report_path = os.path.join(OUTPUT_DIR, "iiui_scrape_report.pdf")
    build_pdf_report(result, report_path)

    print("\nDone.")
    print(f"- Raw data (JSON):        {OUTPUT_DIR}/scraped_data.json")
    print(f"- Per-page Markdown:      {OUTPUT_DIR}/*.md")
    print(f"- Downloaded fee PDFs:    {PDF_DIR}/")
    print(f"- Combined PDF report:    {report_path}")


if __name__ == "__main__":
    main()