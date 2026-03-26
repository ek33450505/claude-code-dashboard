export const AGENT_CATEGORIES = {
  Core: ['planner', 'debugger', 'test-writer', 'code-reviewer', 'code-writer', 'data-scientist', 'db-reader', 'commit', 'merge', 'security', 'push', 'bash-specialist'],
  Extended: ['architect', 'tdd-guide', 'build-error-resolver', 'e2e-runner', 'refactor-cleaner', 'doc-updater', 'readme-writer', 'router'],
  Specialist: ['devops', 'performance', 'seo-content', 'linter', 'db-architect', 'framework-expert', 'frontend-designer', 'infra', 'pentest'],
  Productivity: ['researcher', 'report-writer', 'meeting-notes', 'email-manager', 'morning-briefing'],
  Professional: ['browser', 'qa-reviewer', 'presenter'],
  Orchestration: ['orchestrator', 'auto-stager', 'chain-reporter', 'verifier', 'test-runner'],
} as const

export type AgentCategory = keyof typeof AGENT_CATEGORIES

export const CATEGORY_COLORS: Record<AgentCategory, { border: string; text: string; bg: string }> = {
  Core: { border: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  Extended: { border: 'border-purple-500/20', text: 'text-purple-400', bg: 'bg-purple-500/10' },
  Specialist: { border: 'border-orange-500/20', text: 'text-orange-400', bg: 'bg-orange-500/10' },
  Productivity: { border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  Professional: { border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  Orchestration: { border: 'border-cyan-500/20', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
}

export const CATEGORY_DESCRIPTIONS: Record<AgentCategory, string> = {
  Core: 'Essential agents for daily development including implementation, merging, testing, and review',
  Extended: 'Specialized agents for architecture, testing, and code quality',
  Specialist: 'DevOps, infrastructure, security, design, and framework specialists',
  Productivity: 'Research, reporting, email, and daily briefing agents',
  Professional: 'Browser automation, QA review, and presentation agents',
  Orchestration: 'Multi-agent coordination, staging, verification, and reporting',
}

export function getAgentCategory(agentName: string): AgentCategory | null {
  for (const [category, agents] of Object.entries(AGENT_CATEGORIES)) {
    if ((agents as readonly string[]).includes(agentName)) {
      return category as AgentCategory
    }
  }
  return null
}
