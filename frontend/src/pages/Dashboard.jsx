import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'
import QuizList from '../components/QuizList'
import ProfileCard from '../components/ProfileCard'

const cardClass =
  'bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl p-5 shadow-sm'
const inputClass =
  'flex-1 min-w-[160px] px-3 py-2.5 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50'
const primaryBtnClass =
  'px-5 py-2.5 rounded-md text-sm font-semibold bg-emerald-500 text-teal-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'

function Dashboard() {
  const { token, user } = useAuth()

  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [activeDocId, setActiveDocId] = useState(null)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // --- Ask / Chat tabs ---
  const [activeTab, setActiveTab] = useState('ask') // 'ask' | 'chat'

  // --- Ask (conversation thread, per document) ---
  const [question, setQuestion] = useState('')
  const [threads, setThreads] = useState({})
  const [threadLoading, setThreadLoading] = useState(false)

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

  useEffect(() => {
    apiFetch('/documents', { token })
      .then((data) => {
        setDocs(data.documents)
        if (data.documents.length > 0) setActiveDocId(data.documents[0].doc_id)
      })
      .catch((err) => setError(err.message))
      .finally(() => setDocsLoading(false))
  }, [token])

  useEffect(() => {
    if (!activeDocId) return
    if (threads[activeDocId]) return

    setThreadLoading(true)
    apiFetch(`/conversation/${activeDocId}`, { token })
      .then((history) => {
        const turns = []
        for (let i = 0; i < history.length; i += 2) {
          const userTurn = history[i]
          const assistantTurn = history[i + 1]
          if (userTurn && assistantTurn) {
            turns.push({
              question: userTurn.content,
              answer: assistantTurn.content,
              sources: [],
              standalone_question: null,
            })
          }
        }
        setThreads((prev) => ({ ...prev, [activeDocId]: turns }))
      })
      .catch(() => {
        setThreads((prev) => ({ ...prev, [activeDocId]: prev[activeDocId] || [] }))
      })
      .finally(() => setThreadLoading(false))
  }, [activeDocId, token, threads])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const data = await apiFetch('/upload', {
        method: 'POST',
        body: formData,
        token,
        isFormData: true,
      })
      setDocs((prev) => [...prev, data])
      setActiveDocId(data.doc_id)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const currentThread = threads[activeDocId] || []

  const handleAsk = async () => {
    if (!question.trim() || !hasDoc) return
    const askedQuestion = question
    setBusy(true)
    setError('')
    setQuestion('')
    try {
      const data = await apiFetch('/ask', {
        method: 'POST',
        token,
        body: { doc_id: activeDocId, question: askedQuestion },
      })
      setThreads((prev) => ({
        ...prev,
        [activeDocId]: [
          ...(prev[activeDocId] || []),
          {
            question: askedQuestion,
            answer: data.answer,
            sources: data.sources,
            standalone_question: data.standalone_question,
          },
        ],
      }))
    } catch (err) {
      setError(err.message)
      setQuestion(askedQuestion)
    } finally {
      setBusy(false)
    }
  }

  const handleNewConversation = async () => {
    if (!hasDoc) return
    try {
      await apiFetch(`/conversation/${activeDocId}`, { method: 'DELETE', token })
    } catch {
      // non-critical
    }
    setThreads((prev) => ({ ...prev, [activeDocId]: [] }))
  }

  const handleSummarize = async () => {
    if (!hasDoc) return
    setBusy(true)
    setError('')
    setSummary(null)
    try {
      const data = await apiFetch('/summarize', {
        method: 'POST',
        token,
        body: { doc_id: activeDocId },
      })
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
      const data = await apiFetch('/quiz', {
        method: 'POST',
        token,
        body: { doc_id: activeDocId, count: Number(quizCount), difficulty: quizDifficulty },
      })
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
      const data = await apiFetch('/chat', {
        method: 'POST',
        token,
        body: { doc_id: activeDocId, message: chatInput },
      })
      setChatResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-[820px] mx-auto px-6 py-10 flex flex-col gap-6">
      {/* --- Section 1: greeting (left) + profile card (right) --- */}
      <section className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-stretch">
        <div className="flex flex-col justify-center">
          <h1 className="font-display text-[28px] font-semibold m-0 mb-2 text-teal-900 dark:text-white">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-teal-900/70 dark:text-emerald-100/70 m-0">
            Upload a PDF, then ask, summarize, quiz yourself, or type anything.
          </p>
        </div>
        <ProfileCard />
      </section>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-md px-3 py-2 m-0">
          {error}
        </p>
      )}

      {/* --- Section 2: Upload --- */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold mb-3.5 text-teal-900 dark:text-white">Upload a PDF</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="flex-1 min-w-[200px] text-sm text-teal-900/70 dark:text-emerald-100/70 file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-emerald-100 file:text-emerald-700 dark:file:bg-emerald-950 dark:file:text-emerald-400 file:text-sm file:font-medium file:cursor-pointer"
          />
          <button onClick={handleUpload} disabled={!file || uploading} className={primaryBtnClass}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        {docsLoading && (
          <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mt-3">Loading your documents...</p>
        )}

        {!docsLoading && docs.length > 0 && (
          <div className="mt-4">
            <label className="text-xs text-teal-900/60 dark:text-emerald-100/60 block mb-1">
              Active document
            </label>
            <select
              value={activeDocId || ''}
              onChange={(e) => setActiveDocId(e.target.value)}
              className="w-full px-3 py-2 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50"
            >
              {docs.map((d) => (
                <option key={d.doc_id} value={d.doc_id}>
                  {d.filename} ({d.pages} pages)
                </option>
              ))}
            </select>
          </div>
        )}

        {!docsLoading && !hasDoc && (
          <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mt-3">
            Upload a pdf to unlock the section below.
          </p>
        )}
      </section>

      {/* --- Section 3: Ask / Chat tabs --- */}
      <section className={cardClass}>
        <div className="flex gap-1 mb-4 border-b border-teal-900/10 dark:border-white/10">
          <button
            onClick={() => setActiveTab('ask')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'ask'
                ? 'border-emerald-500 text-teal-900 dark:text-white'
                : 'border-transparent text-teal-900/50 dark:text-emerald-100/50 hover:text-teal-900 dark:hover:text-white'
            }`}
          >
            Ask a question
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'chat'
                ? 'border-emerald-500 text-teal-900 dark:text-white'
                : 'border-transparent text-teal-900/50 dark:text-emerald-100/50 hover:text-teal-900 dark:hover:text-white'
            }`}
          >
            Just type what you want
          </button>
        </div>

        {activeTab === 'ask' && (
          <div>
            {threadLoading && (
              <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mb-3">
                Loading conversation history...
              </p>
            )}

            {currentThread.length > 0 && (
              <div className="flex flex-col gap-4 mb-4">
                {currentThread.map((turn, i) => (
                  <div
                    key={i}
                    className="pb-4 border-b border-teal-900/10 dark:border-white/10 last:border-none last:pb-0"
                  >
                    <p className="text-sm font-semibold mb-1 text-teal-900 dark:text-white">{turn.question}</p>
                    {turn.standalone_question && (
                      <p className="text-xs italic text-teal-900/50 dark:text-emerald-100/50 mb-2">
                        Interpreted as: "{turn.standalone_question}"
                      </p>
                    )}
                    <p className="text-[15px] leading-relaxed text-teal-900 dark:text-emerald-50 whitespace-pre-wrap mb-2">
                      {turn.answer}
                    </p>
                    {turn.sources.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-teal-900/50 dark:text-emerald-100/50">Sources:</span>
                        {turn.sources.map((s, i2) => (
                          <span
                            key={i2}
                            className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full px-2.5 py-1"
                          >
                            {s.source} · p.{s.page}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2.5 flex-wrap">
              <input
                type="text"
                value={question}
                placeholder="Write your question here...."
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                disabled={!hasDoc}
                className={inputClass}
              />
              <button onClick={handleAsk} disabled={!hasDoc || busy || !question.trim()} className={primaryBtnClass}>
                Ask
              </button>
            </div>

            {currentThread.length > 0 && (
              <button
                onClick={handleNewConversation}
                disabled={busy}
                className="mt-2.5 text-xs text-teal-900/50 dark:text-emerald-100/50 underline disabled:text-teal-900/25 cursor-pointer"
              >
                New conversation
              </button>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <div className="flex gap-2.5 flex-wrap">
              <input
                type="text"
                value={chatInput}
                placeholder="Type anything about pdf you want to know, create....."
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                disabled={!hasDoc}
                className={inputClass}
              />
              <button
                onClick={handleChat}
                disabled={!hasDoc || busy || !chatInput.trim()}
                className={primaryBtnClass}
              >
                Send
              </button>
            </div>

            {chatResult && (
              <div className="mt-4 pt-4 border-t border-teal-900/10 dark:border-white/10">
                <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mb-2">
                  Detected:{' '}
                  <span className="uppercase text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5">
                    {chatResult.intent}
                  </span>
                </p>

                {chatResult.intent === 'qa' && (
                  <>
                    <p className="text-[15px] leading-relaxed text-teal-900 dark:text-emerald-50 whitespace-pre-wrap mb-2">
                      {chatResult.answer}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-teal-900/50 dark:text-emerald-100/50">Sources:</span>
                      {chatResult.sources.map((s, i) => (
                        <span
                          key={i}
                          className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full px-2.5 py-1"
                        >
                          {s.source} · p.{s.page}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {chatResult.intent === 'summarize' && (
                  <p className="text-[15px] leading-relaxed text-teal-900 dark:text-emerald-50 whitespace-pre-wrap">
                    {chatResult.summary}
                  </p>
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
                    <h3 className="text-sm font-semibold mt-3 mb-2 text-teal-900 dark:text-white">2-mark questions</h3>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-teal-900 dark:text-emerald-50 m-0">
                      {chatResult.two_mark_questions}
                    </pre>
                    <h3 className="text-sm font-semibold mt-4 mb-2 text-teal-900 dark:text-white">5-mark questions</h3>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-teal-900 dark:text-emerald-50 m-0">
                      {chatResult.five_mark_questions}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- Section 4: Summarize --- */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold mb-3.5 text-teal-900 dark:text-white">Summarize document</h2>
        <button onClick={handleSummarize} disabled={!hasDoc || busy} className={primaryBtnClass}>
          Summarize
        </button>

        {summary && (
          <div className="mt-4 pt-4 border-t border-teal-900/10 dark:border-white/10">
            <p className="text-[15px] leading-relaxed text-teal-900 dark:text-emerald-50 whitespace-pre-wrap m-0">
              {summary.summary}
            </p>
          </div>
        )}
      </section>

      {/* --- Section 5: Quiz --- */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold mb-3.5 text-teal-900 dark:text-white">Quiz me</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <label className="flex flex-col gap-1 text-xs text-teal-900/60 dark:text-emerald-100/60">
            <span>Difficulty</span>
            <select
              value={quizDifficulty}
              onChange={(e) => setQuizDifficulty(e.target.value)}
              disabled={!hasDoc}
              className="px-3 py-2 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50 w-28 disabled:opacity-50"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-teal-900/60 dark:text-emerald-100/60">
            <span>Questions</span>
            <input
              type="number"
              min="1"
              max="30"
              value={quizCount}
              onChange={(e) => setQuizCount(e.target.value)}
              disabled={!hasDoc}
              className="px-3 py-2 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50 w-24 disabled:opacity-50"
            />
          </label>
          <button onClick={handleQuiz} disabled={!hasDoc || busy} className={primaryBtnClass}>
            Generate quiz
          </button>
        </div>

        {quiz && (
          <div className="mt-4 pt-4 border-t border-teal-900/10 dark:border-white/10">
            <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mb-3">
              {quiz.difficulty} · {quiz.count_requested} questions
            </p>
            <QuizList
              questions={quiz.quiz}
              selections={quizSelections}
              onSelect={(i, opt) => setQuizSelections((prev) => ({ ...prev, [i]: opt }))}
            />
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard
