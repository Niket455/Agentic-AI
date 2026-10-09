# Document Processing Pipeline

An asynchronous document ingestion service. Clients upload a PDF or DOCX file, the API stores it
and enqueues a job, and a background worker extracts, cleans, and chunks the text. Clients poll the
API to observe progress and read the resulting chunks.

For the full design (component diagram, ER diagram, target API, roadmap), see
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Features

- **Async-first HTTP API** built with FastAPI.
- **Background processing** with [ARQ](https://arq-docs.helpmanual.io/) workers backed by Redis —
  uploads return `202 Accepted` immediately.
- **Atomic job claiming** so concurrent workers never process the same document twice.
- **Pluggable text extraction** for PDF (`pypdf`) and DOCX (`python-docx`).
- **Overlapping chunking** (default `chunk_size=1000`, `overlap=200`) for downstream RAG.
- **Stale-job recovery** for documents left in `processing` by a crashed worker.
- **Schema migrations** with Alembic.

## Document lifecycle

```text
pending → processing → done
                     ↘ failed   (eligible for re-claim / retry)
```

## Project layout

| File | Role |
|---|---|
| `main.py` | FastAPI app: CRUD, upload, chunks; opens the shared ARQ/Redis pool |
| `worker.py` | ARQ worker entry point (`process_document_job`) |
| `processing_service.py` | Atomic claim → extract → clean → chunk → persist |
| `redis_queue.py` | ARQ/Redis connection factory |
| `database.py` | Async engine, session factory, `Base`, `get_db` |
| `models.py` | SQLAlchemy models: `Document`, `DocumentChunk` |
| `schemas.py` | Pydantic request/response models |
| `extractor.py` | PDF/DOCX text extraction |
| `text_cleaner.py` | Whitespace normalization |
| `chunks.py` | Overlapping fixed-size text chunker |
| `recpver_stale_jobs.py` | Reset and re-queue stale `processing` documents |
| `alembic/` | Migration environment and versions |
| `enqueue_test.py` | Dev helper: enqueue a job for document id 1 |
| `reset_test_document.py` | Dev helper: reset a document to `pending` |
| `test_processing_service.py` | Dev helper: process one document synchronously |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health/hello |
| `POST` | `/documents` | Create a metadata-only document record |
| `GET` | `/documents` | List all documents |
| `GET` | `/documents/{id}` | Get one document |
| `PATCH` | `/documents/{id}` | Partial update (filename, status) |
| `DELETE` | `/documents/{id}` | Delete a document |
| `POST` | `/documents/upload` | Upload a PDF/DOCX and queue processing (`202`) |
| `GET` | `/documents/{id}/chunks` | List a document's chunks ordered by index |

## Getting started

**Prerequisites:** Python 3.10+ and a running Redis on `127.0.0.1:6379`.

```bash
cd document-pipeline
python -m venv .venv
.venv\Scripts\activate              # Windows (bash: source .venv/Scripts/activate)
pip install -r requirements.txt

alembic upgrade head                # create the schema (docs.db)

uvicorn main:app --reload           # terminal 1 — API
arq worker.WorkerSettings           # terminal 2 — worker (needs Redis)
```

Then upload a file:

```bash
curl -F "file=@sample.pdf" http://127.0.0.1:8000/documents/upload
curl http://127.0.0.1:8000/documents/1          # poll status
curl http://127.0.0.1:8000/documents/1/chunks   # read results
```

## Configuration

Currently hard-coded (see `database.py`, `redis_queue.py`, `worker.py`); moving these to
environment variables is tracked in `ARCHITECTURE.md` (Phase 0).

| Setting | Value |
|---|---|
| Database URL | `sqlite+aiosqlite:///./docs.db` |
| Redis | `127.0.0.1:6379` |
| Allowed uploads | `.pdf`, `.docx` |
| Upload read block | 1 MiB |
| Stale-after | 15 minutes |

## Migrations

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

## Recovery

If a worker crashes mid-run, a document can be left in `processing`. Recover it with:

```bash
python recpver_stale_jobs.py
```

Documents stuck `processing` for more than 15 minutes are reset to `pending` and re-queued.
