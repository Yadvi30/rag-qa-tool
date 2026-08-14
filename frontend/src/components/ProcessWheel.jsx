import { motion } from 'framer-motion'

// 5 steps positioned evenly around a circle, with arrow markers at each
// midpoint (including the last -> first gap) so the loop back to "Upload"
// is visible, not just implied by the steps being arranged in a ring.

const STEPS = ['Upload', 'Ask', 'Summarize', 'Quiz', 'Check sources']
const RADIUS = 42 // percent of the container's width/height

function pointOnCircle(angleDeg, radius = RADIUS) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    left: `${50 + radius * Math.cos(rad)}%`,
    top: `${50 + radius * Math.sin(rad)}%`,
  }
}

function ProcessWheel() {
  const n = STEPS.length
  const nodeAngles = STEPS.map((_, i) => -90 + i * (360 / n))

  return (
    <div className="relative w-full max-w-[420px] aspect-square mx-auto">
      {/* Rotating gradient ring - a conic-gradient div masked down to a thin
          circle outline, continuously spinning. This is the "gradient
          motion" connecting the steps, replacing a static dashed border. */}
      <motion.div
        className="absolute inset-[9%] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0%, var(--color-emerald-400) 12%, transparent 30%)',
          WebkitMask:
            'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
        }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
      />
      {/* Second, fainter ring rotating the opposite way for more visible motion */}
      <motion.div
        className="absolute inset-[9%] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0%, var(--color-emerald-500) 8%, transparent 22%)',
          WebkitMask:
            'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          opacity: 0.6,
        }}
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 9, ease: 'linear' }}
      />

      {nodeAngles.map((angle, i) => {
        const pos = pointOnCircle(angle)
        return (
          <motion.div
            key={i}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 w-24"
            style={pos}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-teal-950 flex items-center justify-center font-display font-semibold text-base shadow-md">
              {i + 1}
            </div>
            <span className="mt-2 text-xs font-medium text-center text-teal-900 dark:text-emerald-100">
              {STEPS[i]}
            </span>
          </motion.div>
        )
      })}

      {nodeAngles.map((angle, i) => {
        const nextAngle = nodeAngles[(i + 1) % n] + (i === n - 1 ? 360 : 0)
        const midAngle = (angle + nextAngle) / 2
        const pos = pointOnCircle(midAngle)
        const rotation = midAngle + 90
        return (
          <motion.div
            key={`arrow-${i}`}
            className="absolute text-emerald-500"
            style={{ ...pos, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, delay: i * 0.3, ease: 'easeInOut' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 L20 20 L12 15 L4 20 Z" />
            </svg>
          </motion.div>
        )
      })}
    </div>
  )
}

export default ProcessWheel
