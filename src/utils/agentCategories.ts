export const AGENT_CATEGORIES = {
  Core: ['planner', 'debugger', 'test-writer', 'code-reviewer', 'data-scientist', 'db-reader', 'commit', 'security'],
  Extended: ['architect', 'tdd-guide', 'build-error-resolver', 'e2e-runner', 'refactor-cleaner', 'doc-updater', 'readme-writer', 'router'],
  Productivity: ['researcher', 'report-writer', 'meeting-notes', 'email-manager', 'morning-briefing'],
  Professional: ['browser', 'qa-reviewer', 'presenter'],
  Orchestration: ['orchestrator', 'auto-stager', 'chain-reporter', 'verifier'],
  FieldOps: ['explore', 'plan', 'general-purpose'],
} as const

export type AgentCategory = keyof typeof AGENT_CATEGORIES

export const CATEGORY_COLORS: Record<AgentCategory, { border: string; text: string; bg: string }> = {
  Core: { border: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  Extended: { border: 'border-purple-500/20', text: 'text-purple-400', bg: 'bg-purple-500/10' },
  Productivity: { border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  Professional: { border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  Orchestration: { border: 'border-cyan-500/20', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  FieldOps: { border: 'border-slate-500/20', text: 'text-slate-400', bg: 'bg-slate-500/10' },
}

export const CATEGORY_DESCRIPTIONS: Record<AgentCategory, string> = {
  Core: 'Essential agents for daily development workflow',
  Extended: 'Specialized agents for architecture, testing, and code quality',
  Productivity: 'Research, reporting, email, and daily briefing agents',
  Professional: 'Browser automation, QA review, and presentation agents',
  Orchestration: 'Multi-agent coordination, staging, verification, and reporting',
  FieldOps: 'Built-in Claude Code agents for exploration, planning, and general tasks',
}

export function getAgentCategory(agentName: string): AgentCategory | null {
  for (const [category, agents] of Object.entries(AGENT_CATEGORIES)) {
    if ((agents as readonly string[]).includes(agentName)) {
      return category as AgentCategory
    }
  }
  return null
}
