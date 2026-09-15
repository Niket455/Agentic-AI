import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select, update

from database import SessionLocal
from models import Document
from redis_queue import create_redis_pool


STALE_AFTER_MINUTES = 15


async def recover_stale_jobs():
    cutoff_time = datetime.utcnow() - timedelta(
        minutes=STALE_AFTER_MINUTES
    )

    async with SessionLocal() as db:

        # Find documents that appear to be stuck
        result = await db.execute(
            select(Document.id)
            .where(
                Document.status == "processing",
                Document.processing_started_at.is_not(None),
                Document.processing_started_at < cutoff_time,
            )
        )

        stale_document_ids = result.scalars().all()

        if not stale_document_ids:
            print("No stale documents found.")
            return

        print(
            f"Found {len(stale_document_ids)} stale document(s)."
        )

        # Move stale documents back to pending.
        await db.execute(
            update(Document)
            .where(
                Document.id.in_(stale_document_ids),
                Document.status == "processing",
            )
            .values(
                status="pending",
                processing_started_at=None,
                error_message="Recovered from stale processing state",
            )
        )

        await db.commit()

    # Create a Redis connection
    redis = await create_redis_pool()

    try:
        # Queue the documents again
        for document_id in stale_document_ids:
            await redis.enqueue_job(
                "process_document_job",
                document_id,
            )

            print(
                f"Requeued document {document_id}"
            )

    finally:
        await redis.aclose()


if __name__ == "__main__":
    asyncio.run(recover_stale_jobs())