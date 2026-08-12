"""Document lifecycle: upload, list, reset. All scoped to the logged-in user."""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from langchain_community.document_loaders import PyPDFLoader
from sqlalchemy.orm import Session

import rag_engine as engine
from auth import get_current_user
from config import UPLOAD_DIR
from database import get_db
from db_models import Document, User

router = APIRouter(tags=["documents"])


@router.get("/")
def health():
    return {"status": "ok"}


@router.get("/documents")
def list_documents(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return {
        "documents": [
            {
                "doc_id": d.doc_id,
                "filename": d.filename,
                "pages": d.pages,
                "chunks_added": d.chunks_added,
                "uploaded_at": d.uploaded_at,
            }
            for d in docs
        ]
    }


@router.delete("/reset")
def reset_my_documents(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Dev utility: wipes THIS USER's documents, chat history, and vector store
    entries. Scoped to the logged-in user only - does not touch other
    users' data. Use this between test runs instead of manually deleting
    the chroma_db folder (which would be a much bigger hammer now that
    multiple users share it).
    """
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    for doc in docs:
        engine.vectorstore.delete(where={"doc_id": doc.doc_id})
        db.delete(doc)  # cascades to that document's chat_history rows
    db.commit()
    return {"status": "reset", "documents_uploaded": 0}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are supported right now.")

    existing = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.filename == file.filename)
        .first()
    )
    if existing:
        raise HTTPException(
            400,
            f"'{file.filename}' is already uploaded. Call DELETE /reset first if "
            "you want to re-upload it.",
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

    # Tag every chunk with where it came from AND who owns it - doc_id is
    # what retrieval filters on (see rag_engine.answer_question), user_id
    # is stored too so a user's data could be bulk-identified in the vector
    # store directly if ever needed (e.g. a full account-deletion sweep).
    for chunk in chunks:
        chunk.metadata["source"] = file.filename
        chunk.metadata["doc_id"] = doc_id
        chunk.metadata["user_id"] = current_user.id

    engine.vectorstore.add_documents(chunks)

    full_text = "\n\n".join(p.page_content for p in pages)

    doc = Document(
        doc_id=doc_id,
        user_id=current_user.id,
        filename=file.filename,
        pages=len(pages),
        chunks_added=len(chunks),
        full_text=full_text,
    )
    db.add(doc)
    db.commit()

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks_added": len(chunks),
    }
