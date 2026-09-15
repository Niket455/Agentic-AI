from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime
from database import Base


class Document(Base):
    __tablename__ = "documents"
    

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="pending")
    processing_started_at = Column(DateTime,nullable=True,)
    extracted_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)


class DocumentChunk(Base):

    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False,
    )

    chunk_index = Column(Integer, nullable=False)

    content = Column(Text, nullable=False)