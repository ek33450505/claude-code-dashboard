import { Router } from 'express'
import fs from 'fs'
import {
  SETTINGS_FILE,
  SETTINGS_GLOBAL_FILE,
  CLAUDE_MD,
  AGENTS_DIR,
  COMMANDS_DIR,
  SKILLS_DIR,
  RULES_DIR,
  PLANS_DIR,
  PROJECTS_DIR,
  AGENT_MEMORY_DIR,
} from '../constants.js'
import { listSessions } from '../parsers/sessions.js'
import type { SystemOverview, HookEntry } from '../../src/types/index.js'

const router = Router()

function countFiles(dir: string, ext?: string): number {
  if (!fs.existsSync(dir)) return 0
  const entries = fs.readdirSync(dir)
  if (ext) return entries.filter(f => f.endsWith(ext)).length
  return entries.filter(f => !f.startsWith('.')).length
}

function countSubdirs(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter(d =>
    fs.statSync(`${dir}/${d}`).isDirectory()
  ).length
}

function countProjectMemory(): number {
  if (!fs.existsSync(PROJECTS_DIR)) return 0
  let count = 0
  for (const d of fs.readdirSync(PROJECTS_DIR)) {
    const memDir = `${PROJECTS_DIR}/${d}/memory`
    if (fs.existsSync(memDir) && fs.statSync(memDir).isDirectory()) {
      count += fs.readdirSync(memDir).filter(f => f.endsWith('.md')).length
    }
  }
  return count
}

function parseHooks(settings: Record<string, unknown>): HookEntry[] {
  const hooks: HookEntry[] = []
  const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
  if (!hooksConfig) return hooks

  for (const [event, entries] of Object.entries(hooksConfig)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const e = entry as Record<string, unknown>
      hooks.push({
        event,
        matcher: (e.matcher as string) || undefined,
        description: (e.description as string) || undefined,
        type: (e.type as string) || 'command',
      })
    }
  }
  return hooks
}

router.get('/', (_req, res) => {
  let settings = {}
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    } catch {
      // ignore
    }
  }

  let claudeMd = ''
  if (fs.existsSync(CLAUDE_MD)) {
    claudeMd = fs.readFileSync(CLAUDE_MD, 'utf-8')
  }

  res.json({ settings, claudeMd })
})

router.get('/settings', (_req, res) => {
  try {
    const content = fs.existsSync(SETTINGS_GLOBAL_FILE)
      ? fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8')
      : '{}'
    res.json({ body: '```json\n' + content + '\n```' })
  } catch {
    res.json({ body: 'Failed to read settings.json' })
  }
})

router.get('/settings-local', (_req, res) => {
  try {
    const content = fs.existsSync(SETTINGS_FILE)
      ? fs.readFileSync(SETTINGS_FILE, 'utf-8')
      : '{}'
    res.json({ body: '```json\n' + content + '\n```' })
  } catch {
    res.json({ body: 'Failed to read settings.local.json' })
  }
})

router.get('/health', (_req, res) => {
  let settings: Record<string, unknown> = {}
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    } catch {
      // ignore
    }
  }

  const sessions = listSessions()

  const overview: SystemOverview = {
    agentCount: countFiles(AGENTS_DIR, '.md'),
    commandCount: countFiles(COMMANDS_DIR, '.md'),
    skillCount: countFiles(SKILLS_DIR),
    ruleCount: countFiles(RULES_DIR, '.md'),
    planCount: countFiles(PLANS_DIR, '.md'),
    projectMemoryCount: countProjectMemory(),
    agentMemoryCount: countSubdirs(AGENT_MEMORY_DIR),
    sessionCount: sessions.length,
    hooks: parseHooks(settings),
    env: {
      platform: process.platform,
      nodeVersion: process.version,
      homeDir: process.env.HOME || '',
    },
    model: (settings.model as string) || 'sonnet',
  }

  res.json(overview)
})

export { router as configRouter }
