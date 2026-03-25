import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database, Route
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSystemHealth } from '../api/useSystem'
import { useRoutingStats } from '../api/useRouting'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import CopyButton from '../components/CopyButton'

function maskValue(key: string, val: string): string {
  return /key|token|secret|password|auth|credential/i.test(key) ? '••••••••' : val
}

export default function SystemView() {
  const { data: health, isLoading } = useSystemHealth()
  const { data: routing } = useRoutingStats()

  const statRows = health
    ? [
        [
          { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" />, to: '/agents' },
          { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" />, to: '/sessions' },
        ],
        [
          { label: 'Plans', value: health.planCount, icon: <FileText className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Rules', value: health.ruleCount, icon: <Shield className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Project Memories', value: health.projectMemoryCount, icon: <Brain className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Agent Memories', value: health.agentMemoryCount, icon: <Database className="w-5 h-5" />, to: '/knowledge' },
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
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Matcher</th>
                  <th className="text-left px-4 py-3 font-medium">Command</th>
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
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)] max-w-[320px]">
                      <span className="inline-flex items-start gap-1">
                        <span className="break-all">{hook.command ?? hook.description ?? '\u2014'}</span>
                        {hook.command && <CopyButton text={hook.command} size={12} className="shrink-0 mt-[-1px]" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Agent Routing — link card to /routing */}
      <section className="mb-8">
        <Link
          to="/routing"
          className="flex items-center justify-between p-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/40 transition-colors group no-underline"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)]">
              <Route className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Agent Routing</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {routing ? `${routing.totalEvents} events · ${routing.routedCount} matched · ${(routing.routingRate * 100).toFixed(0)}% pattern match rate` : 'Routing analytics, dispatch history, and agent performance'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--accent)] opacity-60 group-hover:opacity-100 transition-opacity">
            View details
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>
      </section>

      {/* Slash Commands */}
      <section className="mb-8">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 select-none">
              <Terminal className="w-4 h-4 text-[var(--accent)]" />
              Slash Commands
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                {health ? `${health.commandCount} available` : '32 available'}
              </span>
            </h2>
            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                '/plan', '/debug', '/test', '/review', '/commit', '/push', '/secure',
                '/data', '/query', '/architect', '/tdd', '/e2e', '/build-fix', '/refactor',
                '/docs', '/readme', '/research', '/report', '/meeting', '/email', '/morning',
                '/browser', '/qa', '/present', '/stage', '/verify', '/orchestrate', '/cast',
                '/cast-stats', '/help', '/eval', '/loop',
              ].map(cmd => (
                <span
                  key={cmd}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors"
                >
                  {cmd}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>

      {/* Skills */}
      <section className="mb-8">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 select-none">
              <Zap className="w-4 h-4 text-[var(--accent)]" />
              Skills
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                {health ? `${health.skillCount} available` : '12 available'}
              </span>
            </h2>
            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                'action-items', 'briefing-writer', 'git-activity', 'careful-mode',
                'freeze-mode', 'wizard', 'calendar-fetch', 'inbox-fetch',
                'reminders-fetch', 'calendar-fetch-linux', 'plan', 'loop',
              ].map(skill => (
                <span
                  key={skill}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>

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
                    <span>{maskValue(key, String(val))}</span>
                    {!/key|token|secret|password|auth|credential/i.test(key) && (
                      <CopyButton text={String(val)} size={12} className="shrink-0 mt-[-2px]" />
                    )}
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
