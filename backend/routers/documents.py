"""Document lifecycle: upload, list, reset."""

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from langchain_community.document_loaders import PyPDFLoader

import rag_engine as engine
from config import UPLOAD_DIR

router = APIRouter(tags=["documents"])


@router.get("/")
def health():
    return {"status": "ok", "documents_uploaded": len(engine.uploaded_docs)}


@router.get("/documents")
def list_documents():
    return {"documents": engine.uploaded_docs}


@router.delete("/reset")
def reset_database():
    """
    Dev utility: wipes everything from the vector store, upload registry,
    document texts, and conversation history. Use this between test runs
    instead of manually stopping the server and deleting the chroma_db
    folder - re-uploading the same PDF without resetting first is what
    causes duplicate chunks and skewed retrieval results.
    """
    existing = engine.vectorstore.get()
    ids = existing.get("ids", [])
    if ids:
        engine.vectorstore.delete(ids=ids)
    engine.uploaded_docs.clear()
    engine.document_texts.clear()
    engine.conversation_history.clear()
    return {"status": "reset", "documents_uploaded": 0}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are supported right now.")

    if any(d["filename"] == file.filename for d in engine.uploaded_docs):
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

    chunks = engine.retrieval_splitter.split_documents(pages)
    if not chunks:
        raise HTTPException(400, "Could not extract any text from this PDF.")

    # Tag every chunk with where it came from - this is what makes
    # citations possible.
    for chunk in chunks:
        chunk.metadata["source"] = file.filename
        chunk.metadata["doc_id"] = doc_id

    engine.vectorstore.add_documents(chunks)

    # Store the full, un-chunked text separately - this is what /summarize,
    # /quiz, and /exam-questions read from, since they need the whole
    # document, not similarity-ranked fragments of it.
    engine.document_texts[doc_id] = "\n\n".join(p.page_content for p in pages)

    record = {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks_added": len(chunks),
    }
    engine.uploaded_docs.append(record)
    return record
