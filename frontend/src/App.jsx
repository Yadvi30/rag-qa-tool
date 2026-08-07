import { useState } from 'react'

// /ask   -> LLM-generated answer, grounded in retrieved chunks, with citations
// /query -> raw retrieved chunks only (kept around for debugging retrieval quality)

const API_BASE = 'http://localhost:8000'

function App() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState([])

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  const [error, setError] = useState('')

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
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError('')
    setAnswer(null)
    setMatches([])

    const endpoint = debugMode ? '/query' : '/ask'

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')

      if (debugMode) {
        setMatches(data.matches)
      } else {
        setAnswer(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>RAG Q&amp;A Tool</h1>
      <p className="subtitle">
        Upload PDFs, ask questions, get answers grounded in your documents with citations.
      </p>

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
          <ul className="doc-list">
            {docs.map((d) => (
              <li key={d.doc_id}>
                {d.filename} — {d.chunks_added} chunks from {d.pages} pages
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>2. Ask a question</h2>
        <div className="row">
          <input
            type="text"
            value={question}
            placeholder="Ask something about your uploaded documents..."
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button onClick={handleAsk} disabled={loading}>
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
          />
          Debug mode (show raw retrieved chunks instead of a generated answer)
        </label>
      </section>

      {error && <p className="error">{error}</p>}

      {answer && (
        <section className="card">
          <h2>Answer</h2>
          <p className="answer-text">{answer.answer}</p>
          <div className="sources">
            <p className="meta">Sources:</p>
            {answer.sources.map((s, i) => (
              <span key={i} className="source-chip">
                {s.source} · p.{s.page}
              </span>
            ))}
          </div>
        </section>
      )}

      {matches.length > 0 && (
        <section className="card">
          <h2>Retrieved chunks (debug)</h2>
          {matches.map((m, i) => (
            <div key={i} className="match">
              <p className="meta">
                Source: {m.source} · Page {m.page} · Score {m.relevance_score}
              </p>
              <p>{m.content}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export default App