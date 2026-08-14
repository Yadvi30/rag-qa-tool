"""Question answering: /ask (grounded answer), /query (raw retrieval, for
debugging), and conversation history - all scoped to the logged-in user."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import rag_engine as engine
from auth import get_current_user
from database import get_db
from db_models import ChatMessage, User
from models import ChatHistoryTurn, QueryRequest

router = APIRouter(tags=["qa"])


@router.post("/query")
def query_documents(
    req: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns raw retrieved chunks instead of a generated answer - useful for
    debugging retrieval quality independent of the LLM.
    """
    engine.get_owned_document(req.doc_id, current_user.id, db)  # 404s if not this user's

    results = engine.vectorstore.similarity_search_with_score(
        req.question, k=req.top_k, filter={"doc_id": req.doc_id}
    )

    matches = [
        {
            "content": doc.page_content,
            "source": doc.metadata.get("source", "unknown"),
            "page": doc.metadata.get("page", -1) + 1,
            "relevance_score": round(1 - score, 4),
        }
        for doc, score in results
    ]

    return {"question": req.question, "matches": matches}


@router.post("/ask")
def ask_question(
    req: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = engine.answer_question(
        req.question, req.doc_id, current_user.id, db, req.top_k, persist=req.persist
    )
    return {"question": req.question, **result}


@router.get("/conversation/{doc_id}", response_model=list[ChatHistoryTurn])
def get_conversation(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns this user's full persisted chat history for a document -
    survives server restarts, unlike the old in-memory version."""
    engine.get_owned_document(doc_id, current_user.id, db)  # 404s if not this user's

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.doc_id == doc_id, ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages


@router.delete("/conversation/{doc_id}")
def clear_conversation(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clears just this document's chat history - lets the user start a
    fresh conversation without deleting the document itself."""
    engine.get_owned_document(doc_id, current_user.id, db)  # 404s if not this user's

    db.query(ChatMessage).filter(
        ChatMessage.doc_id == doc_id, ChatMessage.user_id == current_user.id
    ).delete()
    db.commit()
    return {"status": "cleared", "doc_id": doc_id}