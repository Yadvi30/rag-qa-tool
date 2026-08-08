"""
RAG Q&A Tool - Backend

Pipeline:
  upload PDF -> extract text -> chunk -> embed -> store in ChromaDB -> retrieve
  -> [/ask only] generate a grounded answer via Groq LLM, with citations

Two query endpoints, on purpose:
  /query - returns raw retrieved chunks (useful for debugging retrieval quality)
  /ask   - returns a generated answer + the sources it was built from


"""

import os
import uuid
from pathlib import Path
from typing import Literal
 
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
 
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
 
load_dotenv()
 
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
CHROMA_DIR = "chroma_db"
 
app = FastAPI(title="RAG Q&A Tool - Backend")
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 

print("Loading embedding model (first run downloads ~90MB, be patient)...")
embedding_function = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    encode_kwargs={"normalize_embeddings": True},  # makes distance scores meaningful
)
 
vectorstore = Chroma(
    persist_directory=CHROMA_DIR,
    embedding_function=embedding_function,
    collection_name="documents",
    collection_metadata={"hnsw:space": "cosine"},  # was defaulting to raw L2 distance
)
 

splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " ", ""],
)
 

uploaded_docs: list[dict] = []
 
# Full extracted text per doc_id - separate from the retrieval chunks in
# ChromaDB on purpose. Retrieval chunks (400 chars) are sized for finding a
# specific fact via similarity search. Whole-document tasks like summarizing
# or generating a quiz need broad coverage of the ENTIRE document, not the
# 4 chunks that happen to score highest against a vague query - so they read
# from here instead of going through the vector store at all.
document_texts: dict[str, str] = {}
 
# Conversation history per document - list of {"role": "user"/"assistant",
# "content": str} turns. Used to reformulate follow-up questions into
# standalone questions before retrieval ("what about for managers?" needs
# the prior turn to mean anything to a similarity search).
conversation_history: dict[str, list[dict]] = {}
MAX_HISTORY_TURNS = 6  # keep the last N exchanges, bounds prompt size on long sessions
 
# A second, much larger splitter used only for generation tasks (summary,
# quiz, exam questions). This has nothing to do with retrieval - it exists
# purely to keep each LLM call within a safe context size for long documents.
# For a short document this produces a single chunk (i.e. the whole text),
# and generation happens in one call ("stuff"). For a long document it
# produces several chunks, and generation happens per-chunk then gets
# combined ("map-reduce") - same code path handles both.
generation_splitter = RecursiveCharacterTextSplitter(
    chunk_size=6000,
    chunk_overlap=300,
    separators=["\n\n", "\n", " ", ""],
)
 
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    print("WARNING: GROQ_API_KEY not set in .env - /ask will fail until it's added.")
 
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,  # low temperature: we want it to stick to the retrieved facts, not improvise
    api_key=groq_api_key,
)
 
ANSWER_PROMPT = """You are answering questions using ONLY the context below, taken from \
the user's uploaded documents. Follow these rules strictly:
 
1. Answer only using the context provided below. Do not use outside knowledge.
2. If the context does not contain enough information to answer, say exactly: \
"I don't have information about this in the uploaded documents." Do not guess or \
make up an answer.
3. Keep the answer concise and directly address the question.
4. Do not mention "the context" or "the provided text" in your answer - answer \
naturally, as if you already knew this.
 
Context:
{context}
 
Question: {question}
 
Answer:"""
 
# --- Conversation memory: query reformulation ---
# The key idea in conversational RAG: a follow-up like "what about for
# managers?" means nothing to a similarity search on its own - it needs to
# be rewritten into a standalone question ("What is the notice period for
# managers?") using the conversation so far, BEFORE retrieval runs. This is
# a separate LLM call from the one that generates the final answer.
 
CONDENSE_QUESTION_PROMPT = """Given the conversation history below and a new follow-up \
question, rewrite the follow-up question as a standalone question that includes all \
context needed to understand it on its own. If the follow-up question is already \
standalone and doesn't depend on the history, return it unchanged. Output ONLY the \
rewritten question, nothing else.
 
Conversation history:
{history}
 
Follow-up question: {question}
 
Standalone question:"""
 
 
def format_history(history: list[dict]) -> str:
    lines = [f"{turn['role'].capitalize()}: {turn['content']}" for turn in history]
    return "\n".join(lines)
 
 
