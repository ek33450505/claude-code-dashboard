import { useTasks } from '../../api/useTasks'
import { timeAgo } from '../../utils/time'

export default function TasksCategory() {
  const { data: tasks } = useTasks()

  if (!tasks || tasks.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No scheduled tasks found</p>
  }

  return (
    <div className="grid gap-2">
      {tasks.map(task => (
        <div
          key={task.id}
          className="px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span
                className="text-sm font-medium text-[var(--text-primary)] font-mono block truncate"
                title={task.id}
              >
                {task.id.slice(0, 8)}...
              </span>
              <span className="text-xs text-[var(--text-muted)]">{timeAgo(task.modifiedAt)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {task.hasLock && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-400">
                  locked
                </span>
              )}
              {task.hasConfig && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-400">
                  configured
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
