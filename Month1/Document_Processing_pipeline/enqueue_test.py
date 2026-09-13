import asyncio

from arq import create_pool
from arq.connections import RedisSettings


async def main():
    redis = await create_pool(
        RedisSettings(
            host="127.0.0.1",
            port=6379,
        )
    )

    job = await redis.enqueue_job(
        "process_document_job",
        1,
    )

    print(f"Job: {job}")

    await redis.aclose()


if __name__ == "__main__":
    asyncio.run(main())