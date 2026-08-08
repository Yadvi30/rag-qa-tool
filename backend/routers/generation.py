"""Whole-document generation: summarize, quiz (MCQ), and marks-weighted
exam questions. None of these use vector retrieval - they read the full
document text directly, since these tasks need broad coverage, not the
top-k chunks most similar to some query."""

from fastapi import APIRouter, HTTPException

import rag_engine as engine
from models import DocRequest, ExamRequest, QuizRequest
from prompts import FIVE_MARK_PROMPT, TWO_MARK_PROMPT

router = APIRouter(tags=["generation"])


@router.post("/summarize")
def summarize_document(req: DocRequest):
    text = engine.get_document_text(req.doc_id)
    try:
        summary = engine.summarize_document_text(text)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
    return {"doc_id": req.doc_id, "summary": summary}


@router.post("/quiz")
def generate_quiz(req: QuizRequest):
    text = engine.get_document_text(req.doc_id)
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
def generate_exam_questions(req: ExamRequest):
    """
    Marks-weighted exam questions. Two separate generation passes over the
    same document - one prompted for short 2-mark recall questions, one for
    longer 5-mark explanatory questions - since these need genuinely
    different question depth, not just a count difference.
    """
    text = engine.get_document_text(req.doc_id)
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
