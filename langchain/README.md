# LangChain Learning Track

A hands-on tour of the LangChain fundamentals, from raw documents to a searchable vector store and
a chat demo backed by a local Ollama model.

## Contents

| Path | Topic |
|---|---|
| `1-langchain/DataIngestion/DataIngestion.ipynb` | Document loaders (text, PDF, web, Wikipedia) |
| `1-langchain/DataIngestion/textsplitter.ipynb` | Text splitting / chunking strategies |
| `1-langchain/Embedding/ollamaembedding.ipynb` | Embeddings via Ollama |
| `1-langchain/vectorstoredb/FAISS.ipynb` | FAISS vector store |
| `1-langchain/vectorstoredb/chromaDB/Chroma.ipynb` | Chroma vector store |
| `1-langchain/Ollama/app.py` | Streamlit chat demo (`prompt → Ollama → parser`) with LangSmith tracing |

Sample data (`speech.txt`) and the generated vector-store files (`faiss_index/`, `chromaDB/`) sit
alongside the notebooks.

## Requirements

`requirements.txt` pulls in LangChain, `langchain-community`, `langchain-text-splitters`,
`langchain_chroma`, `chromadb`, `faiss-cpu`, `pypdf`, `bs4`, `wikipedia`, `streamlit`, and
`python-dotenv`.

## Run

```bash
cd langchain
python -m venv venv
venv\Scripts\activate          # Windows (bash: source venv/Scripts/activate)
pip install -r requirements.txt
```

- **Notebooks:** `jupyter lab` (or VS Code) and open any `.ipynb` under `1-langchain/`.
- **Streamlit demo:** requires a local [Ollama](https://ollama.com/) server with the model pulled
  (the demo uses `gemma:2b`):

  ```bash
  ollama pull gemma:2b
  ollama serve
  streamlit run 1-langchain/Ollama/app.py
  ```

## Configuration

The Streamlit app reads `LANGCHAIN_API_KEY` and `LANGCHAIN_PROJECT` from a local `.env` (git-ignored)
to enable LangSmith tracing. It runs fine without them.
