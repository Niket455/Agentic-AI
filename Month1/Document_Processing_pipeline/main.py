from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, engine, get_db
import models


@asynccontextmanager #for application startup and shutdown.
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def home():
    return {"message": "Document Processing API"}


@app.get("/test-db")
async def test_db(db: AsyncSession = Depends(get_db)):
    return {"message": "Async database session created successfully"}
