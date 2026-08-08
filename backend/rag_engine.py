"""
Core RAG engine: embeddings, vector store, LLM clients, and every function
that actually does retrieval or generation. Routers call into this module -
they should contain almost no logic of their own, just request/response
handling and calls into here.
"""

from fastapi import HTTPException
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_groq import ChatGroq
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import CHROMA_DIR, EMBEDDING_MODEL, GROQ_API_KEY, LLM_MODEL, MAX_HISTORY_TURNS
from models import QuizQuestion, QuizQuestionSet, RouterIntent
from prompts import (
    ANSWER_PROMPT,
    CONDENSE_QUESTION_PROMPT,
    DIFFICULTY_DESCRIPTIONS,
    QUIZ_MCQ_PROMPT,
    ROUTER_PROMPT,
    SUMMARY_PROMPT,
    SUMMARY_REDUCE_PROMPT,
)

# --- Embeddings + vector store (retrieval) ---
# Local, free embedding model - no API key needed for retrieval itself.
print("Loading embedding model (first run downloads ~90MB, be patient)...")
embedding_function = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL,
    encode_kwargs={"normalize_embeddings": True},  # makes distance scores meaningful
)

vectorstore = Chroma(
    persist_directory=CHROMA_DIR,
    embedding_function=embedding_function,
    collection_name="documents",
    collection_metadata={"hnsw:space": "cosine"},  # was defaulting to raw L2 distance
)

# Chunking strategy - reduced from 1000 to 400 after Day 1 testing showed
# large chunks were merging multiple unrelated sections together, diluting
# the embedding signal and letting an off-topic chunk outrank the correct one.
retrieval_splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " ", ""],
)

# A second, much larger splitter used only for generation tasks (summary,
# quiz, exam questions). This has nothing to do with retrieval - it exists
# purely to keep each LLM call within a safe context size for long documents.
# For a short document this produces a single chunk (i.e. the whole text),
# and generation happens in one call ("stuff"). For a long document it
# produces several chunks, and generation happens per-chunk then gets
# combined ("map-reduce"). Same code path handles both.
generation_splitter = RecursiveCharacterTextSplitter(
    chunk_size=6000,
    chunk_overlap=300,
    separators=["\n\n", "\n", " ", ""],
)

# --- LLM clients ---

llm = ChatGroq(model=LLM_MODEL, temperature=0, api_key=GROQ_API_KEY)

# Structured-output variants: same underlying model, but guarantee the
# response matches a schema via native tool-calling, instead of asking for
# free text and hand-parsing it.
quiz_llm = llm.with_structured_output(QuizQuestionSet)
router_llm = llm.with_structured_output(RouterIntent)

# --- In-memory state (swap for a real DB when auth is added) ---

uploaded_docs: list[dict] = []
document_texts: dict[str, str] = {}  # doc_id -> full extracted text
conversation_history: dict[str, list[dict]] = {}  # doc_id -> [{"role", "content"}, ...]


# --- Document access helpers ---

def get_document_text(doc_id: str) -> str:
    text = document_texts.get(doc_id)
    if text is None:
        raise HTTPException(404, f"No document found with doc_id '{doc_id}'.")
    return text


# --- Conversation memory / query reformulation ---

def format_history(history: list[dict]) -> str:
    lines = [f"{turn['role'].capitalize()}: {turn['content']}" for turn in history]
    return "\n".join(lines)


def condense_question(question: str, history: list[dict]) -> str:
    if not history:
        return question
    recent = history[-(MAX_HISTORY_TURNS * 2):]
    prompt = CONDENSE_QUESTION_PROMPT.format(history=format_history(recent), question=question)
    return llm.invoke(prompt).content.strip()


# --- QA (retrieval + grounded generation) ---

