# Agentic-AI

A collection of hands-on AI, backend, and frontend projects — async document processing, RAG
experiments with LangChain, an offline-first finance app, and Python practice.

This is a personal learning/portfolio repository. Each top-level folder is a **self-contained
project with its own README**.

## Repository map

```text
Agentic-AI/
├── document-pipeline/     # FastAPI + ARQ async document processing service
├── fintracker/            # FinTracker — offline-first personal finance PWA
├── langchain/             # LangChain learning track (loaders, embeddings, vector stores)
├── python-exercises/      # Python / OOP practice problems
└── README.md              # this file
```

## Projects

| Project | What it is | Stack |
|---|---|---|
| [document-pipeline](./document-pipeline) | Async PDF/DOCX ingestion → text extraction → cleaning → chunking, exposed over HTTP | FastAPI · SQLAlchemy 2 (async) · SQLite · ARQ · Redis · Alembic |
| [fintracker](./fintracker) | Offline-first PWA for budgets, expenses, savings, and goals | Vanilla JS · localStorage · Service Worker |
| [langchain](./langchain) | LangChain fundamentals: loaders, splitters, Ollama embeddings, FAISS/Chroma, Streamlit demo | LangChain · Ollama · Chroma · FAISS · Streamlit |
| [python-exercises](./python-exercises) | OOP practice problems with solutions | Python 3 |

### document-pipeline

Backend service that ingests documents, extracts and cleans their text, and splits it into
overlapping chunks for downstream search/RAG. Uploads return `202 Accepted` and are processed
asynchronously by ARQ workers backed by Redis; clients poll the API to observe progress.

- **Design doc:** [`document-pipeline/ARCHITECTURE.md`](./document-pipeline/ARCHITECTURE.md)
- **Run:**

  ```bash
  cd document-pipeline
  python -m venv .venv
  .venv\Scripts\activate           # Windows (bash: source .venv/Scripts/activate)
  pip install -r requirements.txt
  alembic upgrade head             # create the database schema
  uvicorn main:app --reload        # API at http://127.0.0.1:8000

  # in a second shell (requires Redis on 127.0.0.1:6379)
  arq worker.WorkerSettings
  ```

### fintracker

"FinTracker" — an offline-first Progressive Web App for tracking budgets, expenses, income,
savings, debts, goals, and a wishlist. All data lives in `localStorage`; a service worker caches
the app shell so it works with no network. Charts are drawn on `<canvas>` with no chart library.
Installable to a phone home screen (default currency `₹`).

- **Run:** serve the folder statically and open `index.html`

  ```bash
  cd fintracker
  python -m http.server 8080
  ```

### langchain

A learning track covering LangChain fundamentals: document loaders and text splitters, Ollama
embeddings, FAISS and Chroma vector stores, plus a Streamlit chat demo backed by a local Ollama
model.

- **Contents:** notebooks and demo code under [`langchain/1-langchain/`](./langchain)
- **Run:**

  ```bash
  cd langchain
  python -m venv venv
  venv\Scripts\activate            # Windows (bash: source venv/Scripts/activate)
  pip install -r requirements.txt
  ```

### python-exercises

Python/OOP practice problems with solutions — classes, inheritance, dictionaries, and console I/O
(`oops1.py`–`oops3.py`). Each file contains the problem statement in its module docstring.

## Conventions

- **One folder per project**, each with its own `README.md`.
- **Generated and environment-specific artifacts are not committed** — virtual environments,
  `__pycache__`, the runtime database (`docs.db`), uploaded files (`uploads/`), vector-store
  binaries, and `.env` secrets are all covered by `.gitignore`.
- **Folder names describe content**, not the date the project was written.