def condense_question(question: str, history: list[dict]) -> str:
    if not history:
        return question
    recent = history[-(MAX_HISTORY_TURNS * 2):]
    prompt = CONDENSE_QUESTION_PROMPT.format(history=format_history(recent), question=question)
    return llm.invoke(prompt).content.strip()
 
# --- Summarization prompts (map-reduce pattern) ---
 
SUMMARY_PROMPT = """Write a clear, well-organized summary of the following section of a \
document. Cover the key points. Do not add information not present in the text. Do not \
say "this section" or "this document" - just summarize the content directly.
 
Text:
{text}
 
Summary:"""
 
SUMMARY_REDUCE_PROMPT = """The following are summaries of different sections of the same \
document, in order. Combine them into a single, coherent, well-organized summary of the \
whole document. Remove redundancy between sections. Do not just concatenate them.
 
Section summaries:
{text}
 
Final summary:"""
 
# --- Quiz (multiple choice, structured output) ---
# Unlike the open-ended exam questions below, quiz questions need a fixed
# shape (4 options, one correct answer) that the frontend can render as
# actual selectable choices - so this uses with_structured_output, same
# reliability technique as the router, instead of asking for free text and
# hoping it comes back formatted consistently.
 
 
class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(description="Exactly 4 answer options, in order A-D.")
    correct_answer: str = Field(
        description="The correct option's text - must exactly match one of the 4 options."
    )
 
 
class QuizQuestionSet(BaseModel):
    questions: list[QuizQuestion]
 
 
QUIZ_MCQ_PROMPT = """Based on the following text, generate exactly {n} {difficulty} \
multiple-choice quiz questions. Each question must have exactly 4 answer options, with \
exactly one correct answer that exactly matches one of the 4 options. Cover a range of \
distinct facts spread across the text, not just the beginning. Do not repeat questions.
 
Text:
{text}"""
 
quiz_llm = llm.with_structured_output(QuizQuestionSet)
 
DIFFICULTY_DESCRIPTIONS = {
    "easy": "easy (testing basic recall of a specific fact, answerable in one short sentence)",
    "medium": "medium (requiring some understanding, or connecting two related facts)",
    "hard": "hard (requiring deeper reasoning, analysis, or synthesizing multiple parts of the text)",
}
 
 
def generate_quiz_items(full_text: str, total: int, difficulty: str) -> list[QuizQuestion]:
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
 
 
TWO_MARK_PROMPT = """Based on the following text, generate exactly {n} short-answer exam \
questions worth 2 marks each - each answerable in 1-2 sentences, testing recall of a \
specific fact. Cover distinct facts spread across the text.
 
Format each one exactly like this:
Q: <question>
A: <short expected answer>
 
Text:
{text}"""
 
FIVE_MARK_PROMPT = """Based on the following text, generate exactly {n} exam questions \
worth 5 marks each - each requiring a detailed answer covering multiple points or \
reasoning, not a one-line fact. Cover distinct topics spread across the text.
 
Format each one exactly like this:
Q: <question>
A: <detailed expected answer, 3-5 sentences>
 
Text:
{text}"""
 
# --- Intent router ---
# This is the piece that lets a user type anything - a question, "summarize
# this", "quiz me on this", "give me 5 two-mark and 5 five-mark questions" -
# into ONE input, instead of picking a mode via buttons. One extra LLM call
# classifies what they want (and extracts any numbers they mentioned) before
# dispatching to the function that already handles that task.
#
# Uses LangChain's with_structured_output() instead of asking the model to
# write JSON as plain text and hand-parsing it. This uses the model's native
# tool-calling under the hood, so the output is guaranteed to match the
# schema below - no manual json.loads(), no fallback needed for malformed
# output.
 
 
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
 
 
ROUTER_PROMPT = """Classify what the user wants to do with their document, and extract \
any question counts they mentioned.
 
User message: "{message}\""""
 
router_llm = llm.with_structured_output(RouterIntent)
 
 
def classify_intent(message: str) -> RouterIntent:
    return router_llm.invoke(ROUTER_PROMPT.format(message=message))
 
 
def get_document_text(doc_id: str) -> str:
    text = document_texts.get(doc_id)
    if text is None:
        raise HTTPException(404, f"No document found with doc_id '{doc_id}'.")
    return text
 
 