def answer_question(question: str, doc_id: str, top_k: int = 4) -> dict:
    """
    Shared QA engine - retrieval + grounded generation. Used by both /ask
    directly and by /chat once the router decides the user wants a QA
    answer rather than a summary/quiz/exam.

    Conversation-aware: if there's prior history for this doc_id, the
    question is first reformulated into a standalone question (resolving
    things like "what about for managers?") before retrieval runs.
    """
    history = conversation_history.get(doc_id, [])
    standalone_question = condense_question(question, history)

    results = vectorstore.similarity_search_with_score(standalone_question, k=top_k)
    if not results:
        raise HTTPException(400, "No relevant content found for this question.")

    context_blocks = []
    sources = []
    for doc, score in results:
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", -1) + 1
        context_blocks.append(f"[{source}, page {page}]\n{doc.page_content}")
        sources.append({
            "source": source,
            "page": page,
            "relevance_score": round(1 - score, 4),
        })

    context = "\n\n---\n\n".join(context_blocks)
    prompt = ANSWER_PROMPT.format(context=context, question=standalone_question)

    try:
        response = llm.invoke(prompt)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")

    answer_text = response.content

    # Store the ORIGINAL question (what the user actually typed), not the
    # reformulated one - that's what a real conversation transcript should read like.
    history.append({"role": "user", "content": question})
    history.append({"role": "assistant", "content": answer_text})
    conversation_history[doc_id] = history[-(MAX_HISTORY_TURNS * 2):]

    return {
        "answer": answer_text,
        "sources": sources,
        "standalone_question": standalone_question if standalone_question != question else None,
    }


# --- Summarization (map-reduce) ---

def summarize_document_text(full_text: str) -> str:
    chunks = generation_splitter.split_text(full_text)

    if len(chunks) == 1:
        return llm.invoke(SUMMARY_PROMPT.format(text=chunks[0])).content

    partial_summaries = [
        llm.invoke(SUMMARY_PROMPT.format(text=chunk)).content for chunk in chunks
    ]
    combined = "\n\n".join(
        f"Section {i + 1}: {s}" for i, s in enumerate(partial_summaries)
    )
    return llm.invoke(SUMMARY_REDUCE_PROMPT.format(text=combined)).content


# --- Quiz / exam question generation ---

def allocate_counts(total: int, num_chunks: int) -> list[int]:
    """Split `total` items as evenly as possible across `num_chunks` buckets."""
    base, remainder = divmod(total, num_chunks)
    return [base + (1 if i < remainder else 0) for i in range(num_chunks)]


def generate_items(full_text: str, prompt_template: str, total: int, **extra_fields) -> str:
    """
    Shared engine for open-ended (2-mark / 5-mark) question generation.
    Unlike summarization, no reduce step is needed - questions are
    independent list items, so section outputs just concatenate once counts
    are allocated across chunks.
    """
    chunks = generation_splitter.split_text(full_text)
    counts = allocate_counts(total, len(chunks))

    parts = []
    for chunk, n in zip(chunks, counts):
        if n == 0:
            continue
        prompt = prompt_template.format(text=chunk, n=n, **extra_fields)
        parts.append(llm.invoke(prompt).content)

    return "\n\n".join(parts)


def generate_quiz_items(full_text: str, total: int, difficulty: str) -> list[QuizQuestion]:
    """MCQ quiz generation via structured output - guarantees exactly 4
    options and one correct answer per question, no text parsing needed."""
    chunks = generation_splitter.split_text(full_text)
    counts = allocate_counts(total, len(chunks))
    difficulty_text = DIFFICULTY_DESCRIPTIONS[difficulty]

    all_questions: list[QuizQuestion] = []
    for chunk, n in zip(chunks, counts):
        if n == 0:
            continue
        prompt = QUIZ_MCQ_PROMPT.format(text=chunk, n=n, difficulty=difficulty_text)
        result = quiz_llm.invoke(prompt)
        all_questions.extend(result.questions)

    return all_questions


# --- Intent router ---

def classify_intent(message: str) -> RouterIntent:
    return router_llm.invoke(ROUTER_PROMPT.format(message=message))
