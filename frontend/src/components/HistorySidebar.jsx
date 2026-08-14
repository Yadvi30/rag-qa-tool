import { AnimatePresence, motion } from 'framer-motion'

function SidebarContent({ docs, activeDocId, docsLoading, onSelectDoc, onNewChat, onClose }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-4 border-b border-teal-900/10 dark:border-white/10 shrink-0">
        <h2 className="text-sm font-semibold text-teal-900 dark:text-emerald-50">History</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNewChat}
            title="Upload a new PDF"
            aria-label="Upload a new PDF"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-teal-950 hover:bg-emerald-400 cursor-pointer shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Hide history"
            aria-label="Hide history"
            className="w-8 h-8 rounded-full flex items-center justify-center text-teal-900/50 dark:text-emerald-100/50 hover:bg-teal-900/10 dark:hover:bg-white/10 hover:text-teal-900 dark:hover:text-white cursor-pointer shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {docsLoading && (
          <p className="px-4 py-3 text-xs text-teal-900/50 dark:text-emerald-100/50">Loading...</p>
        )}
        {!docsLoading && docs.length === 0 && (
          <p className="px-4 py-3 text-xs text-teal-900/50 dark:text-emerald-100/50">
            No documents yet — upload one to get started.
          </p>
        )}
        {docs.map((d) => (
          <button
            key={d.doc_id}
            type="button"
            onClick={() => onSelectDoc(d.doc_id)}
            className={`w-full text-left px-4 py-3 flex flex-col gap-0.5 border-l-2 transition-colors ${
              d.doc_id === activeDocId
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-transparent hover:bg-teal-900/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="text-sm font-medium text-teal-900 dark:text-emerald-50 truncate">
              {d.filename}
            </span>
            <span className="text-xs text-teal-900/50 dark:text-emerald-100/50">{d.pages} pages</span>
          </button>
        ))}
      </div>
    </>
  )
}

function HistorySidebar({
  docs,
  activeDocId,
  docsLoading,
  onSelectDoc,
  onNewChat,
  mobileOpen,
  desktopOpen,
  onCloseMobile,
  onCloseDesktop,
}) {
  const sharedProps = { docs, activeDocId, docsLoading, onSelectDoc, onNewChat }

  return (
    <>
      {/* Desktop: static column, hidden entirely when closed via the X button */}
      {desktopOpen && (
        <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-teal-900/10 dark:border-white/10 bg-white/60 dark:bg-teal-900/40">
          <SidebarContent {...sharedProps} onClose={onCloseDesktop} />
        </aside>
      )}

      {/* Mobile: slide-in overlay drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="md:hidden fixed inset-0 bg-black/40 z-30"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="md:hidden fixed inset-y-0 left-0 z-40 w-72 flex flex-col bg-white dark:bg-teal-900 shadow-xl"
            >
              <SidebarContent {...sharedProps} onClose={onCloseMobile} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default HistorySidebar