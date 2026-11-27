import html
import io

import mammoth
import markdown
import nh3

ALLOWED_EXTENSIONS = [".txt", ".md", ".docx"]
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB

# only the tags our editor actually supports, everything else gets removed
ALLOWED_TAGS = {"p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s",
                "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"}


def clean_html(raw_html):
    return nh3.clean(raw_html, tags=ALLOWED_TAGS, attributes={"a": {"href"}})


def get_extension(filename):
    if "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[1].lower()


def file_to_html(filename, data):
    ext = get_extension(filename)

    if ext == ".docx":
        try:
            result = mammoth.convert_to_html(io.BytesIO(data))
        except Exception:
            raise ValueError("Could not read this .docx file. Is it a valid Word document?")
        return clean_html(result.value)

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("File must be UTF-8 text")

    if ext == ".md":
        return clean_html(markdown.markdown(text))

    if ext == ".txt":
        # each blank-line separated block becomes a paragraph
        paragraphs = [p.strip() for p in text.replace("\r\n", "\n").split("\n\n") if p.strip()]
        parts = []
        for p in paragraphs:
            parts.append("<p>" + html.escape(p).replace("\n", "<br>") + "</p>")
        return "".join(parts)

    raise ValueError("Unsupported file type. Allowed: .txt, .md, .docx")


def title_from_filename(filename):
    name = filename.rsplit(".", 1)[0].strip()
    return name[:200] or "Imported document"
