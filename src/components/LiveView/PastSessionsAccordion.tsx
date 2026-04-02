import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { PastSessionSummary } from '../../types'
import SessionHistoryTable from './SessionHistoryTable'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

interface Props {
  sessions: PastSessionSummary[]
}

export default function PastSessionsAccordion({ sessions }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (sessions.length === 0) return null

  function toggle(sessionId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      <div className="px-4 py-2 border-b border-border">
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          Past Sessions
        </span>
      </div>

      <div className="divide-y divide-border/50">
        {sessions.map(session => {
          const isOpen = expanded.has(session.sessionId)
          return (
            <div key={session.sessionId}>
              <button
                onClick={() => toggle(session.sessionId)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-accent/10 transition-colors text-left"
              >
                <motion.span
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-muted-foreground"
                >
                  <ChevronRight size={12} />
                </motion.span>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {formatTime(session.startedAt)}
                </span>
                <span className="text-xs font-mono text-foreground/70">
                  {session.agentCount} agent{session.agentCount !== 1 ? 's' : ''}
                </span>
                {session.totalCost > 0 && (
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    ${session.totalCost.toFixed(2)}
                  </span>
                )}
                <span className="text-xs font-mono text-muted-foreground/50 tabular-nums ml-auto">
                  {formatDuration(session.duration_ms)}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3">
                      <SessionHistoryTable runs={session.agents} compact />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
