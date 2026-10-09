"""
Shared ARQ/Redis connection helpers.
"""

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings


# Where the ARQ job queue lives.
REDIS_SETTINGS = RedisSettings(
    host="127.0.0.1",
    port=6379,
)


async def create_redis_pool() -> ArqRedis:
    """Create a pooled Redis connection used to enqueue jobs."""

    return await create_pool(REDIS_SETTINGS)
