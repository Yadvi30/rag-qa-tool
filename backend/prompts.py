"""
All prompt templates, in one place. Keeping prompts out of the logic/route
files means you can review, tune, or A/B test wording without touching any
actual code - and it keeps the business-logic files focused on control flow
rather than long strings.
"""

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
# A follow-up like "what about for managers?" means nothing to a similarity
# search on its own - it needs to be rewritten into a standalone question
# ("What is the notice period for managers?") using the conversation so far,
# BEFORE retrieval runs. This is a separate LLM call from the one that
# generates the final answer.

CONDENSE_QUESTION_PROMPT = """Given the conversation history below and a new follow-up \
question, rewrite the follow-up question as a standalone question that includes all \
context needed to understand it on its own. If the follow-up question is already \
standalone and doesn't depend on the history, return it unchanged. Output ONLY the \
rewritten question, nothing else.

Conversation history:
{history}

Follow-up question: {question}

Standalone question:"""

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
# actual selectable choices - so this uses with_structured_output (see
# rag_engine.py), instead of asking for free text and hoping it comes back
# formatted consistently.

QUIZ_MCQ_PROMPT = """Based on the following text, generate exactly {n} {difficulty} \
multiple-choice quiz questions. Each question must have exactly 4 answer options, with \
exactly one correct answer that exactly matches one of the 4 options. Cover a range of \
distinct facts spread across the text, not just the beginning. Do not repeat questions.

Text:
{text}"""

DIFFICULTY_DESCRIPTIONS = {
    "easy": "easy (testing basic recall of a specific fact, answerable in one short sentence)",
    "medium": "medium (requiring some understanding, or connecting two related facts)",
    "hard": "hard (requiring deeper reasoning, analysis, or synthesizing multiple parts of the text)",
}

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

ROUTER_PROMPT = """Classify what the user wants to do with their document, and extract \
any question counts they mentioned.

User message: "{message}\""""
