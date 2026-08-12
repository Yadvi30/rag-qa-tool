const FEATURES = [
  {
    title: 'Grounded Q&A',
    description:
      'Ask follow-up questions naturally — the assistant remembers context, and every answer cites its source page.',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    title: 'Whole-document summaries',
    description: 'Get a clear overview of long material without reading every page yourself.',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    title: 'Quizzes & exam questions',
    description:
      'Generate multiple-choice quizzes at your chosen difficulty, or marks-weighted exam question sets.',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
]

function FeatureCircles() {
  return (
    <div className="flex flex-wrap justify-center gap-x-14 gap-y-20 pt-2">
      {FEATURES.map((f, i) => (
        <div key={i} className="group relative flex flex-col items-center w-40">
          <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-transform duration-200 group-hover:scale-105 group-hover:shadow-lg">
            {f.icon}
          </div>
          <p className="mt-3 text-sm font-semibold text-center text-teal-900 dark:text-emerald-50">
            {f.title}
          </p>

          <div className="absolute top-[calc(100%+6px)] w-64 opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 pointer-events-none bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl p-4 shadow-xl z-10">
            <p className="text-[13px] leading-relaxed text-teal-900/70 dark:text-emerald-100/80 m-0">
              {f.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FeatureCircles
