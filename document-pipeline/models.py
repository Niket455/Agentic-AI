"""
SQLAlchemy ORM models for the document processing pipeline.
"""

from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime
from database import Base


class Document(Base):
    """An uploaded document and the state of its background processing."""

    __tablename__ = "documents"


    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    # Lifecycle: pending -> processing -> done, or failed on error.
    status = Column(String, nullable=False, default="pending")
    processing_started_at = Column(DateTime,nullable=True,)
    extracted_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)


class DocumentChunk(Base):
    """One chunk of the text extracted from a document."""

    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False,
    )

    chunk_index = Column(Integer, nullable=False)

    content = Column(Text, nullable=False)
