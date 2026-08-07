"""
RAG Q&A Tool - Backend (Day 1 scope)

Pipeline implemented today:
  upload PDF -> extract text -> chunk -> embed -> store in ChromaDB -> retrieve



Run:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""

import os
# ... existing imports stay, plus:
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

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
    chunk_overlap=100,
    separators=["\n\n", "\n", ". ", " ", ""],
)
# Simple in-memory registry of what's been uploaded (swap for a SQL table on Day 8)
uploaded_docs: list[dict] = []

groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    print("WARNING: GROQ_API_KEY not set in .env - /ask will fail until it's added.")

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    api_key=groq_api_key,
)

ANSWER_PROMPT = """You are answering questions using ONLY the context below, taken from \
the user's uploaded documents. Follow these rules strictly:

1. Answer only using the context provided below. Do not use outside knowledge.
2. If the context does not contain enough information to answer, say exactly: \
"I don't have information about this in the uploaded documents." Do not guess or \
make up an answer.
3. Keep the answer concise and directly address the question.
4. Do not mention "the context" or "the provided text" in your answer - answer \
naturally, as if you already knew this.

Context:
{context}

Question: {question}

Answer:"""

class QueryRequest(BaseModel):
    question: str
    top_k: int = 4


@app.get("/")
def health():
    return {"status": "ok", "documents_uploaded": len(uploaded_docs)}


@app.delete("/reset")
def reset_database():
    """
    Dev utility: wipes everything from the vector store and the upload
    registry. Use this between test runs instead of manually stopping the
    server and deleting the chroma_db folder.
    """
    global uploaded_docs
    existing = vectorstore.get()
    ids = existing.get("ids", [])
    if ids:
        vectorstore.delete(ids=ids)
    uploaded_docs = []
    return {"status": "reset", "documents_uploaded": 0}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are supported right now.")

    if any(d["filename"] == file.filename for d in uploaded_docs):
        raise HTTPException(
            400,
            f"'{file.filename}' is already uploaded. Call DELETE /reset first if "
            "you want to re-upload it (re-uploading without resetting creates "
            "duplicate chunks and skews retrieval results).",
        )

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

@app.post("/ask")
def ask_question(req: QueryRequest):
    if not uploaded_docs:
        raise HTTPException(400, "Upload at least one document before asking questions.")

    results = vectorstore.similarity_search_with_score(req.question, k=req.top_k)
    if not results:
        raise HTTPException(400, "No relevant content found for this question.")

    context_blocks = []
    sources = []
    for doc, score in results:
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", -1) + 1
        context_blocks.append(f"[{source}, page {page}]\n{doc.page_content}")
        sources.append({
            "source": source,
            "page": page,
            "relevance_score": round(1 - score, 4),
        })

    context = "\n\n---\n\n".join(context_blocks)
    prompt = ANSWER_PROMPT.format(context=context, question=req.question)

    try:
        response = llm.invoke(prompt)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")

    return {
        "question": req.question,
        "answer": response.content,
        "sources": sources,
    }