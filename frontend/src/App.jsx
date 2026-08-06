import { useState } from 'react'

// Day 1 scope: upload PDFs, then search them and see the raw retrieved
// chunks. On Day 3, the "matches" section becomes an LLM-generated answer
// instead of raw chunks - the query stays the same, only rendering changes.

const API_BASE = 'http://localhost:8000'

function App() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState([])

  const [question, setQuestion] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)

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

  const handleQuery = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Query failed')
      setMatches(data.matches)
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
        Day 1 build: upload → extract → chunk → embed → retrieve (LLM answer wiring comes Day 3)
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
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          />
          <button onClick={handleQuery} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {matches.length > 0 && (
        <section className="card">
          <h2>Retrieved chunks</h2>
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
