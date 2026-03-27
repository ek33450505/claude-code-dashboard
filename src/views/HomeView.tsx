import { useState } from 'react'
import { useSystemHealth } from '../api/useSystem'
import { useAnalytics } from '../api/useAnalytics'
import {
  Activity, Users, BookOpen, Layers, Terminal, Zap, ArrowRight,
  GitBranch, Brain, Shield, TrendingUp, Coins, BarChart2, Search,
  Route, ExternalLink, Github, Database, CheckCircle2,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { formatTokens, formatCost } from '../utils/costEstimate'
import { motion, useScroll, useTransform } from 'framer-motion'
import CopyButton from '../components/CopyButton'
import Tabs from '../components/Tabs'
import logo from '../assets/logo.svg'
import { AnimatedGridPattern } from '../components/effects/AnimatedGridPattern'

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
    title: '3-Stage Agent Router',
    description: 'Hook-enforced dispatch fires before Claude responds. Stage 1: 28-route pattern table. Stage 2: 31 parallel agent groups with wave orchestration. Stage 3: catch-all NLU. No slash commands. No manual dispatch.',
    link: '/routing',
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
  {
    icon: Database,
    title: 'Local-First Architecture',
    description: 'All data stays on your machine. No telemetry, no cloud sync, no accounts. Reads ~/.claude/ directly. Agent memory is plain markdown — human-editable, version-controllable, always yours.',
    link: '/knowledge',
    badge: 'Zero cloud',
  },
]

