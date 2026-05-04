import { ScrollText } from 'lucide-react'
import { useWorkLogStream } from '../api/useWorkLogStream'
import WorkLogFeed from '../components/WorkLogFeed'

export default function WorkLogView() {
  const { data, isLoading, error } = useWorkLogStream({ limit: 50 })

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <ScrollText className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Work Log</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Live stream of agent activity — work logs, status, and truncation events.
        </p>
      </div>

      {/* Feed */}
      <WorkLogFeed
        entries={data?.entries ?? []}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
