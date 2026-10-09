"""
Text chunking utilities.

Splits a long string into smaller, overlapping chunks so downstream
consumers (for example embeddings or retrieval) get manageable units of
text while still preserving context across chunk boundaries.
"""


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[str]:
    """
    Split ``text`` into chunks of at most ``chunk_size`` characters.

    Consecutive chunks share ``overlap`` characters so sentences spanning a
    boundary are not lost. Returns an empty list for blank input.
    """

    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than 0")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError(
            "overlap must be between 0 and chunk_size - 1"
        )

    text = text.strip()

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        # Step back by `overlap` so the next chunk re-includes context.
        start = end - overlap

    return chunks
