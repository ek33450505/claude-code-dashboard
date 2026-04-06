import { Terminal, Bot, Blocks, Command, Hash } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

// ── Data ───────────────────────────────────────────────────────────────────

const SLASH_COMMANDS = [
  { command: '/agents',     description: 'List all installed CAST agents',          agent: '—' },
  { command: '/bash',       description: 'Shell scripting and BATS tests',          agent: 'bash-specialist' },
  { command: '/cast',       description: 'CAST diagnostic and manual dispatch',     agent: '—' },
  { command: '/commit',     description: 'Create semantic git commit',              agent: 'commit' },
  { command: '/debug',      description: 'Investigate and fix issues',              agent: 'debugger' },
  { command: '/devops',     description: 'CI/CD, Docker, infrastructure',          agent: 'devops' },
  { command: '/docs',       description: 'Update documentation',                   agent: 'docs' },
  { command: '/doctor',     description: 'System health check',                    agent: '—' },
  { command: '/merge',      description: 'Git merges, rebases, conflicts',         agent: 'merge' },
  { command: '/morning',    description: 'Generate morning briefing',              agent: 'morning-briefing' },
  { command: '/orchestrate',description: 'Execute a CAST plan',                   agent: 'orchestrator' },
  { command: '/plan',       description: 'Create implementation plan',             agent: 'planner' },
  { command: '/push',       description: 'Push to remote repository',             agent: 'push' },
  { command: '/research',   description: 'Technical research',                     agent: 'researcher' },
  { command: '/review',     description: 'Code review',                            agent: 'code-reviewer' },
  { command: '/roadmap',    description: 'Resume CAST backlog',                    agent: 'planner' },
  { command: '/secure',     description: 'Security review (OWASP)',               agent: 'security' },
  { command: '/test',       description: 'Write tests',                            agent: 'test-writer' },
]

const AGENTS = [
  { name: 'bash-specialist',  model: 'sonnet', description: 'Shell scripts, BATS tests, hook work' },
  { name: 'code-reviewer',    model: 'haiku',  description: 'Code review for readability, conventions' },
  { name: 'code-writer',      model: 'sonnet', description: 'Code changes and implementations' },
  { name: 'commit',           model: 'haiku',  description: 'Semantic git commit messages' },
  { name: 'debugger',         model: 'sonnet', description: 'Issue investigation and fixes' },
  { name: 'devops',           model: 'sonnet', description: 'CI/CD, Docker, Terraform' },
  { name: 'docs',             model: 'sonnet', description: 'Documentation generation' },
  { name: 'frontend-qa',      model: 'haiku',  description: 'Frontend correctness testing' },
  { name: 'merge',            model: 'sonnet', description: 'Git merges, rebases, conflicts' },
  { name: 'morning-briefing', model: 'sonnet', description: 'Orchestrate morning briefing' },
  { name: 'orchestrator',     model: 'sonnet', description: 'Execute Agent Dispatch Manifests' },
  { name: 'planner',          model: 'sonnet', description: 'Strategic planning and task breakdowns' },
  { name: 'push',             model: 'haiku',  description: 'Git push (blocks main/master force-push)' },
  { name: 'researcher',       model: 'sonnet', description: 'Technical research and evaluation' },
  { name: 'security',         model: 'sonnet', description: 'Security review (OWASP, injection, XSS)' },
  { name: 'test-runner',      model: 'haiku',  description: 'Run test suites' },
  { name: 'test-writer',      model: 'sonnet', description: 'Write tests for code' },
]

const SKILLS = [
  { name: 'briefing-writer', invocable: false, description: 'Assemble briefing sections into markdown' },
  { name: 'careful-mode',    invocable: true,  description: 'Require confirmation before writes' },
  { name: 'freeze-mode',     invocable: true,  description: 'Read-only session, no file changes' },
  { name: 'git-activity',    invocable: false, description: 'Scan repos for yesterday\'s git activity' },
  { name: 'merge',           invocable: true,  description: 'Git merge/rebase with scenario detection' },
  { name: 'orchestrate',     invocable: true,  description: 'Execute CAST plans via orchestrator' },
  { name: 'plan',            invocable: true,  description: 'Plan mode with Agent Dispatch Manifest' },
  { name: 'wizard',          invocable: true,  description: 'Multi-step workflow with approval gates' },
]

