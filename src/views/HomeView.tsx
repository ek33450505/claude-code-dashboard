import { useState, useEffect, useRef } from 'react'
import { useSystemHealth } from '../api/useSystem'
import { useAnalytics } from '../api/useAnalytics'
import {
  Activity, Users, BookOpen, Layers, Terminal, Zap, ArrowRight,
  GitBranch, Brain, Shield, TrendingUp, Coins, BarChart2, Search,
  Route, ExternalLink, Github,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { formatTokens, formatCost } from '../utils/costEstimate'
import { motion, useInView, motionValue, animate } from 'framer-motion'
import CopyButton from '../components/CopyButton'
import Tabs from '../components/Tabs'
import logo from '../assets/logo.svg'

/* ─── Animation Variants ─── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
})

/* ─── Animated Counter ─── */
function AnimatedCounter({ value, prefix = '' }: { value: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const numericPart = value.replace(/[^0-9.]/g, '')
  // Split prefix symbols (like $) from trailing suffix (like K, M, B)
  const leadingSymbols = value.match(/^[^0-9]*/)?.[0] ?? ''
  const suffix = value.match(/[^0-9.]*$/)?.[0] ?? ''

  useEffect(() => {
    if (!isInView || !ref.current) return
    const target = parseFloat(numericPart)
    if (isNaN(target)) {
      if (ref.current) ref.current.textContent = prefix + value
      return
    }
    const mv = motionValue(0)
    const controls = animate(mv, target, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) {
          const formatted = target >= 100 ? Math.round(v).toLocaleString() : v.toFixed(target % 1 !== 0 ? 1 : 0)
          ref.current.textContent = prefix + leadingSymbols + formatted + suffix
        }
      },
    })
    return () => controls.stop()
  }, [isInView, value, numericPart, suffix, prefix])

  return <span ref={ref}>{prefix}{value}</span>
}

