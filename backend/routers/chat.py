"""Single free-text entry point. Classifies what the user wants, then
dispatches to the same engine functions the dedicated endpoints use."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import rag_engine as engine
from auth import get_current_user
from database import get_db
from db_models import User
from models import ChatRequest, ExamGroup
from prompts import EXAM_PROMPT, exam_depth_hint



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
            # Whatever marks values the user actually asked for - not
            # limited to a fixed 2-mark/5-mark pair.
            groups = intent_data.exam_groups or [
                ExamGroup(marks=2, count=5),
                ExamGroup(marks=5, count=5),
            ]
            exam_results = [
                {
                    "marks": g.marks,
                    "count": g.count,
                    "questions": engine.generate_items(
                        text, EXAM_PROMPT, g.count, marks=g.marks, depth_hint=exam_depth_hint(g.marks)
                    ),
                }
                for g in groups
            ]
            return {"intent": intent, "exam_groups": exam_results}

        else:  # "qa"
            result = engine.answer_question(req.message, req.doc_id, current_user.id, db)
            return {"intent": "qa", "question": req.message, **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
