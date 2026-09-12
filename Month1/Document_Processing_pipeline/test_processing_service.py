import asyncio

from sqlalchemy import select

from database import SessionLocal
from models import Document
from processing_service import process_document


async def main():

    # Find a document ID
    async with SessionLocal() as db:

        result = await db.execute(
            select(Document).order_by(Document.id)
        )

        document = result.scalars().first()

        if document is None:
            print("No documents found in database.")
            return

        document_id = document.id

        print(f"Processing document: {document.id}")
        print(f"Filename: {document.filename}")
        print(f"Current status: {document.status}")

    # Process the document
    try:
        await process_document(document_id)

    except Exception as exc:
        print("Processing failed.")
        print(f"Error: {exc}")

    # Check the final status using a NEW session
    async with SessionLocal() as db:

        result = await db.execute(
            select(Document).where(
                Document.id == document_id
            )
        )

        document = result.scalar_one()

        print(f"Final status: {document.status}")

        if document.error_message:
            print(
                f"Error message: "
                f"{document.error_message}"
            )


if __name__ == "__main__":
    asyncio.run(main())