function QuizList({ questions, selections, onSelect }) {
  return (
    <div className="flex flex-col gap-4.5">
      {questions.map((q, i) => {
        const userAnswer = selections[i]
        return (
          <div key={i} className="flex flex-col gap-2">
            <p className="text-sm font-medium m-0 text-teal-900 dark:text-emerald-50">
              {i + 1}. {q.question}
            </p>
            <div className="flex flex-col gap-1.5">
              {q.options.map((opt, oi) => {
                let cls =
                  'text-left rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors '
                if (userAnswer !== undefined) {
                  if (opt === q.correct_answer) {
                    cls +=
                      'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                  } else if (opt === userAnswer) {
                    cls += 'bg-red-50 dark:bg-red-950 border-red-500 text-red-700 dark:text-red-400'
                  } else {
                    cls +=
                      'bg-white dark:bg-teal-900 border-teal-900/10 dark:border-white/10 text-teal-900 dark:text-emerald-100'
                  }
                } else {
                  cls +=
                    'bg-white dark:bg-teal-900 border-teal-900/10 dark:border-white/10 text-teal-900 dark:text-emerald-100 hover:border-emerald-500'
                }
                return (
                  <button key={oi} type="button" className={cls} onClick={() => onSelect(i, opt)}>
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

export default QuizList
