import { Users, Clock, Zap, ChevronRight } from 'lucide-react'
import { SpotlightCard } from '../effects/SpotlightCard'
import type { SwarmSession } from '../../types'

interface SwarmCardProps {
  session: SwarmSession
  isSelected?: boolean
  onClick?: () => void
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'running':   return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    case 'completed': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    case 'failed':    return 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
    default:          return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
  }
}

function elapsedTime(started: string | null, ended: string | null): string {
  if (!started) return '—'
  const start = new Date(started).getTime()
  const end = ended ? new Date(ended).getTime() : Date.now()
  const ms = end - start
  if (ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60)  return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function SwarmCard({ session, isSelected, onClick }: SwarmCardProps) {
  const totalTokens = session.total_tokens ?? 0

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div onClick={onClick}>
    <SpotlightCard
      className={`bento-card cursor-pointer transition-all duration-150 ${
        isSelected ? 'ring-1 ring-[var(--accent)]' : ''
      }`}
    >
      <div className="p-4 flex items-start justify-between gap-4">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {session.team_name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusBadgeClass(session.status)}`}>
              {session.status}
            </span>
          </div>

          {session.project && (
            <div className="text-xs text-[var(--text-muted)] mb-2 truncate">
              {session.project}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {session.teammate_count ?? 0} teammates
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {elapsedTime(session.started_at, session.ended_at)}
            </span>
            {totalTokens > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                {totalTokens >= 1000
                  ? `${(totalTokens / 1000).toFixed(1)}k tok`
                  : `${totalTokens} tok`}
              </span>
            )}
          </div>
        </div>

        {/* Right: chevron */}
        <ChevronRight className={`w-4 h-4 shrink-0 mt-1 transition-colors ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
      </div>
    </SpotlightCard>
    </div>
  )
}
