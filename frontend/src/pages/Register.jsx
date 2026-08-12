import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(name, email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex justify-center px-6 py-16 pb-24">
      <div className="w-full max-w-[380px] bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl shadow-lg p-8">
        <p className="font-mono text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-4">
          Get started
        </p>
        <h1 className="font-display text-[26px] font-semibold mb-2 text-teal-900 dark:text-white">
          Create an account
        </h1>
        <p className="text-[13px] text-teal-900/60 dark:text-emerald-100/60 mb-6">
          Free — upload your first document in under a minute.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-teal-900/70 dark:text-emerald-100/70">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="px-3 py-2.5 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-teal-900/70 dark:text-emerald-100/70">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="px-3 py-2.5 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-teal-900/70 dark:text-emerald-100/70">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="px-3 py-2.5 border border-teal-900/15 dark:border-white/15 rounded-md text-sm bg-white dark:bg-teal-900 text-teal-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          {error && (
            <p className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-md px-3 py-2 m-0">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full inline-flex items-center justify-center px-5 py-2.5 rounded-md text-sm font-semibold bg-emerald-500 text-teal-950 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-[13px] text-teal-900/60 dark:text-emerald-100/60 text-center">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 dark:text-emerald-400 no-underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Register
