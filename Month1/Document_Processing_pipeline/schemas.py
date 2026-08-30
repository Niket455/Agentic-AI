from pydantic import BaseModel, ConfigDict


class DocumentCreate(BaseModel):
    filename: str


class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_path: str
    content_type: str
    file_size: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class DocumentUpdate(BaseModel):
    filename: str | None = None
    status: str | None = None