import asyncio
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import delete, select, update

from chunks import chunk_text
from database import SessionLocal
from extractor import extract_text
from models import Document, DocumentChunk
from text_cleaner import clean_text


async def process_document(
    document_id: int,
) -> None:

    async with SessionLocal() as db:

        # 1. Atomically claim the document for processing.
        result = await db.execute(
            update(Document)
            .where(
                Document.id == document_id,
                Document.status.in_(["pending", "failed"]),
            )
            .values(
                status="processing",
                processing_started_at=datetime.now(timezone.utc),
                error_message=None,
            )
        )

        # 2. Check whether this worker successfully claimed it.
        if result.rowcount != 1:
            await db.rollback()
            return

        # 3. Commit the claim immediately.
        await db.commit()

        try:
            # 4. Fetch the document again.
            result = await db.execute(
                select(Document).where(
                    Document.id == document_id
                )
            )

            document = result.scalar_one_or_none()

            if document is None:
                raise ValueError(
                    f"Document {document_id} not found"
                )

            # 5. Check that the file exists.
            file_path = Path(document.file_path)

            if not file_path.exists():
                raise FileNotFoundError(
                    f"File not found: {file_path}"
                )

            # 6. Extract text.
            text = await asyncio.to_thread(
                extract_text,
                file_path,
            )

            # 7. Clean text.
            text = clean_text(text)

            # 8. Create chunks.
            chunks = chunk_text(text)

            # 9. Store extracted text.
            document.extracted_text = text

            # 10. Delete any previous chunks.
            await db.execute(
                delete(DocumentChunk).where(
                    DocumentChunk.document_id
                    == document.id
                )
            )

            # 11. Create fresh chunk records.
            chunk_objects = []

            for index, chunk in enumerate(chunks):
                chunk_objects.append(
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=index,
                        content=chunk,
                    )
                )

            # 12. Add chunks.
            db.add_all(chunk_objects)

            # 13. Mark processing as complete.
            document.status = "done"
            document.processing_started_at = None
            document.error_message = None

            # 14. Commit the document + chunks together.
            await db.commit()

        except Exception as exc:

            # 15. Roll back uncommitted work.
            await db.rollback()

            # 16. Fetch the document again.
            result = await db.execute(
                select(Document).where(
                    Document.id == document_id
                )
            )

            document = result.scalar_one()

            # 17. Record the failure.
            document.status = "failed"
            document.error_message = str(exc)

            await db.commit()

            raise