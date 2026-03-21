import { useSystemHealth } from '../api/useSystem'
import { useAnalytics } from '../api/useAnalytics'
import { Activity, Users, BookOpen, Layers, Terminal, Zap, ArrowRight, GitBranch, Brain, Shield, TrendingUp, Coins, BarChart2, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatTokens, formatCost } from '../utils/costEstimate'
import CopyButton from '../components/CopyButton'
import logo from '../assets/logo.svg'

const features = [
  {
    icon: Activity,
    title: 'Live Activity',
    description: 'Real-time streaming of Claude Code sessions via SSE. Watch tool calls, agent spawns, and progress as they happen.',
    link: '/activity',
  },
  {
    icon: Users,
    title: 'Agent Management',
    description: 'Browse, configure, and create agents directly from the dashboard. Edit frontmatter fields without touching markdown files.',
    link: '/agents',
  },
  {
    icon: Layers,
    title: 'Session Replay',
    description: 'Full session history with token usage, cost tracking, tool call details, markdown export, and sidechain visualization.',
    link: '/sessions',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description: 'All your local Claude config in one place — memory, rules, plans, settings, skills, and commands with copy-to-clipboard.',
    link: '/knowledge',
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    description: 'Daily token burn trends, cost breakdowns by model and project, tool call frequency charts, and per-session spend tracking.',
    link: '/analytics',
  },
  {
    icon: Search,
    title: 'Global Search',
    description: 'Cmd+K command palette to instantly find sessions, agents, plans, and memories across your entire setup.',
    link: '/sessions',
  },
  {
    icon: Brain,
    title: 'Memory Explorer',
    description: 'Browse agent-learned patterns and project-specific context. See what Claude remembers across conversations.',
    link: '/knowledge',
  },
  {
    icon: Shield,
    title: 'System Overview',
    description: 'Health checks, hook configuration, environment details, and framework-wide statistics at a glance.',
    link: '/system',
  },
]

const steps = [
  { num: '01', title: 'Clone the dashboard', cmd: 'git clone https://github.com/ek33450505/claude-code-dashboard.git', description: 'Clone the repo. Works with any ~/.claude/ directory — no extra framework required.' },
  { num: '02', title: 'Install & start', cmd: 'cd claude-code-dashboard && npm install && npm run dev', description: 'The dashboard auto-discovers your ~/.claude/ configuration and starts streaming.' },
  { num: '03', title: 'Use Claude Code normally', description: 'Monitor sessions, manage agents, track costs, and browse your entire setup from the dashboard.' },
]

export default function HomeView() {
  const { data: health } = useSystemHealth()
  const { data: analytics } = useAnalytics()

  const stats = health ? [
    { label: 'Agents', value: String(health.agentCount), icon: Users },
    { label: 'Commands', value: String(health.commandCount), icon: Terminal },
    { label: 'Skills', value: String(health.skillCount), icon: Zap },
    { label: 'Plans', value: String(health.planCount), icon: GitBranch },
    { label: 'Sessions', value: String(health.sessionCount), icon: Activity },
    { label: 'Rules', value: String(health.ruleCount), icon: Shield },
    ...(analytics ? [
      { label: 'Total Tokens', value: formatTokens(analytics.totalInputTokens + analytics.totalOutputTokens), icon: TrendingUp },
      { label: 'Est. Spend', value: formatCost(analytics.estimatedCostUSD), icon: Coins },
    ] : []),
  ] : []

  return (
    <div className="max-w-6xl mx-auto animate-in">
      {/* Hero */}
      <section className="py-16 text-center">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="Claude Code Dashboard" className="w-20 h-20" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Claude Code <span className="text-[var(--accent)]">Dashboard</span>
        </h1>
        <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-8 leading-relaxed">
          The complete observability and configuration layer for Claude Code.
          Token analytics, cost tracking, agent management, session replay, and your entire ~/.claude/ setup — from one interface.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/activity"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[#00FFC2]/20"
          >
            <Activity className="w-4 h-4" />
            Live Activity
          </Link>
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-sm border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-colors"
          >
            <Users className="w-4 h-4" />
            Browse Agents
          </Link>
        </div>
      </section>

      {/* Live Stats */}
      {stats.length > 0 && (
        <section className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bento-card p-4 text-center">
                <Icon className="w-5 h-5 mx-auto mb-2 text-[var(--accent)]" />
                <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{value}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight mb-6 text-center">
          Everything in <span className="text-[var(--accent)]">one place</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, description, link }) => (
            <Link key={title} to={link} className="bento-card p-6 group cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                Explore <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight mb-6 text-center">
          How it <span className="text-[var(--accent)]">works</span>
        </h2>
        <div className="bento-card p-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--glass-border)] min-w-[140px]">
              <Terminal className="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <div className="text-sm font-semibold">Claude Code CLI</div>
              <div className="text-xs text-[var(--text-muted)]">Your sessions</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--accent)] rotate-90 md:rotate-0 shrink-0" />
            <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--glass-border)] min-w-[140px]">
              <Layers className="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <div className="text-sm font-semibold">~/.claude/</div>
              <div className="text-xs text-[var(--text-muted)]">Config & logs</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--accent)] rotate-90 md:rotate-0 shrink-0" />
            <div className="p-4 rounded-xl border-2 border-[var(--accent)]/30 bg-[var(--accent-subtle)] min-w-[140px]">
              <img src={logo} alt="" className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-semibold text-[var(--accent)]">Dashboard</div>
              <div className="text-xs text-[var(--text-muted)]">Observe & manage</div>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight mb-6 text-center">
          Get <span className="text-[var(--accent)]">started</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map(({ num, title, cmd, description }) => (
            <div key={num} className="bento-card p-6">
              <div className="text-3xl font-bold font-mono text-[var(--accent)] mb-3 opacity-40">{num}</div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
              {cmd && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] group">
                  <code className="text-xs font-mono text-[var(--accent)] flex-1 truncate">{cmd}</code>
                  <CopyButton text={cmd} size={13} />
                </div>
              )}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        Claude Code Dashboard &middot; Built for the Claude Code ecosystem
      </footer>
    </div>
  )
}
