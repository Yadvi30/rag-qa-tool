"""
Environment loading, filesystem paths, and constants shared across the app.
Nothing in here should depend on any other local module - this sits at the
bottom of the dependency graph.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

CHROMA_DIR = "chroma_db"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY not set in .env - /ask will fail until it's added.")

LLM_MODEL = "llama-3.3-70b-versatile"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Conversation memory: how many past exchanges to keep per document,
# bounds prompt size on long chat sessions.
MAX_HISTORY_TURNS = 6

CORS_ORIGINS = ["http://localhost:5173"]  # Vite's default dev port

# --- Auth / database ---

DATABASE_URL = "sqlite:///./app.db"

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    print(
        "WARNING: JWT_SECRET_KEY not set in .env - using an insecure default. "
        "Set a real random value before this goes anywhere near production."
    )
    JWT_SECRET_KEY = "dev-only-insecure-secret-change-me"

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week
