from arq import create_pool
from arq.connections import ArqRedis, RedisSettings


REDIS_SETTINGS = RedisSettings(
    host="127.0.0.1",
    port=6379,
)


async def create_redis_pool() -> ArqRedis:
    return await create_pool(REDIS_SETTINGS)