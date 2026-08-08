"""Question answering: /ask (grounded answer), /query (raw retrieval, for
debugging), and conversation memory management."""

from fastapi import APIRouter, HTTPException

import rag_engine as engine
from models import QueryRequest

router = APIRouter(tags=["qa"])


@router.post("/query")
def query_documents(req: QueryRequest):
    """
    Returns raw retrieved chunks instead of a generated answer - useful for
    debugging retrieval quality independent of the LLM (e.g. "is the right
    chunk even being found?" vs "is the LLM answering it well?").
    """
    if not engine.uploaded_docs:
        raise HTTPException(400, "Upload at least one document before querying.")

    results = engine.vectorstore.similarity_search_with_score(req.question, k=req.top_k)

    matches = [
        {
            "content": doc.page_content,
            "source": doc.metadata.get("source", "unknown"),
            # pypdf counts pages from 0 - add 1 so citations match what a
            # human sees when they open the PDF (page 1, not page 0).
            "page": doc.metadata.get("page", -1) + 1,
            # With normalized embeddings + cosine space, this is a real
            # similarity score in roughly [0, 1] - 1 = identical, 0 = unrelated.
            "relevance_score": round(1 - score, 4),
        }
        for doc, score in results
    ]

    return {"question": req.question, "matches": matches}


@router.post("/ask")
def ask_question(req: QueryRequest):
    if not engine.uploaded_docs:
        raise HTTPException(400, "Upload at least one document before asking questions.")
    if req.doc_id not in engine.document_texts:
        raise HTTPException(404, f"No document found with doc_id '{req.doc_id}'.")

    result = engine.answer_question(req.question, req.doc_id, req.top_k)
    return {"question": req.question, **result}


@router.delete("/conversation/{doc_id}")
def clear_conversation(doc_id: str):
    """Clears just this document's chat memory - lets the user start a fresh
    conversation without resetting uploaded documents."""
    engine.conversation_history.pop(doc_id, None)
    return {"status": "cleared", "doc_id": doc_id}
