"""
RAG Q&A Tool - Backend (Day 1 scope)

Pipeline implemented today:
  upload PDF -> extract text -> chunk -> embed -> store in ChromaDB -> retrieve

NOT implemented yet (Day 3, on purpose):
  - Calling an LLM to generate a final answer from retrieved chunks
  - Auth / per-user history (Day 7-8)

Run:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""

import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
CHROMA_DIR = "chroma_db"

app = FastAPI(title="RAG Q&A Tool - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Local, free embedding model -> no API key needed to get today's pipeline working.
# (When you wire the LLM on Day 3, that's where an API key first becomes necessary.)
print("Loading embedding model (first run downloads ~90MB, be patient)...")
embedding_function = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    encode_kwargs={"normalize_embeddings": True},  # makes distance scores meaningful
)

vectorstore = Chroma(
    persist_directory=CHROMA_DIR,
    embedding_function=embedding_function,
    collection_name="documents",
    collection_metadata={"hnsw:space": "cosine"},  # was defaulting to raw L2 distance
)
# Chunking strategy - START here, then deliberately experiment with these two
# numbers on Day 6 and note what changes about retrieval quality.
splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,
    chunk_overlap=80,
    separators=["\n\n", "\n", ". ", " ", ""],
)
# Simple in-memory registry of what's been uploaded (swap for a SQL table on Day 8)
uploaded_docs: list[dict] = []


class QueryRequest(BaseModel):
    question: str
    top_k: int = 4


@app.get("/")
def health():
    return {"status": "ok", "documents_uploaded": len(uploaded_docs)}


@app.get("/documents")
def list_documents():
    return {"documents": uploaded_docs}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are supported right now.")

    doc_id = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"

    with open(save_path, "wb") as f:
        f.write(await file.read())

    loader = PyPDFLoader(str(save_path))
    pages = loader.load()

    chunks = splitter.split_documents(pages)
    if not chunks:
        raise HTTPException(400, "Could not extract any text from this PDF.")

    # Tag every chunk with where it came from - this is what makes
    # citations possible later (Day 5).
    for chunk in chunks:
        chunk.metadata["source"] = file.filename
        chunk.metadata["doc_id"] = doc_id

    vectorstore.add_documents(chunks)

    record = {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks_added": len(chunks),
    }
    uploaded_docs.append(record)
    return record


@app.post("/query")
def query_documents(req: QueryRequest):
    if not uploaded_docs:
        raise HTTPException(400, "Upload at least one document before querying.")

    # Today: return the raw retrieved chunks so you can manually judge
    # retrieval quality (this is the "test retrieval manually" step).
    # Day 3: these chunks become the context for an LLM prompt instead.
    results = vectorstore.similarity_search_with_score(req.question, k=req.top_k)

    matches = [
    {
        "content": doc.page_content,
        "source": doc.metadata.get("source", "unknown"),
        "page": doc.metadata.get("page", -1) + 1,  # pypdf pages are 0-indexed
        "relevance_score": round(1 - score, 4),
    }
    for doc, score in results
    ]

    return {"question": req.question, "matches": matches}
