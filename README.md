# RAG Q&A Tool

A Retrieval-Augmented Generation system that lets you upload PDF documents and ask
natural-language questions about their content, with answers grounded in the source
text and cited by page.

## Features

- PDF upload with automatic text extraction and chunking
- Semantic search over document content using local embeddings (no API key required)
- Source-cited retrieval — every result traces back to its originating document and page
- Cosine-similarity ranking tuned for retrieval precision

## Tech Stack

- **Backend:** FastAPI, LangChain, ChromaDB (vector store), HuggingFace Sentence
  Transformers (local embeddings)
- **Frontend:** React (Vite)
- **PDF Processing:** pypdf

## How It Works

1. Uploaded PDFs are parsed and split into overlapping text chunks (400 characters,
   150 overlap) — tuned specifically to avoid splitting key facts across chunk
   boundaries, based on retrieval-accuracy testing.
2. Each chunk is embedded using a local sentence-transformer model and stored in
   ChromaDB with cosine similarity search.
3. A query is embedded the same way and matched against stored chunks, returning the
   most relevant passages with their source document and page number.

## Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
First run downloads the embedding model (~90MB), one-time only.
Verify it's running: `http://localhost:8000` should return `{"status": "ok"}`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (usually `http://localhost:5173`).

## Usage

1. Upload a PDF (must contain extractable text, not a scanned image).
2. Ask a question about its content.
3. View the most relevant retrieved passages, each with its source and page number.

## Roadmap

- LLM-generated answers from retrieved context (currently     returns raw passages)
-  User authentication and saved query history
-  Multi-document collections with per-document filtering
-  Deployment (Render/Vercel)