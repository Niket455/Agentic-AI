from arq import Retry
from arq.connections import RedisSettings

from processing_service import process_document


async def process_document_job(
    ctx,
    document_id: int,
):
    """
    ARQ job wrapper.

    ARQ calls this function when a document-processing
    job is taken from Redis.
    """

    await process_document(document_id)


class WorkerSettings:
    functions = [
        process_document_job,
    ]

    redis_settings = RedisSettings(
        host="127.0.0.1",
        port=6379,
    )