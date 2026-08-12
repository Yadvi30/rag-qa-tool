"""Whole-document generation: summarize, quiz (MCQ), and marks-weighted
exam questions - scoped to the logged-in user's own documents."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import rag_engine as engine
from auth import get_current_user
from database import get_db
from db_models import User
from models import DocRequest, ExamRequest, QuizRequest
from prompts import FIVE_MARK_PROMPT, TWO_MARK_PROMPT

router = APIRouter(tags=["generation"])


@router.post("/summarize")
def summarize_document(
    req: DocRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = engine.get_document_text(req.doc_id, current_user.id, db)
    try:
        summary = engine.summarize_document_text(text)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
    return {"doc_id": req.doc_id, "summary": summary}


@router.post("/quiz")
def generate_quiz(
    req: QuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = engine.get_document_text(req.doc_id, current_user.id, db)
    try:
        questions = engine.generate_quiz_items(text, req.count, req.difficulty)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
    return {
        "doc_id": req.doc_id,
        "count_requested": req.count,
        "difficulty": req.difficulty,
        "quiz": [q.model_dump() for q in questions],
    }


@router.post("/exam-questions")
def generate_exam_questions(
    req: ExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = engine.get_document_text(req.doc_id, current_user.id, db)
    try:
        two_mark = engine.generate_items(text, TWO_MARK_PROMPT, req.two_mark_count)
        five_mark = engine.generate_items(text, FIVE_MARK_PROMPT, req.five_mark_count)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")

    return {
        "doc_id": req.doc_id,
        "two_mark_questions": two_mark,
        "five_mark_questions": five_mark,
    }
