from fastapi import FastAPI

from database import engine, Base
import models

app = FastAPI()

Base.metadata.create_all(bind=engine)


@app.get("/")
def home():
    return {"message": "Document Processing API"}