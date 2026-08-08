"""Single free-text entry point. Classifies what the user wants, then
dispatches to the same engine functions the dedicated endpoints use - no
logic is duplicated here, this file is purely routing."""

from fastapi import APIRouter, HTTPException

import rag_engine as engine
from models import ChatRequest
from prompts import FIVE_MARK_PROMPT, TWO_MARK_PROMPT

router = APIRouter(tags=["chat"])


@router.post("/chat")
def chat(req: ChatRequest):
    # Confirms the document exists before spending a call on classification
    text = engine.get_document_text(req.doc_id)

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
            result = engine.answer_question(req.message, req.doc_id)
            return {"intent": "qa", "question": req.message, **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
