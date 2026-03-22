import { useLiveAgents } from '../api/useLiveAgents'
import { timeAgo, formatDuration } from '../utils/time'

export default function LiveAgentsPanel() {
  const { data: agents } = useLiveAgents()

  if (!agents || agents.length === 0) return null

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
        Running Agents
        <span className="ml-2 text-purple-400">{agents.length}</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const duration = agent.startedAt
            ? Date.now() - new Date(agent.startedAt).getTime()
            : 0

          return (
            <div
              key={agent.agentId}
              className="bg-[var(--bg-secondary)] border border-purple-500/20 rounded-xl px-4 py-3 flex items-start gap-3"
            >
              {/* Status dot */}
              <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0" aria-label={agent.isActive ? 'Agent active' : 'Agent idle'}>
                {agent.isActive ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--success)]" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--warning)]" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                {/* Agent type name */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {agent.agentType ?? agent.agentId.slice(0, 8)}
                  </span>
                  {agent.model && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-400">
                      {agent.model}
                    </span>
                  )}
                </div>

                {/* Description */}
                {agent.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    {agent.description}
                  </p>
                )}

                {/* Metadata row */}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-muted)]">
                  <span className="font-mono">{agent.projectName}</span>
                  <span>{agent.messageCount} msgs</span>
                  {duration > 0 && <span>{formatDuration(duration)}</span>}
                  <span className="ml-auto">{agent.startedAt ? timeAgo(agent.startedAt) : ''}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
