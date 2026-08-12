import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FeatureCircles from '../components/FeatureCircles'
import ProcessWheel from '../components/ProcessWheel'

function Home() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleUploadClick = () => navigate(isAuthenticated ? '/dashboard' : '/register')

  return (
    <div>
      {/* --- Hero --- */}
      <section className="max-w-[1080px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-12 items-center pt-12 md:pt-[72px] pb-[88px]">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-4">
            For exam season, not just study season
          </p>
          <h1 className="font-display text-4xl md:text-[44px] leading-[1.12] font-semibold mb-5 tracking-tight text-teal-900 dark:text-white">
            Turn your notes into{' '}
            <span className="text-emerald-600 dark:text-emerald-400">answers you can trust</span>
          </h1>
          <p className="text-base leading-relaxed text-teal-900/70 dark:text-emerald-100/70 max-w-[480px] mb-7">
            Upload your PDFs. Ask questions, get summaries, or generate a quiz —
            every answer points back to the exact page it came from, so you're
            never studying a guess.
          </p>
          <button
            className="inline-flex items-center px-5 py-3 rounded-md text-sm font-semibold bg-emerald-500 text-teal-950 hover:bg-emerald-400 cursor-pointer"
            onClick={handleUploadClick}
          >
            Upload a doc
          </button>
        </div>

        <div className="relative h-[380px]" aria-hidden="true">
          <div className="absolute w-[280px] bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl shadow-lg p-4 top-0 left-0 -rotate-6 z-10 transition-transform hover:-translate-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wide text-teal-900/40 dark:text-emerald-100/40 mb-2.5">
              your_notes.pdf
            </p>
            <div className="h-1.5 rounded bg-teal-900/10 dark:bg-white/10 mb-1.5 w-full" />
            <div className="h-1.5 rounded bg-teal-900/10 dark:bg-white/10 mb-1.5 w-full" />
            <div className="bg-emerald-100 dark:bg-emerald-950 rounded px-1.5 py-1 my-0.5 mb-2">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                18 days of paid annual leave
              </span>
            </div>
            <div className="h-1.5 rounded bg-teal-900/10 dark:bg-white/10 mb-1.5 w-full" />
            <div className="h-1.5 rounded bg-teal-900/10 dark:bg-white/10 mb-1.5 w-3/5" />
          </div>

          <div className="absolute w-[280px] bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl shadow-lg p-4 top-[90px] left-[130px] rotate-3 z-20 transition-transform hover:-translate-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wide text-teal-900/40 dark:text-emerald-100/40 mb-2.5">
              Answer
            </p>
            <p className="text-[13px] leading-relaxed mb-2.5 text-teal-900 dark:text-emerald-50">
              "You get 18 days of paid annual leave per year."
            </p>
            <span className="inline-block font-mono text-[10px] bg-emerald-50 dark:bg-teal-900 border border-teal-900/10 dark:border-white/10 rounded-full px-2.5 py-0.5 text-teal-900/60 dark:text-emerald-100/60">
              source: p.1
            </span>
          </div>

          <div className="absolute w-[280px] bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl shadow-lg p-4 top-[220px] left-5 -rotate-2 z-30 transition-transform hover:-translate-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wide text-teal-900/40 dark:text-emerald-100/40 mb-2.5">
              Quiz
            </p>
            <p className="text-[13px] font-semibold mb-2.5 text-teal-900 dark:text-emerald-50">
              How many leave days per year?
            </p>
            <div className="text-xs bg-emerald-100 dark:bg-emerald-950 border border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold rounded-md px-2.5 py-1.5 mb-1.5">
              18 days
            </div>
            <div className="text-xs border border-teal-900/10 dark:border-white/10 text-teal-900/60 dark:text-emerald-100/60 rounded-md px-2.5 py-1.5">
              12 days
            </div>
          </div>
        </div>
      </section>

      {/* --- Features: hover circles --- */}
      <section className="max-w-[1080px] mx-auto px-6 py-10 pb-24" id="features">
        <div className="text-center mb-6">
          <h2 className="font-display text-[26px] font-semibold mb-2.5 tracking-tight text-teal-900 dark:text-white">
            Everything you need to study from one document
          </h2>
          <p className="text-sm text-teal-900/70 dark:text-emerald-100/70 max-w-[520px] mx-auto">
            Hover a circle to see what it does.
          </p>
        </div>
        <FeatureCircles />
      </section>

      {/* --- How it works: circular chain --- */}
      <section className="max-w-[1080px] mx-auto px-6 py-10 pb-24">
        <div className="text-center mb-10">
          <h2 className="font-display text-[26px] font-semibold mb-2.5 tracking-tight text-teal-900 dark:text-white">
            How it works
          </h2>
          <p className="text-sm text-teal-900/70 dark:text-emerald-100/70 max-w-[520px] mx-auto">
            One document, one continuous loop — upload once, come back for more any time.
          </p>
        </div>
        <ProcessWheel />
      </section>
    </div>
  )
}

export default Home
