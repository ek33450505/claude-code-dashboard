import { usePlugins } from '../../api/usePlugins'

export default function PluginsCategory() {
  const { data: plugins } = usePlugins()

  if (!plugins || plugins.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No plugins found</p>
  }

  return (
    <div className="grid gap-2">
      {plugins.map(plugin => (
        <div
          key={plugin.name}
          className="px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)] block truncate">{plugin.name}</span>
              {plugin.provider && (
                <span className="text-xs text-[var(--text-muted)]">{plugin.provider}</span>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              plugin.enabled
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}>
              {plugin.enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
