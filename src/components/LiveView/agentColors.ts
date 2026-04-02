export const BADGE_COLORS: Record<string, string> = {
  'code-writer': 'bg-green-700 text-green-100',
  'code-reviewer': 'bg-slate-600 text-slate-100',
  'orchestrator': 'bg-teal-700 text-teal-100',
  'commit': 'bg-gray-600 text-gray-100',
  'push': 'bg-gray-500 text-gray-100',
  'debugger': 'bg-orange-700 text-orange-100',
  'planner': 'bg-blue-700 text-blue-100',
  'researcher': 'bg-purple-700 text-purple-100',
  'test-runner': 'bg-yellow-700 text-yellow-100',
  'test-writer': 'bg-yellow-700 text-yellow-100',
  'bash-specialist': 'bg-amber-700 text-amber-100',
  'devops': 'bg-cyan-700 text-cyan-100',
  'docs': 'bg-sky-700 text-sky-100',
  'frontend-qa': 'bg-pink-700 text-pink-100',
  'merge': 'bg-violet-700 text-violet-100',
  'security': 'bg-red-700 text-red-100',
  'morning-briefing': 'bg-indigo-700 text-indigo-100',
}

export function getBadgeColor(name: string): string {
  return BADGE_COLORS[name.toLowerCase()] ?? 'bg-indigo-700 text-indigo-100'
}
