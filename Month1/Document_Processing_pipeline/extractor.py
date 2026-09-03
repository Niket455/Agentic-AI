from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader


def extract_pdf_text(file_path: Path) -> str:
    reader = PdfReader(file_path)

    text = []

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text.append(page_text)

    return "\n".join(text)


def extract_docx_text(file_path: Path) -> str:
    document = DocxDocument(str(file_path))

    paragraphs = []

    for paragraph in document.paragraphs:
        if paragraph.text:
            paragraphs.append(paragraph.text)

    return "\n".join(paragraphs)


def extract_text(file_path: Path) -> str:
    extension = file_path.suffix.lower()

    if extension == ".pdf":
        return extract_pdf_text(file_path)

    if extension == ".docx":
        return extract_docx_text(file_path)

    raise ValueError(f"Unsupported file type: {extension}")