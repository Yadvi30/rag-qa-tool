import { useAuth } from '../context/AuthContext'

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ProfileCard() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="flex items-center gap-4 bg-white dark:bg-teal-800 border border-teal-900/10 dark:border-white/10 rounded-xl px-5 py-4 shadow-sm">
      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-display text-lg font-semibold shrink-0">
        {user.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold m-0 text-teal-900 dark:text-emerald-50 truncate">{user.name}</p>
        <p className="text-xs text-teal-900/60 dark:text-emerald-100/60 my-0.5 truncate">{user.email}</p>
        <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400 my-0.5">{user.public_id}</p>
        <p className="text-xs text-teal-900/60 dark:text-emerald-100/60 m-0">
          Member since {formatDateTime(user.created_at)}
        </p>
      </div>
    </div>
  )
}

export default ProfileCard
