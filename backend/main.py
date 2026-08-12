"""
RAG Q&A Tool - Backend

Pipeline:
  upload PDF -> extract text -> chunk -> embed -> store in ChromaDB -> retrieve
  -> generate a grounded answer / summary / quiz / exam questions via Groq LLM

All document and chat data is scoped to a logged-in user (SQLite + JWT auth).

Structure:
  config.py        env loading, paths, constants
  database.py         SQLAlchemy engine/session setup
  db_models.py           User, Document, ChatMessage ORM models
  auth.py                   password hashing, JWT, get_current_user dependency
  models.py                    all Pydantic request/response + structured-output schemas
  prompts.py                     all prompt templates
  rag_engine.py                     embeddings, vector store, LLM clients, all business logic
  routers/
    auth.py                             register, login, /me
    documents.py                          upload, list, reset
    qa.py                                   ask, raw query (debug), conversation history
    generation.py                             summarize, quiz, exam questions
    chat.py                                     free-text entry point (classifies + dispatches)


"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import Base, engine
from routers import auth, chat, documents, generation, qa

# Creates users / documents / chat_history tables if they don't exist yet.
# Fine for a project this size - a real production app would use Alembic
# migrations instead of this, since this approach can't handle schema
# changes to existing tables.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="RAG Q&A Tool - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(qa.router)
app.include_router(generation.router)
app.include_router(chat.router)