const CAST_CLI = [
  { subcommand: 'status',  description: 'Agent runs, hook status, session summary' },
  { subcommand: 'exec',    description: 'Execute CAST script or dispatch task' },
  { subcommand: 'memory',  description: 'Agent memory: search, list, forget, export' },
  { subcommand: 'budget',  description: 'Token spend and cost tracking' },
  { subcommand: 'agents',  description: 'List agents and capabilities' },
  { subcommand: 'hooks',   description: 'Manage system hooks' },
  { subcommand: 'doctor',  description: 'System diagnostics' },
  { subcommand: 'tidy',    description: 'Cleanup stale runs, truncate logs' },
]

const HOOK_DIRECTIVES = [
  { directive: '[CAST-DISPATCH]',       description: 'Dispatch named agent, don\'t handle inline' },
  { directive: '[CAST-REVIEW]',         description: 'Auto-dispatch code-reviewer after changes' },
  { directive: '[CAST-CHAIN]',          description: 'Dispatch listed agents sequentially' },
  { directive: '[CAST-DISPATCH-GROUP]', description: 'Auto-generate ADM and execute with orchestrator' },
]

// ── Sub-components ─────────────────────────────────────────────────────────

function ModelBadge({ model }: { model: string }) {
  const isHaiku = model === 'haiku'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        isHaiku
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
          : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
      }`}
    >
      {model}
    </span>
  )
}

function InvocableBadge({ invocable }: { invocable: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        invocable
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-zinc-500/15 text-[var(--text-muted)] border border-zinc-500/20'
      }`}
    >
      {invocable ? 'Yes' : 'No'}
    </span>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className="w-4 h-4 text-[var(--accent)]" />
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-[var(--text-muted)] tabular-nums">({count})</span>
      )}
    </div>
  )
}

// ── Sections ───────────────────────────────────────────────────────────────

function SlashCommandsSection() {
  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Terminal} title="Slash Commands" count={SLASH_COMMANDS.length} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Command</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Description</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {SLASH_COMMANDS.map(row => (
              <tr key={row.command} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--accent)]">{row.command}</span>
                </td>
                <td className="py-2 pr-6">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
                <td className="py-2">
                  {row.agent === '—' ? (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  ) : (
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{row.agent}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AgentsSection() {
  const { data: liveAgents } = useQuery<Array<{ name: string; model: string; description: string }>>({
    queryKey: ['docs', 'agents'],
    queryFn: async () => {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 300_000,
  })

  const agents = (liveAgents && liveAgents.length > 0) ? liveAgents : AGENTS

  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Bot} title="CAST Agents" count={agents.length} />
      {liveAgents && liveAgents.length > 0 && (
        <p className="text-[10px] text-[var(--text-muted)] mb-3">Live from /api/agents</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Agent</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Model</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {agents.map(row => (
              <tr key={row.name} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--text-primary)]">{row.name}</span>
                </td>
                <td className="py-2 pr-6">
                  <ModelBadge model={row.model} />
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SkillsSection() {
  const { data: liveSkills } = useQuery<Array<{ name: string; description: string }>>({
    queryKey: ['docs', 'skills'],
    queryFn: async () => {
      const res = await fetch('/api/skills')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 300_000,
  })

  // Merge live skill data if available — keep invocable from hardcoded
  const skills = (liveSkills && liveSkills.length > 0)
    ? liveSkills.map(ls => {
        const hc = SKILLS.find(s => s.name === ls.name)
        return { name: ls.name, description: ls.description || hc?.description || '', invocable: hc?.invocable ?? false }
      })
    : SKILLS

  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Blocks} title="Skills" count={skills.length} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Skill</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">User-Invocable</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {skills.map(row => (
              <tr key={row.name} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--text-primary)]">{row.name}</span>
                </td>
                <td className="py-2 pr-6">
                  <InvocableBadge invocable={row.invocable} />
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CastCliSection() {
  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Command} title="CAST CLI" />
      <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">cast &lt;subcommand&gt;</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Subcommand</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {CAST_CLI.map(row => (
              <tr key={row.subcommand} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--accent)]">{row.subcommand}</span>
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HookDirectivesSection() {
  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Hash} title="Hook Directives" count={HOOK_DIRECTIVES.length} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Directive</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {HOOK_DIRECTIVES.map(row => (
              <tr key={row.directive} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--accent)]">{row.directive}</span>
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────────────────

export default function DocsView() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Docs</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">CAST reference: commands, agents, skills, and directives.</p>

      <div className="space-y-6">
        <SlashCommandsSection />
        <AgentsSection />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillsSection />
          <CastCliSection />
        </div>

        <HookDirectivesSection />
      </div>
    </div>
  )
}
