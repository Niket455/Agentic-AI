"""
Pydantic request/response schemas for the HTTP API.

Request models validate incoming payloads; response models serialize ORM
objects (``from_attributes=True`` builds them from SQLAlchemy instances).
"""

from pydantic import BaseModel, ConfigDict


class DocumentCreate(BaseModel):
    """Payload for creating a document record from a filename."""

    filename: str


class DocumentResponse(BaseModel):
    """Public representation of a document and its processing state."""

    id: int
    filename: str
    file_path: str
    content_type: str
    file_size: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class DocumentUpdate(BaseModel):
    """Fields that may be changed on an existing document."""

    filename: str | None = None
    status: str | None = None


class DocumentChunkResponse(BaseModel):
    """A single chunk of a document's extracted text."""

    id: int
    document_id: int
    chunk_index: int
    content: str

    model_config = ConfigDict(from_attributes=True)
