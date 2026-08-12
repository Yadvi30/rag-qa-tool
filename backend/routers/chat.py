"""Single free-text entry point. Classifies what the user wants, then
dispatches to the same engine functions the dedicated endpoints use."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import rag_engine as engine
from auth import get_current_user
from database import get_db
from db_models import User
from models import ChatRequest
from prompts import FIVE_MARK_PROMPT, TWO_MARK_PROMPT

router = APIRouter(tags=["chat"])


@router.post("/chat")
def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = engine.get_document_text(req.doc_id, current_user.id, db)  # 404s if not owned

    intent_data = engine.classify_intent(req.message)
    intent = intent_data.intent

    try:
        if intent == "summarize":
            summary = engine.summarize_document_text(text)
            return {"intent": intent, "summary": summary}

        elif intent == "quiz":
            count = intent_data.quiz_count
            questions = engine.generate_quiz_items(text, count, "medium")
            return {
                "intent": intent,
                "count_requested": count,
                "quiz": [q.model_dump() for q in questions],
            }

        elif intent == "exam":
            two = intent_data.two_mark_count
            five = intent_data.five_mark_count
            two_mark = engine.generate_items(text, TWO_MARK_PROMPT, two)
            five_mark = engine.generate_items(text, FIVE_MARK_PROMPT, five)
            return {
                "intent": intent,
                "two_mark_questions": two_mark,
                "five_mark_questions": five_mark,
            }

        else:  # "qa"
            result = engine.answer_question(req.message, req.doc_id, current_user.id, db)
            return {"intent": "qa", "question": req.message, **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
