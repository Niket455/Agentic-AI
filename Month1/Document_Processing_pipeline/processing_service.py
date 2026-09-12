from pathlib import Path
import asyncio

from sqlalchemy import select

from chunks import chunk_text
from database import SessionLocal
from extractor import extract_text
from models import Document, DocumentChunk
from text_cleaner import clean_text


async def process_document(
    document_id: int,
) -> None:

    async with SessionLocal() as db:

        # 1. Find the document
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )

        document = result.scalar_one_or_none()

        if document is None:
            raise ValueError(
                f"Document {document_id} not found"
            )

        # 2. Mark as processing
        document.status = "processing"

        await db.commit()

        try:
            # 3. Get stored file path
            file_path = Path(document.file_path)

            if not file_path.exists():
                raise FileNotFoundError(
                    f"File not found: {file_path}"
                )

            # 4. Extract text
            text = await asyncio.to_thread(
                extract_text,
                file_path,
            )

            # 5. Clean text
            text = clean_text(text)

            # 6. Chunk text
            chunks = chunk_text(text)

            # 7. Store extracted text
            document.extracted_text = text

            # 8. Create chunk records
            chunk_objects = []

            for index, chunk in enumerate(chunks):
                chunk_object = DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    content=chunk,
                )

                chunk_objects.append(chunk_object)

            # 9. Add chunks
            db.add_all(chunk_objects)

            # 10. Mark completed
            document.status = "done"
            document.error_message = None

            # 11. Save everything
            await db.commit()

        except Exception as exc:

            # 12. Roll back pending DB changes
            await db.rollback()

            # 13. Mark document as failed
            document.status = "failed"
            document.error_message = str(exc)

            await db.commit()

            raise