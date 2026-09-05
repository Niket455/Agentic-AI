import re


def clean_text(text: str) -> str:
    # Remove spaces/tabs at the beginning and end of each line
    text = re.sub(r"[ \t]+", " ", text)

    # Remove spaces before or after newlines
    text = re.sub(r" *\n *", "\n", text)

    # Reduce 3 or more consecutive newlines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove unnecessary whitespace at beginning/end
    text = text.strip()

    return text