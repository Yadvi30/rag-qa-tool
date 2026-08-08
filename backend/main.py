"""
RAG Q&A Tool - Backend

Pipeline:
  upload PDF -> extract text -> chunk -> embed -> store in ChromaDB -> retrieve
  -> generate a grounded answer / summary / quiz / exam questions via Groq LLM

Structure:
  config.py        env loading, paths, constants
  models.py         all Pydantic request/response + structured-output schemas
  prompts.py         all prompt templates
  rag_engine.py        embeddings, vector store, LLM clients, all business logic
  routers/
    documents.py         upload, list, reset
    qa.py                  ask, raw query (debug), conversation memory
    generation.py            summarize, quiz, exam questions
    chat.py                    free-text entry point (classifies + dispatches)

This file just wires the app together - it should stay small. Route
handlers and business logic live in the modules above, not here.


"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routers import chat, documents, generation, qa

app = FastAPI(title="RAG Q&A Tool - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(qa.router)
app.include_router(generation.router)
app.include_router(chat.router)