/* ─── Install Steps ─── */
const macLinuxSteps = [
  { num: '01', title: 'Install the Agent Team', cmd: 'git clone https://github.com/ek33450505/claude-agent-team.git && cd claude-agent-team && ./install.sh', description: 'Specialist agents, commands, skills, hook directives, agent groups, routing system, and rules — installed into your ~/.claude/ directory. Three modes: Full (all agents), Core (essentials), or Custom (choose categories).' },
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
  const { scrollY } = useScroll()
  const gridY = useTransform(scrollY, [0, 300], [0, -60])
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0])

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
      <section className="relative pt-20 pb-10 text-center overflow-hidden">
        {/* Animated grid pattern with parallax */}
        <motion.div style={{ y: gridY }} className="absolute inset-0 -z-5">
          <AnimatedGridPattern className="opacity-40" />
        </motion.div>

        {/* Gradient mesh background */}
        <div className="gradient-mesh absolute inset-0 -z-10 rounded-3xl" />

        <motion.div className="flex justify-center mb-6" {...fadeUp(0)} style={{ opacity: heroOpacity }}>
          <img src={logo} alt="Claude Code Dashboard" className="w-20 h-20 drop-shadow-[0_0_24px_rgba(0,255,194,0.3)]" />
        </motion.div>

        <motion.h1
          className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-5"
          {...fadeUp(0.05)}
        >
          Claude Code,{' '}
          <span className="text-[var(--accent)] drop-shadow-[0_0_20px_rgba(0,255,194,0.3)]">upgraded to an OS.</span>
        </motion.h1>

        <motion.p
          className="text-base md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed px-2"
          {...fadeUp(0.15)}
        >
          {health ? `${health.agentCount} specialist agents.` : 'Specialist agents.'} Semantic routing. Local-first execution. Zero cloud lock-in. Hook-enforced dispatch fires before Claude responds — the right agent, every time, automatically.
        </motion.p>

        <motion.div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 px-4" {...fadeUp(0.25)}>
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[#00FFC2]/20 hover:shadow-[#00FFC2]/40 hover:scale-[1.02] no-underline"
          >
            <Users className="w-4 h-4" />
            View Agent Roster
          </Link>
          <Link
            to="/activity"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-transparent text-[var(--text-primary)] font-medium text-sm border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-all backdrop-blur-sm no-underline"
          >
            <Activity className="w-4 h-4" />
            See Live Dispatch
          </Link>
        </motion.div>

        {/* Stats cards inside hero */}
        {allStats.length > 0 && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            {allStats.map(({ label, value, icon: Icon, to }) => (
              <Link key={label} to={to} className="bento-card hover-lift p-4 text-center group cursor-pointer no-underline">
                <Icon className="w-5 h-5 mx-auto mb-2 text-[var(--accent)]" />
                <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{value}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
              </Link>
            ))}
          </motion.div>
        )}
      </section>

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

      {/* ─── How CAST Works ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            How CAST <span className="text-[var(--accent)]">works</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Four interlocking systems that make automatic dispatch reliable and observable.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderTop: '2px solid rgba(0,255,194,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]">
                <Route className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">3-Stage Routing Pipeline</h3>
            </div>
            <div className="space-y-2">
              {[
                { stage: 'Stage 1', desc: '28-pattern keyword table — fast, deterministic dispatch' },
                { stage: 'Stage 2', desc: '31 agent groups with wave-based parallel orchestration' },
                { stage: 'Stage 3', desc: 'NLU catch-all fallback via router agent' },
              ].map(({ stage, desc }) => (
                <div key={stage} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <span className="text-[var(--accent)] font-mono text-[10px] font-bold mt-0.5 shrink-0">{stage}</span>
                  <span className="text-xs text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderTop: '2px solid rgba(129,140,248,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">Hook Enforcement</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: '11 directives', desc: 'injected into context at runtime' },
                { label: 'Pre-tool guard', desc: 'blocks raw git commit/push at the tool layer' },
                { label: 'Post-tool hook', desc: 'logs every agent dispatch after Write/Edit' },
                { label: 'Stop hook', desc: 'writes immutable session checkpoint event' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <span className="text-indigo-400 font-mono text-[10px] font-bold mt-0.5 shrink-0 whitespace-nowrap">{label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderTop: '2px solid rgba(167,139,250,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">Agent Tier System</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: `${health?.agentCount ?? '…'} agents`, desc: 'across 6 functional categories' },
                { label: 'Haiku tier', desc: 'fast mechanical tasks: commit, review, stage' },
                { label: 'Sonnet tier', desc: 'complex reasoning: debugger, architect, planner' },
                { label: 'Wave dispatch', desc: 'parallel multi-agent groups with post-chains' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <span className="text-purple-400 font-mono text-[10px] font-bold mt-0.5 shrink-0 whitespace-nowrap">{label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderTop: '2px solid rgba(34,211,238,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10">
                <Brain className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">Local-First Memory</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Agent memory', desc: '~/.claude/agent-memory-local/ — per-agent context' },
                { label: 'Project memory', desc: 'persists stack, preferences, decisions across sessions' },
                { label: 'Human-editable', desc: 'plain markdown — version-controllable, always yours' },
                { label: 'Zero telemetry', desc: 'all data stays on your machine, no cloud sync' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <span className="text-cyan-400 font-mono text-[10px] font-bold mt-0.5 shrink-0 whitespace-nowrap">{label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
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
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-center">
            <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--glass-border)] min-w-[140px] flex-1 max-w-[200px]">
              <Terminal className="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <div className="text-sm font-semibold">Claude Code CLI</div>
              <div className="text-xs text-[var(--text-muted)]">Your sessions</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--accent)] rotate-90 md:rotate-0 shrink-0" aria-hidden="true" />
            <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--glass-border)] min-w-[140px] flex-1 max-w-[200px]">
              <Layers className="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <div className="text-sm font-semibold">~/.claude/</div>
              <div className="text-xs text-[var(--text-muted)]">Config & logs</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--accent)] rotate-90 md:rotate-0 shrink-0" aria-hidden="true" />
            <div className="p-4 rounded-xl border-2 border-[var(--accent)]/30 bg-[var(--accent-subtle)] min-w-[140px] flex-1 max-w-[200px]">
              <img src={logo} alt="" className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-semibold text-[var(--accent)]">Dashboard</div>
              <div className="text-xs text-[var(--text-muted)]">Observe & manage</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── CAST v2 — Four Enforcement Layers ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Four enforcement <span className="text-[var(--accent)]">layers</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Hook-enforced at the infrastructure layer. No instructions to remember. No manual dispatch required.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          {[
            {
              layer: 'Hook 1',
              event: 'UserPromptSubmit',
              script: 'route.sh',
              token: '[CAST-DISPATCH]',
              colorClass: 'text-[var(--accent)]',
              borderColor: 'rgba(0,255,194,0.2)',
              description: 'Matches every prompt against 22 routes. On match, injects [CAST-DISPATCH] into Claude\'s context — the named specialist fires immediately. For compound workflows, emits [CAST-DISPATCH-GROUP] instead, triggering one of 30 named parallel agent groups with wave-based dispatch.',
            },
            {
              layer: 'Hook 2',
              event: 'PostToolUse',
              script: 'post-tool-hook.sh',
              token: '[CAST-REVIEW]',
              colorClass: 'text-indigo-400',
              borderColor: 'rgba(129,140,248,0.2)',
              description: 'Fires after every Write or Edit tool call. Forces code-reviewer (haiku) dispatch. Also runs prettier auto-format on JS/TS/CSS/JSON. Skips subagents automatically.',
            },
            {
              layer: 'Hook 3',
              event: 'PreToolUse',
              script: 'pre-tool-guard.sh',
              token: 'exit 2 block',
              colorClass: 'text-amber-400',
              borderColor: 'rgba(245,158,11,0.2)',
              description: 'Hard-blocks raw git commit and git push. Tool call never runs. The only path through is the commit agent with CAST_COMMIT_AGENT=1 inline.',
            },
            {
              layer: 'Hook 4',
              event: 'Stop',
              script: 'cast-events.sh',
              token: 'event_written',
              colorClass: 'text-rose-400',
              borderColor: 'rgba(251,113,133,0.2)',
              description: 'Fires on session stop. Writes an immutable timestamped event to ~/.claude/cast/events/. Powers the full audit trail — every session is recorded, nothing is overwritten.',
            },
          ].map(({ layer, event, script, token, colorClass, borderColor, description }) => (
            <motion.div key={layer} variants={item} className="bento-card hover-lift p-7" style={{ borderTop: `2px solid ${borderColor}` }}>
              <div className={`text-xs font-semibold uppercase tracking-wider ${colorClass} mb-1`}>{layer}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono mb-3">{event}</div>
              <h3 className="text-base font-bold mb-1 font-mono">{script}</h3>
              <div className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold mb-4 ${colorClass}`} style={{ background: borderColor }}>
                {token}
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Confidence levels */}
        <motion.div
          className="mt-5 bento-card p-5"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Confidence levels</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20">
              <span className="text-[var(--accent)] font-mono text-xs font-bold mt-0.5">hard</span>
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">MANDATORY: Dispatch the agent</div>
                <div className="text-xs text-[var(--text-muted)]">Agent always fires. Used for commit, debug, build-fix, review.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
              <span className="text-amber-400 font-mono text-xs font-bold mt-0.5">soft</span>
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">RECOMMENDED: Consider dispatching</div>
                <div className="text-xs text-[var(--text-muted)]">Agent fires unless Claude judges unnecessary. Used for researcher, qa-reviewer.</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Event Sourcing Protocol ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Immutable audit trail. <span className="text-[var(--accent)]">Zero overwriting.</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Every task, completion, and review is written as an immutable timestamped event. Full history, forever.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div variants={item} className="bento-card p-7" style={{ borderTop: '2px solid rgba(0,255,194,0.2)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]">
                <Database className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">Event Store</h3>
                <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5">~/.claude/cast/</div>
              </div>
            </div>
            <div className="space-y-2 font-mono text-xs">
              {[
                { dir: 'events/', desc: 'Immutable timestamped event files' },
                { dir: 'state/', desc: 'Derived task state (replayed from events)' },
                { dir: 'reviews/', desc: 'Review decisions with artifact links' },
                { dir: 'artifacts/', desc: 'Plans, patches, test output files' },
              ].map(({ dir, desc }) => (
                <div key={dir} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <span className="text-[var(--accent)] shrink-0">{dir}</span>
                  <span className="text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={item} className="bento-card p-7" style={{ borderTop: '2px solid rgba(0,255,194,0.2)' }}>
            <h3 className="font-bold text-[var(--text-primary)] mb-5">6 Event Types</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'task_created', color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
                { type: 'task_claimed', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { type: 'task_completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { type: 'task_blocked', color: 'text-rose-400', bg: 'bg-rose-500/10' },
                { type: 'artifact_written', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { type: 'review_submitted', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map(({ type, color, bg }) => (
                <div key={type} className={`px-2.5 py-2 rounded-lg ${bg}`}>
                  <span className={`text-[10px] font-mono font-semibold ${color}`}>{type}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-5 leading-relaxed">
              Every event is append-only. cast exec derives state by replaying events — no overwriting, full audit trail from first prompt to final commit.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Status Block Protocol ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Machine-readable status. <span className="text-[var(--accent)]">Observable by default.</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Every agent emits a structured status block. Hooks and the dashboard read these directly — no parsing, no guessing.
          </p>
        </motion.div>
        <motion.div
          className="bento-card p-7"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { status: 'DONE', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', desc: 'Task complete, no concerns' },
              { status: 'DONE_WITH_CONCERNS', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', desc: 'Complete but flagged for review' },
              { status: 'BLOCKED', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', desc: 'Cannot proceed, surfaces to user' },
              { status: 'NEEDS_CONTEXT', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', desc: 'Insufficient info to continue' },
            ].map(({ status, color, bg, border, desc }) => (
              <div key={status} className={`px-3 py-3 rounded-xl ${bg} border ${border}`}>
                <div className={`text-xs font-mono font-bold ${color} mb-1`}>{status}</div>
                <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-xs">
            <div className="text-[var(--text-muted)] mb-2">// Example agent output</div>
            <div className="space-y-0.5">
              <div><span className="text-indigo-400">{'"status"'}</span><span className="text-[var(--text-muted)]">: </span><span className="text-emerald-400">"DONE"</span><span className="text-[var(--text-muted)]">,</span></div>
              <div><span className="text-indigo-400">{'"summary"'}</span><span className="text-[var(--text-muted)]">: </span><span className="text-amber-300">"Fixed TypeError in auth middleware — null check added at line 47"</span><span className="text-[var(--text-muted)]">,</span></div>
              <div><span className="text-indigo-400">{'"artifact_id"'}</span><span className="text-[var(--text-muted)]">: </span><span className="text-amber-300">"batch-2-fix-20260324T142301Z.patch"</span></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Token Savings / Model Tier Discipline ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Model tier <span className="text-[var(--accent)]">discipline</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Haiku costs ~5x less than Sonnet. Every routine task routed to haiku is measurable savings.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div variants={item} className="bento-card p-7" style={{ borderTop: '2px solid rgba(96,165,250,0.3)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">Haiku — Routine &amp; Mechanical</div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Fast, cheap, pattern-following. Used for tasks where the path is clear and creativity isn't required.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['commit', 'code-reviewer', 'build-error-resolver', 'auto-stager', 'refactor-cleaner', 'doc-updater', 'chain-reporter', 'db-reader', 'report-writer', 'meeting-notes', 'verifier', 'push', 'router', 'seo-content', 'linter'].map(a => (
                <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold text-blue-400 bg-blue-500/10">{a}</span>
              ))}
            </div>
          </motion.div>
          <motion.div variants={item} className="bento-card p-7" style={{ borderTop: '2px solid rgba(129,140,248,0.3)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">Sonnet — Reasoning &amp; Analysis</div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Full reasoning capability. Used when the task requires understanding context, making decisions, or handling ambiguity.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['debugger', 'test-writer', 'planner', 'security', 'architect', 'tdd-guide', 'e2e-runner', 'readme-writer', 'researcher', 'qa-reviewer', 'morning-briefing', 'bash-specialist', 'data-scientist', 'email-manager', 'browser', 'presenter', 'test-runner', 'devops', 'performance'].map(a => (
                <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold text-indigo-400 bg-indigo-500/10">{a}</span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── 6 Functional Agent Tiers ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Six functional <span className="text-[var(--accent)]">tiers</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Specialist agents organized by role. Every tier serves a different part of the development lifecycle.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          {[
            { tier: 'Core', count: 10, color: 'text-[var(--accent)]', border: 'rgba(0,255,194,0.2)', agents: ['commit', 'debugger', 'planner', 'code-reviewer', 'test-writer', 'security', 'data-scientist', 'db-reader', 'push', 'bash-specialist'] },
            { tier: 'Extended', count: 8, color: 'text-indigo-400', border: 'rgba(129,140,248,0.2)', agents: ['architect', 'tdd-guide', 'build-error-resolver', 'e2e-runner', 'refactor-cleaner', 'doc-updater', 'readme-writer', 'router'] },
            { tier: 'Plan Execution', count: 4, color: 'text-purple-400', border: 'rgba(167,139,250,0.2)', agents: ['auto-stager', 'chain-reporter', 'verifier', 'test-runner'] },
            { tier: 'Productivity', count: 5, color: 'text-amber-400', border: 'rgba(245,158,11,0.2)', agents: ['researcher', 'report-writer', 'meeting-notes', 'email-manager', 'morning-briefing'] },
            { tier: 'Professional', count: 3, color: 'text-rose-400', border: 'rgba(251,113,133,0.2)', agents: ['browser', 'qa-reviewer', 'presenter'] },
            { tier: 'Specialist', count: 4, color: 'text-cyan-400', border: 'rgba(34,211,238,0.2)', agents: ['devops', 'performance', 'seo-content', 'linter'] },
          ].map(({ tier, count, color, border, agents }) => (
            <motion.div key={tier} variants={item} className="bento-card hover-lift p-6" style={{ borderTop: `2px solid ${border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{tier}</div>
                <span className={`text-xs font-mono font-bold ${color} opacity-60`}>{count} agents</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agents.map(a => (
                  <span key={a} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${color}`} style={{ background: border }}>{a}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Named Agent Groups ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            30 named workflows. <span className="text-[var(--accent)]">Natural language triggers.</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Say "ship it" and three agents coordinate in parallel waves. No slash commands memorized.
          </p>
        </motion.div>
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="bento-card p-7">
            <div className="flex flex-wrap gap-2 mb-6">
              {['ship it', 'pre-release check', 'fix and ship', 'security audit', 'good morning', 'daily standup', 'code review', 'refactor sprint', 'debug and fix', 'document it', 'full test run', 'deploy prep', 'feature build', 'ui build', 'backend build', 'quality sweep'].map(name => (
                <span
                  key={name}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--glass-border)] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors cursor-default"
                >
                  {name}
                </span>
              ))}
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--text-muted)]">+ 14 more</span>
            </div>
            <div className="border-t border-[var(--border)] pt-5">
              <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Example: "ship it"</div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                <div className="px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-xs font-mono text-[var(--accent)]">
                  "ship it"
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] rotate-90 sm:rotate-0 shrink-0" />
                <div className="flex flex-wrap gap-2">
                  <div className="text-[10px] text-[var(--text-muted)] self-center">Wave 1 (parallel):</div>
                  {['verifier', 'test-runner', 'devops'].map(a => (
                    <span key={a} className="px-2 py-1 rounded text-[10px] font-mono font-semibold text-[var(--accent)] bg-[var(--accent)]/10">{a}</span>
                  ))}
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] rotate-90 sm:rotate-0 shrink-0" />
                <div className="flex flex-wrap gap-2">
                  <div className="text-[10px] text-[var(--text-muted)] self-center">Post-chain:</div>
                  {['auto-stager', 'commit', 'push'].map(a => (
                    <span key={a} className="px-2 py-1 rounded text-[10px] font-mono font-semibold text-blue-400 bg-blue-500/10">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Memory Architecture ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Two memory layers. Full context. <span className="text-[var(--accent)]">Every session.</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            You never re-explain your stack, preferences, or project history. Memory persists across sessions, projects, and agents.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div variants={item} className="bento-card hover-lift p-7">
            <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">Project Memory</div>
            <div className="text-xs font-mono text-[var(--text-muted)] mb-4">~/.claude/projects/&lt;hash&gt;/memory/</div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Project-specific context loaded into every session automatically. Claude remembers your stack, your feedback, and decisions made — without being told twice.
            </p>
            <div className="space-y-2">
              {[
                { type: 'user', desc: 'Role, expertise, preferences' },
                { type: 'feedback', desc: 'Corrections and confirmed approaches' },
                { type: 'project', desc: 'Goals, decisions, deadlines' },
                { type: 'reference', desc: 'Where info lives externally' },
              ].map(({ type, desc }) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded font-mono font-semibold text-purple-400 bg-purple-500/10">{type}</span>
                  <span className="text-[var(--text-muted)]">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={item} className="bento-card hover-lift p-7">
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">Agent Memory</div>
            <div className="text-xs font-mono text-[var(--text-muted)] mb-4">~/.claude/agent-memory-local/&lt;agent&gt;/</div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Each specialist maintains its own memory, isolated per-agent. The debugger remembers where bugs appeared. The commit agent remembers your message style. Every agent improves over time.
            </p>
            <div className="space-y-1.5">
              {['debugger', 'planner', 'code-reviewer', 'commit', 'test-writer'].map(agent => (
                <div key={agent} className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" />
                  {agent}/MEMORY.md
                </div>
              ))}
              <div className="text-xs text-[var(--text-muted)] pl-3.5 pt-1">+ {health?.agentCount ? health.agentCount - 5 : '…'} more agents</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── /cast Command Guide ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center font-mono">
            The <span className="text-[var(--accent)]">/cast</span> Command
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            Your universal agent dispatcher. Describe what you need and /cast routes it to the right specialist.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          {/* Usage Syntax */}
          <motion.div variants={item} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]">
                <Terminal className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg">Usage</h3>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] group max-w-sm">
              <code className="text-sm font-mono text-[var(--accent)] flex-1">/cast &lt;your request&gt;</code>
              <CopyButton text="/cast <your request>" size={14} />
            </div>
          </motion.div>

          {/* Examples */}
          <motion.div variants={item} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]">
                <Zap className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg">Examples</h3>
            </div>
            <div className="flex flex-col gap-4">
              {[
                {
                  cmd: '/cast add dark mode toggle to settings',
                  dispatches: 'planner',
                  tier: 'sonnet',
                },
                {
                  cmd: '/cast fix the TypeError in login handler',
                  dispatches: 'debugger',
                  tier: 'sonnet',
                },
                {
                  cmd: '/cast review my latest changes and commit',
                  dispatches: 'code-reviewer → commit',
                  tier: 'chain',
                },
              ].map(({ cmd, dispatches, tier }) => (
                <div key={cmd} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] group">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Terminal className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    <code className="text-xs font-mono text-[var(--accent)] truncate">{cmd}</code>
                    <CopyButton text={cmd} size={13} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] hidden sm:block" />
                    <span className="text-xs text-[var(--text-muted)]">dispatches</span>
                    {tier === 'chain' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/15">
                        {dispatches}
                      </span>
                    ) : tier === 'sonnet' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/15">
                        {dispatches}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-blue-400 bg-blue-500/15">
                        {dispatches}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* When to use /cast vs direct */}
          <motion.div variants={item} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]">
                <Route className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg">/cast vs Direct Commands</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="px-4 py-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20">
                <div className="text-xs font-semibold text-[var(--accent)] mb-1.5">Use /cast when</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Your request is complex or ambiguous — /cast interprets intent and routes to the right specialist automatically.</p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Use direct commands when</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">You know exactly which agent you need — <code className="text-xs font-mono text-[var(--accent)]">/commit</code>, <code className="text-xs font-mono text-[var(--accent)]">/review</code>, <code className="text-xs font-mono text-[var(--accent)]">/debug</code> for single known tasks.</p>
              </div>
            </div>
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

      {/* ─── Phase Timeline ─── */}
      <section className="mb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
            Building in <span className="text-[var(--accent)]">public</span>
          </h2>
          <p className="text-center text-sm text-[var(--text-muted)] mb-10">
            CAST is shipping incrementally. Each phase adds a layer of the OS.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          {[
            { phase: 1, name: 'Foundation', desc: 'Core agents, routing, hooks', done: true },
            { phase: 2, name: 'Observability', desc: 'Dashboard, SSE, session replay', done: true },
            { phase: 3, name: 'Automation', desc: 'Parallel dispatch, CAST groups', done: true },
            { phase: 4, name: 'Memory', desc: 'Agent memory, project context', done: true },
            { phase: 5, name: 'Field Ops', desc: 'cast exec, plan files, CAST guide', done: true },
            { phase: 6, name: 'Daemon', desc: 'castd, task queue, local-first OS', done: true },
            { phase: 7, name: 'Analytics', desc: 'Token spend, cost tracking, SQLite', done: true },
            { phase: 8, name: 'OS Panels', desc: 'cast.db integration, 6 Local-OS panels', done: true },
            { phase: 9, name: 'OS UI', desc: 'Activity Monitor, marketing landing page', done: false },
            { phase: 10, name: 'Embedded Terminal', desc: 'node-pty + xterm.js live terminal', done: false },
          ].map(({ phase, name, desc, done }) => (
            <motion.div key={phase} variants={item} className={`bento-card p-4 ${done ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[var(--text-muted)]">Phase {phase}</span>
                {done ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-emerald-400 bg-emerald-500/10">
                    <CheckCircle2 className="w-2.5 h-2.5" /> DONE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold text-[var(--text-muted)] bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
                    upcoming
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">{name}</div>
              <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{desc}</div>
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
          {/* Stats bar */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 w-full mb-2">
            {[
              { value: health?.agentCount ?? '…', label: 'agents' },
              { value: health?.hooks?.length ?? '…', label: 'workflows' },
              { value: health?.ruleCount ?? '…', label: 'routes' },
              { value: health?.commandCount ?? '…', label: 'commands' },
              { value: health?.skillCount ?? '11', label: 'skills' },
              { value: '106', label: 'tests ✓' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold font-mono text-[var(--accent)]">{value}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
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
