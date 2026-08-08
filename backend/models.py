"""
Pydantic schemas - both request bodies and the structured-output schemas
used with LangChain's with_structured_output(). Keeping these separate from
route handlers and business logic makes the "shape" of the API easy to scan
in one place.
"""

from typing import Literal

from pydantic import BaseModel, Field


# --- Request bodies ---

class DocRequest(BaseModel):
    doc_id: str


class QuizRequest(BaseModel):
    doc_id: str
    count: int = 10
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class ExamRequest(BaseModel):
    doc_id: str
    two_mark_count: int = 5
    five_mark_count: int = 5


class ChatRequest(BaseModel):
    doc_id: str
    message: str


class QueryRequest(BaseModel):
    doc_id: str
    question: str
    top_k: int = 4


# --- Structured LLM output schemas ---
# Used with llm.with_structured_output(...) so the model's output is
# guaranteed to match this shape via native tool-calling, instead of asking
# for free text and hoping it parses.

class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(description="Exactly 4 answer options, in order A-D.")
    correct_answer: str = Field(
        description="The correct option's text - must exactly match one of the 4 options."
    )


class QuizQuestionSet(BaseModel):
    questions: list[QuizQuestion]


class RouterIntent(BaseModel):
    intent: Literal["qa", "summarize", "quiz", "exam"] = Field(
        description=(
            "'qa' if the user is asking a specific question about the document. "
            "'summarize' if they want an overview/summary. "
            "'quiz' if they want quiz questions with answers generated. "
            "'exam' if they want exam-style questions split by marks "
            "(mentions '2 mark' / '5 mark' / 'marks' explicitly)."
        )
    )
    quiz_count: int = Field(
        default=10,
        description="Number of quiz questions requested, if intent is 'quiz'. "
        "Use the number the user mentioned, else 10.",
    )
    two_mark_count: int = Field(
        default=5,
        description="Number of 2-mark questions requested, if intent is 'exam'. "
        "Use the number the user mentioned, else 5.",
    )
    five_mark_count: int = Field(
        default=5,
        description="Number of 5-mark questions requested, if intent is 'exam'. "
        "Use the number the user mentioned, else 5.",
    )
