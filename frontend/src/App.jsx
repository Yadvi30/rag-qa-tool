import { useState } from 'react'

const API_BASE = 'http://localhost:8000'

function QuizList({ questions, selections, onSelect }) {
  return (
    <div className="quiz-list">
      {questions.map((q, i) => {
        const userAnswer = selections[i]
        return (
          <div key={i} className="quiz-question">
            <p className="quiz-q-text">{i + 1}. {q.question}</p>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                let cls = 'quiz-option'
                if (userAnswer !== undefined) {
                  if (opt === q.correct_answer) cls += ' correct'
                  else if (opt === userAnswer) cls += ' incorrect'
                }
                return (
                  <button
                    key={oi}
                    type="button"
                    className={cls}
                    onClick={() => onSelect(i, opt)}
                  >
                    {String.fromCharCode(65 + oi)}. {opt}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function App() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState([])
  const [activeDocId, setActiveDocId] = useState(null)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false) // one request at a time, across all sections

  // --- Ask ---
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)

  // --- Summarize ---
  const [summary, setSummary] = useState(null)

  // --- Quiz ---
  const [quizCount, setQuizCount] = useState(10)
  const [quizDifficulty, setQuizDifficulty] = useState('medium')
  const [quiz, setQuiz] = useState(null)
  const [quizSelections, setQuizSelections] = useState({})

  // --- Free-text / chat ---
  const [chatInput, setChatInput] = useState('')
  const [chatResult, setChatResult] = useState(null)
  const [chatQuizSelections, setChatQuizSelections] = useState({})

  const hasDoc = Boolean(activeDocId)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')
      setDocs((prev) => [...prev, data])
      setActiveDocId(data.doc_id)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim() || !hasDoc) return
    setBusy(true)
    setError('')
    setAnswer(null)
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')
      setAnswer(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSummarize = async () => {
    if (!hasDoc) return
    setBusy(true)
    setError('')
    setSummary(null)
    try {
      const res = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: activeDocId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')
      setSummary(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleQuiz = async () => {
    if (!hasDoc) return
    setBusy(true)
    setError('')
    setQuiz(null)
    setQuizSelections({})
    try {
      const res = await fetch(`${API_BASE}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: activeDocId,
          count: Number(quizCount),
          difficulty: quizDifficulty,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')
      setQuiz(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !hasDoc) return
    setBusy(true)
    setError('')
    setChatResult(null)
    setChatQuizSelections({})
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: activeDocId, message: chatInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')
      setChatResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <h1>RAG Study Assistant</h1>
      <p className="subtitle">Upload a PDF, then ask, summarize, quiz yourself, or type anything.</p>

      {/* --- Upload --- */}
      <section className="card">
        <h2>1. Upload a PDF</h2>
        <div className="row">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        {docs.length > 0 && (
          <div className="doc-select">
            <p className="meta">Active document:</p>
            <select value={activeDocId || ''} onChange={(e) => setActiveDocId(e.target.value)}>
              {docs.map((d) => (
                <option key={d.doc_id} value={d.doc_id}>
                  {d.filename} ({d.pages} pages)
                </option>
              ))}
            </select>
          </div>
        )}
        {!hasDoc && <p className="meta hint">Upload a PDF to unlock the sections below.</p>}
      </section>

      {error && <p className="error">{error}</p>}

      {/* --- Ask --- */}
      <section className="card">
        <h2>2. Ask a question</h2>
        <div className="row">
          <input
            type="text"
            value={question}
            placeholder="e.g. How many days of leave do I get?"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            disabled={!hasDoc}
          />
          <button onClick={handleAsk} disabled={!hasDoc || busy || !question.trim()}>
            Ask
          </button>
        </div>

        {answer && (
          <div className="inline-result">
            <p className="answer-text">{answer.answer}</p>
            <div className="sources">
              <p className="meta">Sources:</p>
              {answer.sources.map((s, i) => (
                <span key={i} className="source-chip">{s.source} · p.{s.page}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* --- Summarize --- */}
      <section className="card">
        <h2>3. Summarize</h2>
        <button onClick={handleSummarize} disabled={!hasDoc || busy}>
          Summarize document
        </button>

        {summary && (
          <div className="inline-result">
            <p className="answer-text">{summary.summary}</p>
          </div>
        )}
      </section>

      {/* --- Quiz --- */}
      <section className="card">
        <h2>4. Quiz me</h2>
        <div className="row">
          <label className="field">
            <span>Difficulty</span>
            <select
              value={quizDifficulty}
              onChange={(e) => setQuizDifficulty(e.target.value)}
              disabled={!hasDoc}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="field">
            <span>Questions</span>
            <input
              type="number"
              min="1"
              max="30"
              value={quizCount}
              onChange={(e) => setQuizCount(e.target.value)}
              disabled={!hasDoc}
            />
          </label>
          <button onClick={handleQuiz} disabled={!hasDoc || busy}>
            Generate quiz
          </button>
        </div>

        {quiz && (
          <div className="inline-result">
            <p className="meta">{quiz.difficulty} · {quiz.count_requested} questions</p>
            <QuizList
              questions={quiz.quiz}
              selections={quizSelections}
              onSelect={(i, opt) => setQuizSelections((prev) => ({ ...prev, [i]: opt }))}
            />
          </div>
        )}
      </section>

      {/* --- Free text / chat --- */}
      <section className="card">
        <h2>5. Or just type what you want</h2>
        <p className="meta">
          e.g. "give me 5 questions worth 2 marks and 5 worth 5 marks" 
        </p>
        <div className="row">
          <input
            type="text"
            value={chatInput}
            placeholder="Type anything about this document..."
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChat()}
            disabled={!hasDoc}
          />
          <button onClick={handleChat} disabled={!hasDoc || busy || !chatInput.trim()}>
            Send
          </button>
        </div>

        {chatResult && (
          <div className="inline-result">
            <p className="meta">
              Detected: <span className="intent-tag">{chatResult.intent}</span>
            </p>

            {chatResult.intent === 'qa' && (
              <>
                <p className="answer-text">{chatResult.answer}</p>
                <div className="sources">
                  <p className="meta">Sources:</p>
                  {chatResult.sources.map((s, i) => (
                    <span key={i} className="source-chip">{s.source} · p.{s.page}</span>
                  ))}
                </div>
              </>
            )}

            {chatResult.intent === 'summarize' && (
              <p className="answer-text">{chatResult.summary}</p>
            )}

            {chatResult.intent === 'quiz' && (
              <QuizList
                questions={chatResult.quiz}
                selections={chatQuizSelections}
                onSelect={(i, opt) => setChatQuizSelections((prev) => ({ ...prev, [i]: opt }))}
              />
            )}

            {chatResult.intent === 'exam' && (
              <>
                <h3>2-mark questions</h3>
                <pre className="generated-block">{chatResult.two_mark_questions}</pre>
                <h3>5-mark questions</h3>
                <pre className="generated-block">{chatResult.five_mark_questions}</pre>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default App