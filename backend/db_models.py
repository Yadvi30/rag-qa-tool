"""
ORM models for the three tables this app needs:

  users        - one row per account
  documents    - one row per uploaded PDF, owned by a user, stores the full
                 extracted text (used by /summarize, /quiz, /exam-questions)
  chat_history - one row per message (both user questions and assistant
                 answers), so a conversation survives a server restart and
                 can be shown back to the user as history
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Public-facing unique ID, separate from the internal auto-increment id -
    # this is what's shown to the user (profile card, etc.), not the raw DB row number.
    public_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=_now)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    doc_id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    pages = Column(Integer, default=0)
    chunks_added = Column(Integer, default=0)
    full_text = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=_now)

    owner = relationship("User", back_populates="documents")
    messages = relationship("ChatMessage", back_populates="document", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doc_id = Column(String, ForeignKey("documents.doc_id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)

    document = relationship("Document", back_populates="messages")
