import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database
} from 'lucide-react'
import { useSystemHealth } from '../api/useSystem'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import CopyButton from '../components/CopyButton'

export default function SystemView() {
  const { data: health, isLoading } = useSystemHealth()

  const statRows = health
    ? [
        [
          { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" /> },
          { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" /> },
          { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" /> },
          { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" /> },
        ],
        [
          { label: 'Plans', value: health.planCount, icon: <FileText className="w-5 h-5" /> },
          { label: 'Rules', value: health.ruleCount, icon: <Shield className="w-5 h-5" /> },
          { label: 'Project Memories', value: health.projectMemoryCount, icon: <Brain className="w-5 h-5" /> },
          { label: 'Agent Memories', value: health.agentMemoryCount, icon: <Database className="w-5 h-5" /> },
        ],
      ]
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Overview</h1>

      {/* Stat cards */}
      {isLoading ? (
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {statRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {row.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Active Hooks */}
      {health && health.hooks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Active Hooks</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Matcher</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {health.hooks.map((hook, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/20 text-[var(--accent-hover)]">
                        {hook.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{hook.type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        {hook.matcher ?? '\u2014'}
                        {hook.matcher && <CopyButton text={hook.matcher} size={12} />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {hook.description ?? '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Environment */}
      {health && Object.keys(health.env).length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Environment</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {Object.entries(health.env).map(([key, val]) => (
                <div key={key} className="flex gap-3">
                  <dt className="text-[var(--text-muted)] font-medium min-w-[120px] shrink-0">{key}</dt>
                  <dd className="text-[var(--text-secondary)] font-mono text-xs break-all flex items-start gap-1">
                    <span>{val}</span>
                    <CopyButton text={String(val)} size={12} className="shrink-0 mt-[-2px]" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
    </div>
  )
}
