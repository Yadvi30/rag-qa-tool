import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium pb-1 border-b-2 ${
    isActive
      ? 'text-white border-emerald-400'
      : 'text-emerald-100/75 border-transparent hover:text-white hover:border-emerald-400'
  }`

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const onDashboard = location.pathname.startsWith('/dashboard')

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const goToAppOrSignup = () => navigate(isAuthenticated ? '/dashboard' : '/register')

  return (
    <header className="bg-teal-900 sticky top-0 z-20 relative">
      <div className="max-w-[1080px] mx-auto px-6 h-[68px] flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold text-white shrink-0">
          <Logo />
          <span>
            Study<span className="text-emerald-400">Grounded</span>
          </span>
        </Link>

        <nav className="hidden md:flex gap-8 flex-1 justify-center">
          <NavLink to="/" end className={navLinkClass}>Home</NavLink>
          {onDashboard ? (
            <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
          ) : (
            <a href="/#features" className="text-sm font-medium pb-1 border-b-2 border-transparent text-emerald-100/75 hover:text-white hover:border-emerald-400">
              Features
            </a>
          )}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle onDark />

          {onDashboard ? (
            <>
              <span className="hidden sm:inline text-sm text-emerald-100/80 whitespace-nowrap">
                {user?.name} <span className="font-mono text-xs text-emerald-400">· {user?.public_id}</span>
              </span>
              <button
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/20 text-emerald-100/80 hover:border-red-400 hover:text-red-400 cursor-pointer"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          ) : isAuthenticated ? (
            <button
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold bg-emerald-500 text-teal-950 hover:bg-emerald-400 cursor-pointer"
              onClick={goToAppOrSignup}
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex px-4 py-2 rounded-md text-sm font-semibold border border-white/25 text-white hover:border-emerald-400 hover:text-emerald-400"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="hidden sm:inline-flex px-4 py-2 rounded-md text-sm font-semibold border border-white/25 text-white hover:border-emerald-400 hover:text-emerald-400"
              >
                Sign up
              </Link>
              <button
                className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold bg-emerald-500 text-teal-950 hover:bg-emerald-400 cursor-pointer"
                onClick={goToAppOrSignup}
              >
                Ask anything
              </button>
            </>
          )}
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
    </header>
  )
}

export default Navbar