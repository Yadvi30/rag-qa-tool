// Radial node-link mindmap: central topic in the middle, branches arranged
// around it, each branch's sub-points fanning out further from center along
// its own direction. SVG layer draws curved connectors; HTML pill nodes sit
// on top (easier to auto-size around text than pure SVG <text>).
//
// Clicking any branch/leaf node asks about it directly - no separate
// expand/collapse step, since everything is visible at once here.

function polarPoint(angleDeg, radius, cx = 50, cy = 50) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

function curvedPath(from, to) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const curve = 0.15 // how much the line bows outward
  const cx = mx - dy * curve
  const cy = my + dx * curve
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
}

const BRANCH_RADIUS = 30
const LEAF_RADIUS = 46

function buildLayout(root) {
  const branches = root.children || []
  const n = branches.length || 1
  const center = { x: 50, y: 50 }

  const nodes = [{ ...center, title: root.title, kind: 'root', key: 'root' }]
  const edges = []

  branches.forEach((branch, i) => {
    const angle = -90 + i * (360 / n)
    const bp = polarPoint(angle, BRANCH_RADIUS)
    edges.push({ from: center, to: bp })
    nodes.push({ ...bp, title: branch.title, kind: 'branch', key: `b${i}` })

    const leaves = branch.children || []
    const m = leaves.length
    if (m > 0) {
      const spread = Math.min(50, 14 * m)
      leaves.forEach((leaf, j) => {
        const leafAngle = m === 1 ? angle : angle - spread / 2 + (j * spread) / (m - 1)
        const lp = polarPoint(leafAngle, LEAF_RADIUS)
        edges.push({ from: bp, to: lp })
        nodes.push({ ...lp, title: leaf.title, kind: 'leaf', key: `b${i}l${j}` })
      })
    }
  })

  return { nodes, edges }
}

function nodeClass(kind, isAsking) {
  let cls =
    'absolute -translate-x-1/2 -translate-y-1/2 text-center rounded-full whitespace-nowrap max-w-[150px] truncate shadow-sm transition-colors '
  if (kind === 'root') {
    cls += 'bg-emerald-500 text-teal-950 font-semibold text-sm px-4 py-2 cursor-default'
  } else if (kind === 'branch') {
    cls +=
      'bg-white dark:bg-teal-800 border border-emerald-500 text-teal-900 dark:text-emerald-50 text-xs font-medium px-3.5 py-1.5 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950'
  } else {
    cls +=
      'bg-emerald-50/70 dark:bg-teal-900 border border-teal-900/10 dark:border-white/10 text-teal-900/80 dark:text-emerald-100/80 text-[11px] px-3 py-1 cursor-pointer hover:border-emerald-500'
  }
  if (isAsking) cls += ' ring-2 ring-emerald-400 animate-pulse'
  return cls
}

function MindmapView({ root, onAskAbout, askingTitle }) {
  if (!root) return null
  const { nodes, edges } = buildLayout(root)

  return (
    <div className="relative w-full aspect-[4/3] md:aspect-[16/9]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {edges.map((e, i) => (
          <path
            key={i}
            d={curvedPath(e.from, e.to)}
            fill="none"
            stroke="var(--color-emerald-500)"
            strokeOpacity="0.35"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {nodes.map((node) => {
        const clickable = node.kind !== 'root'
        const isAsking = askingTitle === node.title
        return (
          <button
            key={node.key}
            type="button"
            disabled={!clickable || isAsking}
            onClick={() => clickable && onAskAbout(node.title)}
            title={clickable ? `Ask about "${node.title}"` : node.title}
            className={nodeClass(node.kind, isAsking)}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            {node.title}
          </button>
        )
      })}
    </div>
  )
}

export default MindmapView