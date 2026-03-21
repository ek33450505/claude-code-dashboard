import path from 'path'
import os from 'os'

export const CLAUDE_DIR = path.join(os.homedir(), '.claude')
export const AGENTS_DIR = path.join(CLAUDE_DIR, 'agents')
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')
export const PLANS_DIR = path.join(CLAUDE_DIR, 'plans')
export const AGENT_MEMORY_DIR = path.join(CLAUDE_DIR, 'agent-memory-local')
export const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills')
export const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')
export const RULES_DIR = path.join(CLAUDE_DIR, 'rules')
export const BRIEFINGS_DIR = path.join(CLAUDE_DIR, 'briefings')
export const MEETINGS_DIR = path.join(CLAUDE_DIR, 'meetings')
export const REPORTS_DIR = path.join(CLAUDE_DIR, 'reports')
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.local.json')
export const SETTINGS_GLOBAL_FILE = path.join(CLAUDE_DIR, 'settings.json')
export const CLAUDE_MD = path.join(CLAUDE_DIR, 'CLAUDE.md')

export const PORT = 3001
