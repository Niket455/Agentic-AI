"""
Dev helper: reset a single document to "pending" so it can be reprocessed.

Run with: python reset_test_document.py
"""

import asyncio

from sqlalchemy import delete, select

from database import SessionLocal
from models import Document, DocumentChunk


# Document to reset.
DOCUMENT_ID = 1


async def main():
    """Delete the document's chunks and clear its processing fields."""

    async with SessionLocal() as db:

        result = await db.execute(
            select(Document).where(
                Document.id == DOCUMENT_ID
            )
        )

        document = result.scalar_one_or_none()

        if document is None:
            print(f"Document {DOCUMENT_ID} not found.")
            return

        # Remove existing chunks
        await db.execute(
            delete(DocumentChunk).where(
                DocumentChunk.document_id == DOCUMENT_ID
            )
        )

        # Reset processing fields
        document.status = "pending"
        document.extracted_text = None
        document.error_message = None

        await db.commit()

        print(
            f"Document {DOCUMENT_ID} reset to pending."
        )


if __name__ == "__main__":
    asyncio.run(main())
