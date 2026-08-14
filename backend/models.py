"""
Pydantic schemas - both request bodies and the structured-output schemas
used with LangChain's with_structured_output(). Keeping these separate from
route handlers and business logic makes the "shape" of the API easy to scan
in one place.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Auth ---

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # lets this read directly from an ORM object

    public_id: str
    name: str
    email: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class ChatHistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime



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
    persist: bool = True  # False for calls that shouldn't show up in the Ask tab's saved history


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


# --- Mindmap ---
# Fixed 3-level structure (document -> branches -> sub-points), NOT
# self-referencing. Groq's (and most providers') structured output doesn't
# reliably support recursive/self-referencing schemas - a node containing a
# list of itself - so this uses three distinct classes instead. This also
# matches the "at most 3 levels deep" rule we always wanted, just enforced
# by the schema itself now instead of hoping the model follows a prompt
# instruction.

class MindmapLeaf(BaseModel):
    title: str = Field(description="Short label for this sub-point - a few words, not a sentence.")


class MindmapBranch(BaseModel):
    title: str = Field(description="Short label for this branch - a few words, not a sentence.")
    children: list[MindmapLeaf] = Field(
        default_factory=list,
        description="2-5 sub-points under this branch, if the content genuinely supports them. Empty list if none.",
    )


class Mindmap(BaseModel):
    title: str = Field(description="Short label for the whole document - a few words.")
    children: list[MindmapBranch] = Field(
        description="3-6 main branches covering the document's major sections or themes."
    )


class ExamGroup(BaseModel):
    marks: int = Field(description="Marks value for this group of questions, e.g. 1, 2, 5, 10 - whatever the user said.")
    count: int = Field(description="How many questions the user wants at this marks value.")


class RouterIntent(BaseModel):
    intent: Literal["qa", "summarize", "quiz", "exam"] = Field(
        description=(
            "'qa' if the user is asking a specific question about the document. "
            "'summarize' if they want an overview/summary. "
            "'quiz' if they want quiz questions with answers generated. "
            "'exam' if they want exam-style questions split by marks - any marks "
            "value, not just 2 or 5 (e.g. '5 questions for 1 mark' is valid)."
        )
    )
    quiz_count: int = Field(
        default=10,
        description="Number of quiz questions requested, if intent is 'quiz'. "
        "Use the number the user mentioned, else 10.",
    )
    exam_groups: list[ExamGroup] = Field(
        default_factory=list,
        description=(
            "For 'exam' intent only: one entry per distinct marks value the user "
            "mentioned, with however many questions they asked for at that value. "
            "E.g. '5 questions for 1 mark' -> [{marks:1, count:5}]. "
            "'5 for 2 marks and 3 for 10 marks' -> [{marks:2,count:5},{marks:10,count:3}]. "
            "If they said 'exam questions' with no specifics at all, default to "
            "[{marks:2,count:5},{marks:5,count:5}]."
        ),
    )