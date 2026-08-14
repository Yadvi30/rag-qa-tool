import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'
import QuizList from '../components/QuizList'
import ProfileCard from '../components/ProfileCard'
import MindmapView from '../components/MindmapView'
import HistorySidebar from '../components/HistorySidebar'

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)

  // --- Ask / Chat tabs ---
  const [activeTab, setActiveTab] = useState('ask') // 'ask' | 'chat'

  // --- Ask (conversation thread, per document) ---
  const [question, setQuestion] = useState('')
  const [threads, setThreads] = useState({})
  const [threadLoading, setThreadLoading] = useState(false)

  // --- Summarize (cached per document) ---
  const [summaries, setSummaries] = useState({}) // { [docId]: summaryData }

  // --- Quiz (cached per document) ---
  const [quizCount, setQuizCount] = useState(10)
  const [quizDifficulty, setQuizDifficulty] = useState('medium')
  const [quizzes, setQuizzes] = useState({}) // { [docId]: quizData }
  const [quizSelectionsMap, setQuizSelectionsMap] = useState({}) // { [docId]: { [qIndex]: answer } }

  // --- Mindmap (cached per document) ---
  const [mindmaps, setMindmaps] = useState({}) // { [docId]: mindmapData }
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapAskingTitle, setMindmapAskingTitle] = useState(null)
  const [mindmapAnswers, setMindmapAnswers] = useState({}) // { [docId]: lastAnswerData }

  // --- Free-text / chat (cached per document) ---
  const [chatInput, setChatInput] = useState('')
  const [chatResults, setChatResults] = useState({}) // { [docId]: chatResultData }
  const [chatQuizSelectionsMap, setChatQuizSelectionsMap] = useState({}) // { [docId]: { [qIndex]: answer } }

  const hasDoc = Boolean(activeDocId)

  // Derived "current document's" values - reading from the caches above
  // means switching documents in the sidebar shows exactly what was last
  // generated for that document, instead of wiping it.
  const summary = summaries[activeDocId] || null
  const quiz = quizzes[activeDocId] || null
  const quizSelections = quizSelectionsMap[activeDocId] || {}
  const mindmap = mindmaps[activeDocId] || null
  const mindmapAnswer = mindmapAnswers[activeDocId] || null
  const chatResult = chatResults[activeDocId] || null
  const chatQuizSelections = chatQuizSelectionsMap[activeDocId] || {}

  useEffect(() => {
    apiFetch('/documents', { token })
      .then((data) => {
        setDocs(data.documents)
        // Deliberately NOT auto-selecting the first document here - if we
        // did, refreshing the page after clicking "New chat" would just
        // silently re-select the old document again, undoing the reset.
        // The sidebar shows everything; the user picks.
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

  // Sidebar "new chat" icon: resets the ACTIVE selection so the main panel
  // goes back to a fresh "upload a PDF" state. Nothing is deleted - every
  // previous document's results stay cached and reappear if you select it
  // again from the sidebar.
  const handleNewChat = () => {
    setActiveDocId(null)
    setFile(null)
    setQuestion('')
    setChatInput('')
    setError('')
    setMobileSidebarOpen(false)
  }

  const handleSelectDoc = (docId) => {
    setActiveDocId(docId)
    setMobileSidebarOpen(false)
  }

  const askQuestion = async (askedQuestion) => {
    if (!askedQuestion.trim() || !hasDoc) return
    setBusy(true)
    setError('')
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
      throw err
    } finally {
      setBusy(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim() || !hasDoc) return
    const askedQuestion = question
    setQuestion('')
    try {
      await askQuestion(askedQuestion)
    } catch {
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
    const docId = activeDocId
    setBusy(true)
    setError('')
    try {
      const data = await apiFetch('/summarize', {
        method: 'POST',
        token,
        body: { doc_id: docId },
      })
      setSummaries((prev) => ({ ...prev, [docId]: data }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleQuiz = async () => {
    if (!hasDoc) return
    const docId = activeDocId
    setBusy(true)
    setError('')
    try {
      const data = await apiFetch('/quiz', {
        method: 'POST',
        token,
        body: { doc_id: docId, count: Number(quizCount), difficulty: quizDifficulty },
      })
      setQuizzes((prev) => ({ ...prev, [docId]: data }))
      setQuizSelectionsMap((prev) => ({ ...prev, [docId]: {} }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleGenerateMindmap = async () => {
    if (!hasDoc) return
    const docId = activeDocId
    setMindmapLoading(true)
    setError('')
    try {
      const data = await apiFetch('/mindmap', {
        method: 'POST',
        token,
        body: { doc_id: docId },
      })
      setMindmaps((prev) => ({ ...prev, [docId]: data.mindmap }))
      setMindmapAnswers((prev) => ({ ...prev, [docId]: null }))
    } catch (err) {
      setError(err.message)
    } finally {
      setMindmapLoading(false)
    }
  }

  // Clicking a mindmap node asks about it via /ask with persist:false - a
  // real grounded answer still comes back, but it's NOT written to
  // chat_history, so it won't show up in (or clutter) the Ask tab's thread.
  const handleAskAboutNode = async (nodeTitle) => {
    if (!hasDoc) return
    const docId = activeDocId
    setMindmapAskingTitle(nodeTitle)
    setError('')
    try {
      const data = await apiFetch('/ask', {
        method: 'POST',
        token,
        body: {
          doc_id: docId,
          question: `Tell me more about "${nodeTitle}".`,
          persist: false,
        },
      })
      setMindmapAnswers((prev) => ({ ...prev, [docId]: { title: nodeTitle, ...data } }))
    } catch (err) {
      setError(err.message)
    } finally {
      setMindmapAskingTitle(null)
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !hasDoc) return
    const docId = activeDocId
    setBusy(true)
    setError('')
    try {
      const data = await apiFetch('/chat', {
        method: 'POST',
        token,
        body: { doc_id: docId, message: chatInput },
      })
      setChatResults((prev) => ({ ...prev, [docId]: data }))
      setChatQuizSelectionsMap((prev) => ({ ...prev, [docId]: {} }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 68px)' }}>
      <HistorySidebar
        docs={docs}
        activeDocId={activeDocId}
        docsLoading={docsLoading}
        onSelectDoc={handleSelectDoc}
        onNewChat={handleNewChat}
        mobileOpen={mobileSidebarOpen}
        desktopOpen={desktopSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onCloseDesktop={() => setDesktopSidebarOpen(false)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[820px] mx-auto px-6 py-10 flex flex-col gap-6">
          {/* --- Mobile: open history drawer --- */}
          {!mobileSidebarOpen && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden self-start inline-flex items-center gap-2 text-xs font-medium text-teal-900/70 dark:text-emerald-100/70 border border-teal-900/15 dark:border-white/15 rounded-md px-3 py-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              History
            </button>
          )}

          {/* --- Desktop: re-open history column once hidden --- */}
          {!desktopSidebarOpen && (
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen(true)}
              className="hidden md:inline-flex self-start items-center gap-2 text-xs font-medium text-teal-900/70 dark:text-emerald-100/70 border border-teal-900/15 dark:border-white/15 rounded-md px-3 py-2 hover:border-emerald-500"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Show history
            </button>
          )}

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

            {!docsLoading && !hasDoc && (
              <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mt-3">
                Upload a pdf to unlock the sections below, or pick a previous one from History on the left.
              </p>
            )}
          </section>

          {hasDoc && (
            <>
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
                    onSelect={(i, opt) =>
                      setChatQuizSelectionsMap((prev) => ({
                        ...prev,
                        [activeDocId]: { ...(prev[activeDocId] || {}), [i]: opt },
                      }))
                    }
                  />
                )}

                {chatResult.intent === 'exam' && (
                  <div className="flex flex-col gap-4">
                    {chatResult.exam_groups.map((group, gi) => (
                      <div key={gi}>
                        <h3 className="text-sm font-semibold mb-2 text-teal-900 dark:text-white">
                          {group.count} question{group.count !== 1 ? 's' : ''} worth {group.marks} mark
                          {group.marks !== 1 ? 's' : ''} each
                        </h3>
                        <pre className="whitespace-pre-wrap font-sans text-sm text-teal-900 dark:text-emerald-50 m-0">
                          {group.questions}
                        </pre>
                      </div>
                    ))}
                  </div>
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
              onSelect={(i, opt) =>
                setQuizSelectionsMap((prev) => ({
                  ...prev,
                  [activeDocId]: { ...(prev[activeDocId] || {}), [i]: opt },
                }))
              }
            />
          </div>
        )}
      </section>

      {/* --- Section 6: Mindmap --- */}
      <section className={cardClass}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-base font-semibold text-teal-900 dark:text-white">Mindmap</h2>
          <button
            onClick={handleGenerateMindmap}
            disabled={!hasDoc || mindmapLoading}
            className={primaryBtnClass}
          >
            {mindmapLoading ? 'Generating...' : 'Generate mindmap'}
          </button>
        </div>
        <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mb-3">
          Click a node to expand or collapse it. Click "Ask" on any node to ask about it directly.
        </p>

        {mindmap && (
          <div className="mt-4 pt-4 border-t border-teal-900/10 dark:border-white/10">
            <MindmapView root={mindmap} onAskAbout={handleAskAboutNode} askingTitle={mindmapAskingTitle} />

            {mindmapAnswer && (
              <div className="mt-4 pt-4 border-t border-teal-900/10 dark:border-white/10">
                <p className="text-xs text-teal-900/50 dark:text-emerald-100/50 mb-2">
                  Re: <span className="font-medium text-teal-900 dark:text-emerald-100">{mindmapAnswer.title}</span>
                </p>
                <p className="text-[15px] leading-relaxed text-teal-900 dark:text-emerald-50 whitespace-pre-wrap mb-2">
                  {mindmapAnswer.answer}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-teal-900/50 dark:text-emerald-100/50">Sources:</span>
                  {mindmapAnswer.sources.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full px-2.5 py-1"
                    >
                      {s.source} · p.{s.page}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard