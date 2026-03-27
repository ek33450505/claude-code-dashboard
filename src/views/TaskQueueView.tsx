import { ListTodo, X } from 'lucide-react'
import { useTaskQueue, useDeleteTask } from '../api/useTaskQueue'

const PRIORITY_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'rgba(251,113,133,0.15)', text: '#FB7185', label: 'High' },
  2: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Med' },
  3: { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF', label: 'Low' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  claimed: { bg: 'rgba(167,139,250,0.15)', text: '#A78BFA' },
  done: { bg: 'rgba(0,255,194,0.15)', text: '#00FFC2' },
  failed: { bg: 'rgba(251,113,133,0.15)', text: '#FB7185' },
}

function CountPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bento-card px-4 py-3 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="ml-auto text-lg font-bold text-[var(--text-primary)] tabular-nums">{count}</span>
    </div>
  )
}

export default function TaskQueueView() {
  const { data, isLoading, error } = useTaskQueue()
  const deleteTask = useDeleteTask()

  const handleCancel = (id: string, agent: string) => {
    if (window.confirm(`Cancel task for agent "${agent}"?`)) {
      deleteTask.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bento-card p-5 h-16 animate-pulse bg-[var(--bg-secondary)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bento-card p-6 text-[var(--error)]">Failed to load task queue.</div>
      </div>
    )
  }

  const counts = data?.counts ?? { pending: 0, claimed: 0, done: 0, failed: 0 }
  const tasks = data?.tasks ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Task Queue</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">castd task queue — auto-refreshes every 10s</p>
      </div>

      {/* Count pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CountPill label="Pending" count={counts.pending} color="#F59E0B" />
        <CountPill label="Claimed" count={counts.claimed} color="#A78BFA" />
        <CountPill label="Done" count={counts.done} color="#00FFC2" />
        <CountPill label="Failed" count={counts.failed} color="#FB7185" />
      </div>

      {/* Task table */}
      {tasks.length === 0 ? (
        <div className="bento-card p-10 text-center text-[var(--text-muted)]">
          <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No tasks in queue</div>
          <div className="text-sm mt-1">Tasks dispatched to castd will appear here</div>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)] text-[var(--text-muted)]">
                  <th className="px-4 py-3 text-left font-medium text-xs">Agent</th>
                  <th className="px-4 py-3 text-left font-medium text-xs">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-xs">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-xs">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-xs">Retries</th>
                  <th className="px-4 py-3 text-left font-medium text-xs">Result</th>
                  <th className="px-4 py-3 text-left font-medium text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const prio = PRIORITY_COLORS[task.priority] ?? { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF', label: String(task.priority) }
                  const sc = STATUS_COLORS[task.status] ?? { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' }
                  return (
                    <tr key={task.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--accent-subtle)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-secondary)]">{task.agent}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: prio.bg, color: prio.text }}>
                          {prio.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)] font-mono text-xs whitespace-nowrap">
                        {new Date(task.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)] tabular-nums">{task.retry_count}</td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)] max-w-[200px] truncate" title={task.result_summary ?? ''}>
                        {task.result_summary ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(task.id, task.agent)}
                            disabled={deleteTask.isPending}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--error)] hover:bg-[rgba(251,113,133,0.1)] transition-colors disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