/* ─── Feature Data ─── */
const features: Array<{
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  link: string
  badge?: string
}> = [
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
    icon: Route,
    title: 'Agent Router',
    description: 'Phase 2 auto-dispatch — every prompt is matched against a routing table and the right agent is dispatched directly.',
    link: '/system',
    badge: 'Auto-dispatch',
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

/* ─── Install Steps ─── */
const macLinuxSteps = [
  { num: '01', title: 'Install the Agent Team', cmd: 'git clone https://github.com/ek33450505/claude-agent-team.git && cd claude-agent-team && ./install.sh', description: '28 agents, 28 commands, 9 skills, hooks, routing system, and rules — installed into your ~/.claude/ directory.' },
  { num: '02', title: 'Clone the Dashboard', cmd: 'git clone https://github.com/ek33450505/claude-code-dashboard.git', description: 'The observability layer. Also works standalone with any ~/.claude/ directory.' },
  { num: '03', title: 'Start the Dashboard', cmd: 'cd claude-code-dashboard && npm install && npm run dev', description: 'Auto-discovers your config, streams live activity, and tracks costs across all sessions.' },
  { num: '04', title: 'Use Claude Code', description: 'Monitor sessions, manage agents, track costs, search everything, and browse your entire setup — all from one interface.' },
]

const manualSteps = [
  { num: '01', title: 'Clone Both Repos', cmd: 'git clone https://github.com/ek33450505/claude-agent-team.git\ngit clone https://github.com/ek33450505/claude-code-dashboard.git', description: 'Download the agent team and the dashboard repos.' },
  { num: '02', title: 'Copy Agents & Config', cmd: 'cp -r claude-agent-team/agents ~/.claude/agents\ncp -r claude-agent-team/commands ~/.claude/commands\ncp -r claude-agent-team/skills ~/.claude/skills', description: 'Manually copy agent definitions, slash commands, and skills into your ~/.claude/ directory.' },
  { num: '03', title: 'Install Dashboard', cmd: 'cd claude-code-dashboard && npm install', description: 'Install the dashboard dependencies.' },
  { num: '04', title: 'Start Dashboard', cmd: 'npm run dev', description: 'Launch the dashboard at localhost:5173.' },
]

/* ─── Component ─── */
export default function HomeView() {
  const { data: health } = useSystemHealth()
  const { data: analytics } = useAnalytics()
  const [installTab, setInstallTab] = useState('macos')

  const heroStats = health ? [
    { label: 'Agents', value: String(health.agentCount) },
    { label: 'Sessions', value: String(health.sessionCount) },
    { label: 'Plans', value: String(health.planCount) },
    ...(analytics ? [{ label: 'Est. Spend', value: formatCost(analytics.estimatedCostUSD) }] : []),
  ] : []

  const allStats = health ? [
    { label: 'Agents', value: String(health.agentCount), icon: Users, to: '/agents' },
    { label: 'Commands', value: String(health.commandCount), icon: Terminal, to: '/knowledge' },
    { label: 'Skills', value: String(health.skillCount), icon: Zap, to: '/knowledge' },
    { label: 'Plans', value: String(health.planCount), icon: GitBranch, to: '/knowledge' },
    { label: 'Sessions', value: String(health.sessionCount), icon: Activity, to: '/sessions' },
    { label: 'Rules', value: String(health.ruleCount), icon: Shield, to: '/knowledge' },
    ...(analytics ? [
      { label: 'Total Tokens', value: formatTokens(analytics.totalInputTokens + analytics.totalOutputTokens), icon: TrendingUp, to: '/analytics' },
      { label: 'Est. Spend', value: formatCost(analytics.estimatedCostUSD), icon: Coins, to: '/analytics' },
    ] : []),
  ] : []

  const currentSteps = installTab === 'macos' ? macLinuxSteps : manualSteps

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Hero Section ─── */}
      <section className="relative py-20 text-center overflow-hidden">
        {/* Gradient mesh background */}
        <div className="gradient-mesh absolute inset-0 -z-10 rounded-3xl" />

        <motion.div className="flex justify-center mb-6" {...fadeUp(0)}>
          <img src={logo} alt="Claude Code Dashboard" className="w-20 h-20 drop-shadow-[0_0_24px_rgba(0,255,194,0.3)]" />
        </motion.div>

        <motion.h1
          className="text-5xl md:text-6xl font-bold tracking-tight mb-5"
          {...fadeUp(0.05)}
        >
          Claude Code{' '}
          <span className="text-[var(--accent)] drop-shadow-[0_0_20px_rgba(0,255,194,0.3)]">Dashboard</span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
          {...fadeUp(0.15)}
        >
          The complete observability and configuration layer for Claude Code.
          Token analytics, cost tracking, agent management, session replay, and your entire ~/.claude/ setup — from one interface.
        </motion.p>

        <motion.div className="flex gap-4 justify-center flex-wrap mb-12" {...fadeUp(0.25)}>
          <a
            href="https://github.com/ek33450505/claude-agent-team"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[#00FFC2]/20 hover:shadow-[#00FFC2]/40 hover:scale-[1.02] no-underline"
          >
            <Zap className="w-4 h-4" />
            Install Agent Team
          </a>
          <a
            href="https://github.com/ek33450505/claude-code-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-transparent text-[var(--text-primary)] font-medium text-sm border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-all backdrop-blur-sm no-underline"
          >
            <Github className="w-4 h-4" />
            View on GitHub
          </a>
        </motion.div>

        {/* Live stats counters */}
        {heroStats.length > 0 && (
          <motion.div
            className="flex justify-center gap-8 md:gap-12 flex-wrap"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {heroStats.map(({ label, value }) => (
              <motion.div key={label} variants={item} className="text-center">
                <div className="text-3xl md:text-4xl font-bold font-mono text-[var(--text-primary)]">
                  <AnimatedCounter value={value} />
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider">{label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* ─── Full Stats Bar ─── */}
      {allStats.length > 0 && (
        <motion.section
          className="mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 px-4">
            {allStats.map(({ label, value, icon: Icon, to }) => (
              <Link key={label} to={to} className="bento-card hover-lift p-4 text-center group cursor-pointer no-underline">
                <Icon className="w-5 h-5 mx-auto mb-2 text-[var(--accent)]" />
                <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{value}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* ─── Feature Showcase ─── */}
      <section className="mb-20">
        <motion.h2
          className="text-3xl font-bold tracking-tight mb-8 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Everything in <span className="text-[var(--accent)]">one place</span>
        </motion.h2>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          {features.map(({ icon: Icon, title, description, link, badge }) => (
            <motion.div key={title} variants={item}>
              <Link to={link} className="bento-card hover-lift p-7 group cursor-pointer block h-full no-underline">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]">
                    <Icon className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] text-lg">{title}</h3>
                  {badge && (
                    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent)]/20 text-[var(--accent)] whitespace-nowrap">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
                <div className="mt-5 flex items-center gap-1 text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Architecture Diagram ─── */}
      <motion.section
        className="mb-20"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold tracking-tight mb-8 text-center">
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
      </motion.section>

      {/* ─── CAST System ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            The <span className="text-[var(--accent)]">CAST</span> System
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">Claude Agent System & Team — three layers that work together</p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderImage: 'linear-gradient(to bottom, rgba(99,102,241,0.3), transparent) 1', borderImageSlice: 1 }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">Layer 1 -- Agents</div>
            <h3 className="text-lg font-bold mb-2">Claude Agent Team</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">28 specialized agents, 28 slash commands, 9 skills. Each agent has a defined role, model assignment, and trigger conditions.</p>
            <a href="https://github.com/ek33450505/claude-agent-team" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              github.com/ek33450505/claude-agent-team <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderImage: 'linear-gradient(to bottom, rgba(6,182,212,0.3), transparent) 1', borderImageSlice: 1 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Layer 2 -- Intelligence</div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400">Phase 2</span>
            </div>
            <h3 className="text-lg font-bold mb-2">Agent Router</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">Hook-based routing that intercepts every prompt and <span className="text-cyan-400 font-medium">dispatches the right agent directly</span> — no commands needed, no confirmation required.</p>
            <span className="text-xs text-[var(--text-muted)]">UserPromptSubmit hook -- routing-table.json -- auto-dispatch</span>
          </motion.div>
          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderImage: 'linear-gradient(to bottom, rgba(0,255,194,0.3), transparent) 1', borderImageSlice: 1 }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3">Layer 3 -- Visibility</div>
            <h3 className="text-lg font-bold mb-2">Claude Code Dashboard</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">Real-time observability — live activity feed, routing events, model badges, cost analytics, and agent management.</p>
            <a href="https://github.com/ek33450505/claude-code-dashboard" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
              github.com/ek33450505/claude-code-dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Getting Started ─── */}
      <section className="mb-20">
        <motion.h2
          className="text-3xl font-bold tracking-tight mb-8 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Get <span className="text-[var(--accent)]">started</span>
        </motion.h2>

        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'macos', label: 'macOS / Linux' },
              { id: 'manual', label: 'Manual Setup' },
            ]}
            activeTab={installTab}
            onChange={setInstallTab}
          />
        </div>

        <motion.div
          key={installTab}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {currentSteps.map(({ num, title, cmd, description }) => (
            <motion.div key={num} variants={item} className="bento-card hover-lift p-6">
              <div className="text-3xl font-bold font-mono text-[var(--accent)] mb-3 opacity-40">{num}</div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
              {cmd && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] group">
                  <code className="text-xs font-mono text-[var(--accent)] flex-1 whitespace-pre-wrap break-all">{cmd}</code>
                  <CopyButton text={cmd} size={13} />
                </div>
              )}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Social Proof / Badges ─── */}
      <motion.section
        className="mb-20 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="bento-card p-8 inline-flex flex-col items-center gap-5 mx-auto">
          <img
            src="https://img.shields.io/github/stars/ek33450505/claude-code-dashboard?style=social"
            alt="GitHub Stars"
            className="h-5"
          />
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Built for Claude Code power users
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <a
              href="https://github.com/ek33450505/claude-agent-team"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              <Github className="w-3.5 h-3.5" /> claude-agent-team
            </a>
            <a
              href="https://github.com/ek33450505/claude-code-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              <Github className="w-3.5 h-3.5" /> claude-code-dashboard
            </a>
          </div>
        </div>
      </motion.section>

      {/* ─── Footer ─── */}
      <footer className="py-10 border-t border-[var(--border)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="" className="w-5 h-5" />
              <span className="font-semibold text-sm text-[var(--text-primary)]">Claude Code Dashboard</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Part of the <span className="text-[var(--accent)]">CAST</span> system — Claude Agent System & Team.
            </p>
          </div>

          {/* Links */}
          <div>
            <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Links</div>
            <div className="flex flex-col gap-2">
              <a href="https://github.com/ek33450505/claude-code-dashboard" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">GitHub — Dashboard</a>
              <a href="https://github.com/ek33450505/claude-agent-team" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">GitHub — Agent Team</a>
              <Link to="/system" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors no-underline">System Overview</Link>
              <Link to="/knowledge" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors no-underline">Documentation</Link>
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Info</div>
            <div className="flex flex-col gap-2">
              {health?.version && <div className="text-xs text-[var(--text-muted)]">Version {health.version}</div>}
              <div className="text-xs text-[var(--text-muted)]">{health?.agentCount ?? '...'} agents, {health?.commandCount ?? '...'} commands, {health?.skillCount ?? '...'} skills</div>
              <Link to="/system" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors no-underline">CAST System</Link>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-[var(--text-muted)] pt-6 border-t border-[var(--border)]">
          <span>&copy; {new Date().getFullYear()} Built by{' '}
            <a href="https://github.com/ek33450505" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">Ed Kubiak</a>
          </span>
          <span className="opacity-30 mx-2">--</span>
          <span>Part of the <span className="text-[var(--accent)]">CAST</span> system</span>
        </div>
      </footer>
    </div>
  )
}
