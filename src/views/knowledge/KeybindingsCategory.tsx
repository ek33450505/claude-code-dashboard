import { useKeybindings } from '../../api/useKeybindings'

export default function KeybindingsCategory() {
  const { data: contexts } = useKeybindings()

  if (!contexts || contexts.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No keybindings found</p>
  }

  return (
    <div className="space-y-4">
      {contexts.map(ctx => (
        <div key={ctx.context}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{ctx.context}</h4>
          <div className="grid gap-1.5">
            {Object.entries(ctx.bindings).map(([key, action]) => (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]"
              >
                <kbd className="shrink-0 px-2 py-0.5 text-xs font-mono rounded border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                  {key}
                </kbd>
                <span className="text-sm text-[var(--text-secondary)]">{action}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