def summarize_document_text(full_text: str) -> str:
    chunks = generation_splitter.split_text(full_text)
 
    if len(chunks) == 1:
        return llm.invoke(SUMMARY_PROMPT.format(text=chunks[0])).content
 
    # Map: summarize each section independently
    partial_summaries = [
        llm.invoke(SUMMARY_PROMPT.format(text=chunk)).content for chunk in chunks
    ]
    # Reduce: merge the section summaries into one coherent summary
    combined = "\n\n".join(
        f"Section {i + 1}: {s}" for i, s in enumerate(partial_summaries)
    )
    return llm.invoke(SUMMARY_REDUCE_PROMPT.format(text=combined)).content
 
 
def allocate_counts(total: int, num_chunks: int) -> list[int]:
    """Split `total` items as evenly as possible across `num_chunks` buckets."""
    base, remainder = divmod(total, num_chunks)
    return [base + (1 if i < remainder else 0) for i in range(num_chunks)]
 
 
def generate_items(full_text: str, prompt_template: str, total: int, **extra_fields) -> str:
    """
    Shared engine for quiz / 2-mark / 5-mark generation. Unlike summarization,
    a reduce step isn't needed here - questions are independent list items,
    so section outputs can just be concatenated once counts are allocated
    across chunks.
 
    extra_fields lets callers pass additional prompt placeholders beyond
    {text} and {n} - e.g. {difficulty} for the quiz prompt.
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
 
 
@app.get("/")
def health():
    return {"status": "ok", "documents_uploaded": len(uploaded_docs)}
 
 
@app.get("/documents")
def list_documents():
    return {"documents": uploaded_docs}
 
 
@app.delete("/reset")
def reset_database():
    """
    Dev utility: wipes everything from the vector store and the upload
    registry. Use this between test runs instead of manually stopping the
    server and deleting the chroma_db folder - re-uploading the same PDF
    without resetting first is what causes duplicate chunks and skewed
    retrieval results.
    """
    global uploaded_docs
    existing = vectorstore.get()
    ids = existing.get("ids", [])
    if ids:
        vectorstore.delete(ids=ids)
    uploaded_docs = []
    document_texts.clear()
    conversation_history.clear()
    return {"status": "reset", "documents_uploaded": 0}
 
 
@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are supported right now.")
 
    if any(d["filename"] == file.filename for d in uploaded_docs):
        raise HTTPException(
            400,
            f"'{file.filename}' is already uploaded. Call DELETE /reset first if "
            "you want to re-upload it (re-uploading without resetting creates "
            "duplicate chunks and skews retrieval results).",
        )
 
    doc_id = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"
 
    with open(save_path, "wb") as f:
        f.write(await file.read())
 
    loader = PyPDFLoader(str(save_path))
    pages = loader.load()
 
    chunks = splitter.split_documents(pages)
    if not chunks:
        raise HTTPException(400, "Could not extract any text from this PDF.")
 
    # Tag every chunk with where it came from - this is what makes
    # citations possible later (Day 5).
    for chunk in chunks:
        chunk.metadata["source"] = file.filename
        chunk.metadata["doc_id"] = doc_id
 
    vectorstore.add_documents(chunks)
 
    # Store the full, un-chunked text separately - this is what /summarize,
    # /quiz, and /exam-questions read from, since they need the whole
    # document, not similarity-ranked fragments of it.
    document_texts[doc_id] = "\n\n".join(p.page_content for p in pages)
 
    record = {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks_added": len(chunks),
    }
    uploaded_docs.append(record)
    return record
 
 
@app.post("/query")
def query_documents(req: QueryRequest):
    if not uploaded_docs:
        raise HTTPException(400, "Upload at least one document before querying.")
 
    
    results = vectorstore.similarity_search_with_score(req.question, k=req.top_k)
 
    matches = [
        {
            "content": doc.page_content,
            "source": doc.metadata.get("source", "unknown"),
            # pypdf counts pages from 0 - add 1 so citations match what a
            # human sees when they open the PDF (page 1, not page 0).
            "page": doc.metadata.get("page", -1) + 1,
            # With normalized embeddings + cosine space, this is a real
            # similarity score in roughly [0, 1] - 1 = identical, 0 = unrelated.
            "relevance_score": round(1 - score, 4),
        }
        for doc, score in results
    ]
 
    return {"question": req.question, "matches": matches}
 
 
def answer_question(question: str, doc_id: str, top_k: int = 4) -> dict:
    """
    Shared QA engine - retrieval + grounded generation. Used by both /ask
    directly and by /chat once the router decides the user wants a QA
    answer rather than a summary/quiz/exam.
 
    Now conversation-aware: if there's prior history for this doc_id, the
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
 
    # Update memory: store the ORIGINAL question (what the user actually
    # typed), not the reformulated one - that's what a real conversation
    # transcript should read like.
    history.append({"role": "user", "content": question})
    history.append({"role": "assistant", "content": answer_text})
    conversation_history[doc_id] = history[-(MAX_HISTORY_TURNS * 2):]
 
    return {
        "answer": answer_text,
        "sources": sources,
        "standalone_question": standalone_question if standalone_question != question else None,
    }
 
 
