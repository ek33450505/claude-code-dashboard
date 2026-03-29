interface RoutingCategoryProps {
  onViewFile: (title: string, body: string) => void
}

const DISPATCH_TABLE = `# CAST v3 Dispatch Table

CAST v3 uses **model-driven dispatch** — no routing scripts, no regex matching.

\`CLAUDE.md\` contains a 15-row dispatch table. When a prompt arrives, the model reads the table and decides which agent to call via the Agent tool.

## Agent → Model Mapping

| Model | Agents |
|-------|--------|
| **Sonnet** | code-writer, debugger, planner, security, merge, researcher, docs, bash-specialist, orchestrator, morning-briefing, devops |
| **Haiku** | code-reviewer, commit, push, test-runner |

## Post-Chain Protocol

After code changes: \`code-reviewer → commit → push\`
After security-sensitive changes: \`[code-reviewer, security] (parallel) → commit → push\`
`

export default function RoutingCategory({ onViewFile }: RoutingCategoryProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        CAST v3 uses model-driven dispatch via <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--accent)] font-mono">CLAUDE.md</code> — no routing table or regex patterns.
      </p>
      <button
        onClick={() => onViewFile('CAST v3 Dispatch', DISPATCH_TABLE)}
        className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">Dispatch Table</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">15 agents, 2 model tiers</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--accent)]/20 text-[var(--accent)]">
            v3
          </span>
        </div>
      </button>
    </div>
  )
}
