import { useTheme } from '../context/ThemeContext'

function ThemeToggle({ onDark = false }) {
  const { theme, toggleTheme } = useTheme()

  const base =
    'inline-flex items-center justify-center w-9 h-9 rounded-full border cursor-pointer flex-shrink-0 transition-colors'
  const variant = onDark
    ? 'border-white/25 text-emerald-100/80 hover:border-emerald-400 hover:text-emerald-400'
    : 'border-teal-900/15 text-teal-900/60 hover:border-emerald-500 hover:text-emerald-500 dark:border-white/15 dark:text-emerald-100/70 dark:hover:text-emerald-400'

  return (
    <button
      className={`${base} ${variant}`}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

export default ThemeToggle
