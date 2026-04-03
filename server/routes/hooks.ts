import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { SETTINGS_GLOBAL_FILE, CLAUDE_DIR } from '../constants.js'
import type { HookDefinition } from '../../src/types/index.js'

const router = Router()

function parseHookifyFiles(): HookDefinition[] {
  const hooks: HookDefinition[] = []
  try {
    const files = fs.readdirSync(CLAUDE_DIR).filter(
      f => f.startsWith('hookify.') && f.endsWith('.local.md')
    )
    for (const file of files) {
      const content = fs.readFileSync(path.join(CLAUDE_DIR, file), 'utf-8')
      // Parse YAML frontmatter between --- delimiters
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!fmMatch) continue
      const fm = fmMatch[1]
      const event = fm.match(/event:\s*(.+)/)?.[1]?.trim()
      const description = fm.match(/description:\s*(.+)/)?.[1]?.trim()
      // Extract conditions for matcher
      const conditionsMatch = fm.match(/conditions:\s*\n([\s\S]*?)(?:\n\w|\n---|\n$)/)
      const matcher = conditionsMatch?.[1]?.trim()
      if (event) {
        hooks.push({
          event,
          type: 'hookify',
          matcher: matcher || undefined,
          description: description || file,
        })
      }
    }
  } catch {
    // ignore
  }
  return hooks
}

router.get('/', (_req, res) => {
  const hooks: HookDefinition[] = []

  try {
    if (fs.existsSync(SETTINGS_GLOBAL_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8'))
      const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
      if (hooksConfig) {
        for (const [event, entries] of Object.entries(hooksConfig)) {
          if (!Array.isArray(entries)) continue
          for (const entry of entries) {
            const rule = entry as Record<string, unknown>
            const matcher = (rule.matcher as string) || undefined
            const subHooks = rule.hooks as Record<string, unknown>[] | undefined
            if (Array.isArray(subHooks)) {
              for (const h of subHooks) {
                hooks.push({
                  event,
                  type: (h.type as string) || 'command',
                  matcher,
                  command: (h.command as string) || undefined,
                  timeout: (h.timeout as number) || undefined,
                  description: (rule.description as string) || undefined,
                })
              }
            } else {
              hooks.push({
                event,
                type: (rule.type as string) || 'command',
                matcher,
                command: (rule.command as string) || undefined,
                timeout: (rule.timeout as number) || undefined,
                description: (rule.description as string) || undefined,
              })
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const hookifyHooks = parseHookifyFiles()
  res.json([...hooks, ...hookifyHooks])
})

export { router as hooksRouter }
