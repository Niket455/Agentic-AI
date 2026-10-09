"""
Database setup.

Creates the async SQLite engine, the session factory shared by the FastAPI
app and the ARQ worker, and the declarative ``Base`` used by the ORM models.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.ext.declarative import declarative_base

#Where is the database?
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///./docs.db"


#How do I communicate with it?
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
)

# How do I create database sessions?
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    # Keep loaded attributes usable after commit() without an implicit reload.
    expire_on_commit=False,
)

#Foundation for SQLAlchemy models
Base = declarative_base()


#Give FastAPI a database session and close it when finished
async def get_db():
    """Yield a database session and close it when the request finishes."""

    async with SessionLocal() as db:
        yield db
