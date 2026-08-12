"""
SQLite database via SQLAlchemy. Replaces the in-memory dicts that used to
hold uploaded_docs, document_texts, and conversation_history - those all
vanished on server restart and had no concept of "whose" data anything was.
Now everything is persisted and scoped to a user.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency - yields a session, always closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
