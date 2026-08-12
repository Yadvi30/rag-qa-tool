function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-emerald-500)" />
      <path
        d="M9 8h9a3 3 0 0 1 3 3v10a1 1 0 0 1-1 1H12a3 3 0 0 1-3-3V9a1 1 0 0 1 1-1z"
        stroke="var(--color-teal-900)"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M12 13h6M12 16.5h6M12 20h3.5"
        stroke="var(--color-teal-900)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default Logo