@app.post("/ask")
def ask_question(req: QueryRequest):
    if not uploaded_docs:
        raise HTTPException(400, "Upload at least one document before asking questions.")
    if req.doc_id not in document_texts:
        raise HTTPException(404, f"No document found with doc_id '{req.doc_id}'.")
 
    result = answer_question(req.question, req.doc_id, req.top_k)
    return {"question": req.question, **result}
 
 
@app.delete("/conversation/{doc_id}")
def clear_conversation(doc_id: str):
    """Clears just this document's chat memory - lets the user start a fresh
    conversation without resetting uploaded documents."""
    conversation_history.pop(doc_id, None)
    return {"status": "cleared", "doc_id": doc_id}
 
 
@app.post("/summarize")
def summarize_document(req: DocRequest):
    """
    Whole-document task - does NOT use vector retrieval. Reads the full text
    directly, since a good summary needs the entire document, not the top-k
    chunks most similar to some query (there's no meaningful query to search
    for here).
    """
    text = get_document_text(req.doc_id)
    try:
        summary = summarize_document_text(text)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
    return {"doc_id": req.doc_id, "summary": summary}
 
 
@app.post("/quiz")
def generate_quiz(req: QuizRequest):
    """Whole-document task, same reasoning as /summarize - reads full text directly."""
    text = get_document_text(req.doc_id)
    try:
        questions = generate_quiz_items(text, req.count, req.difficulty)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
    return {
        "doc_id": req.doc_id,
        "count_requested": req.count,
        "difficulty": req.difficulty,
        "quiz": [q.model_dump() for q in questions],
    }
 
 
@app.post("/exam-questions")
def generate_exam_questions(req: ExamRequest):
    """
    Marks-weighted exam questions. Two separate generation passes over the
    same document - one prompted for short 2-mark recall questions, one for
    longer 5-mark explanatory questions - since these need genuinely
    different question depth, not just a count difference.
    """
    text = get_document_text(req.doc_id)
    try:
        two_mark = generate_items(text, TWO_MARK_PROMPT, req.two_mark_count)
        five_mark = generate_items(text, FIVE_MARK_PROMPT, req.five_mark_count)
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")
 
    return {
        "doc_id": req.doc_id,
        "two_mark_questions": two_mark,
        "five_mark_questions": five_mark,
    }
 
 
@app.post("/chat")
def chat(req: ChatRequest):
    """
    Single entry point for free-text input. Classifies what the user wants,
    then dispatches to the same functions /ask, /summarize, /quiz, and
    /exam-questions already use - no logic is duplicated here, this is
    purely routing.
    """
    # Confirms the document exists before spending a call on classification
    text = get_document_text(req.doc_id)
 
    intent_data = classify_intent(req.message)
    intent = intent_data.intent
 
    try:
        if intent == "summarize":
            summary = summarize_document_text(text)
            return {"intent": intent, "summary": summary}
 
        elif intent == "quiz":
            count = intent_data.quiz_count
            questions = generate_quiz_items(text, count, "medium")
            return {
                "intent": intent,
                "count_requested": count,
                "quiz": [q.model_dump() for q in questions],
            }
 
        elif intent == "exam":
            two = intent_data.two_mark_count
            five = intent_data.five_mark_count
            two_mark = generate_items(text, TWO_MARK_PROMPT, two)
            five_mark = generate_items(text, FIVE_MARK_PROMPT, five)
            return {
                "intent": intent,
                "two_mark_questions": two_mark,
                "five_mark_questions": five_mark,
            }
 
        else:  # "qa"
            result = answer_question(req.message, req.doc_id)
            return {"intent": "qa", "question": req.message, **result}
 
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"LLM call failed - check GROQ_API_KEY in .env. ({e})")