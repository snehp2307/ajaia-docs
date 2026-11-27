import html
import io
import os
import zipfile

import mammoth
import markdown
import nh3

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_DOCX_UNCOMPRESSED = 20 * 1024 * 1024  # 20 MB, far more than any real text document

# only the tags our editor actually supports, everything else gets removed
ALLOWED_TAGS = {"p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s",
                "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"}


def clean_html(raw_html):
    return nh3.clean(raw_html, tags=ALLOWED_TAGS, attributes={"a": {"href"}})


def check_docx_size(data):
    """A .docx is a zip file. A tiny "zip bomb" can expand to gigabytes and crash the
    server, so check the uncompressed size (listed in the zip header) before unpacking."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            total = sum(item.file_size for item in archive.infolist())
    except zipfile.BadZipFile:
        raise ValueError("Could not read this .docx file. Is it a valid Word document?")
    if total > MAX_DOCX_UNCOMPRESSED:
        raise ValueError("This .docx file is too large once unpacked")


def file_to_html(filename, data):
    """Converts an uploaded .txt, .md or .docx file to safe HTML. Raises ValueError for anything else."""
    ext = os.path.splitext(filename or "")[1].lower()

    if ext == ".docx":
        check_docx_size(data)
        try:
            result = mammoth.convert_to_html(io.BytesIO(data))
        except Exception:
            raise ValueError("Could not read this .docx file. Is it a valid Word document?")
        return clean_html(result.value)

    if ext not in (".txt", ".md"):
        raise ValueError("Unsupported file type. Allowed: .txt, .md, .docx")

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("File must be UTF-8 text")

    if ext == ".md":
        return clean_html(markdown.markdown(text))

    # .txt: each blank-line separated block becomes a paragraph
    paragraphs = [p.strip() for p in text.replace("\r\n", "\n").split("\n\n") if p.strip()]
    return "".join("<p>" + html.escape(p).replace("\n", "<br>") + "</p>" for p in paragraphs)
