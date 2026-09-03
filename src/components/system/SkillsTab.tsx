import { Zap, Terminal } from 'lucide-react'
import { useSkills, useCommands } from '../../api/useKnowledge'

export default function SkillsTab() {
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
          Skills ({skills?.length ?? 0})
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {(skills ?? []).map(s => (
            <span
              key={s.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
              title={s.description}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
          Commands ({commands?.length ?? 0})
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {(commands ?? []).map(c => (
            <span
              key={c.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors"
            >
              /{c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
