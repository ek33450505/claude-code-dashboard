import { AnimatePresence, motion } from 'framer-motion'
import DelegationChain from './DelegationChain'
import { FeedCard, type FeedItem } from './FeedCard'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  feed: FeedItem[]
  onClearFeed: () => void
}

export default function SidePanel({ isOpen, onClose, feed, onClearFeed }: SidePanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: '#00000040',
              zIndex: 59,
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100%',
              width: 380,
              zIndex: 60,
              background: '#0d1117',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ ...PIXEL_FONT, fontSize: 10, color: '#00FFC2' }}>INTEL</span>
              <button
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            {/* DelegationChain section — fixed ~50% */}
            <div
              className="px-4 py-4 overflow-y-auto shrink-0"
              style={{ maxHeight: '50%', borderBottom: '1px solid var(--border)' }}
            >
              <DelegationChain />
            </div>

            {/* Activity Log section — flex-1, scrollable */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* Section header */}
              <div
                className="flex items-center justify-between px-4 py-2 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span
                  className="uppercase tracking-wider text-[var(--text-muted)]"
                  style={{ ...PIXEL_FONT, fontSize: 7 }}
                >
                  Activity Log
                </span>
                <button
                  onClick={onClearFeed}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Scrollable feed */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {feed.length === 0 ? (
                  <p className="text-xs text-center text-[var(--text-muted)] py-4">No events yet</p>
                ) : (
                  feed.map((item) => <FeedCard key={item.id} item={item} />)
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
