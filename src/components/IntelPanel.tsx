import DelegationChain from './DelegationChain'
import { FeedCard, type FeedItem } from './FeedCard'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

interface IntelPanelProps {
  feed: FeedItem[]
  onClearFeed: () => void
}

export default function IntelPanel({ feed, onClearFeed }: IntelPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* INTEL header */}
      <div
        className="flex items-center px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span style={{ ...PIXEL_FONT, fontSize: 9, color: '#00FFC2' }}>INTEL</span>
      </div>

      {/* DelegationChain */}
      <div
        className="px-4 py-3 overflow-y-auto shrink-0"
        style={{ maxHeight: 240, borderBottom: '1px solid var(--border)' }}
      >
        <DelegationChain />
      </div>

      {/* Activity Log */}
      <div className="flex flex-col flex-1 min-h-0">
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

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {feed.length === 0 ? (
            <p className="text-xs text-center text-[var(--text-muted)] py-4">No events yet</p>
          ) : (
            feed.map((item) => <FeedCard key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  )
}
