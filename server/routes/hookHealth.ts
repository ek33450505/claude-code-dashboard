import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { CLAUDE_DIR, SETTINGS_FILE, SETTINGS_GLOBAL_FILE } from '../constants.js'

export const hookHealthRouter = Router()

interface HookHealthEntry {
  hook_type: string
  command: string
  script_path: string | null
  exists: boolean
  executable: boolean
  last_fired_at: string | null
  health: 'green' | 'yellow' | 'red'
}

/**
 * Extract a rough script path from a shell command string.
 * Returns the first token that looks like a file path (contains / or starts with ~).
 */
function extractScriptPath(command: string): string | null {
  const tokens = command.trim().split(/\s+/)
  for (const token of tokens) {
    const expanded = token.startsWith('~') ? path.join(process.env.HOME ?? '', token.slice(1)) : token
    if (expanded.startsWith('/') || token.startsWith('~')) {
      return expanded
    }
  }
  return null
}

/**
 * Parse all hook command entries from a settings JSON object.
 * Returns array of { hook_type, command } pairs.
 */
function extractHookCommands(settings: Record<string, unknown>): Array<{ hook_type: string; command: string }> {
  const results: Array<{ hook_type: string; command: string }> = []
  const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
  if (!hooksConfig || typeof hooksConfig !== 'object') return results

  for (const [event, entries] of Object.entries(hooksConfig)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const rule = entry as Record<string, unknown>
      const subHooks = rule.hooks as Record<string, unknown>[] | undefined
      if (Array.isArray(subHooks)) {
        for (const h of subHooks) {
          const cmd = h.command as string | undefined
          if (cmd) results.push({ hook_type: event, command: cmd })
        }
      } else {
        const cmd = rule.command as string | undefined
        if (cmd) results.push({ hook_type: event, command: cmd })
      }
    }
  }
  return results
}

/**
 * Known Claude Code hook event types. Used as needles when scanning event files.
 */
const KNOWN_HOOK_TYPES = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SubagentStop',
  'Notification',
  'UserPromptSubmit',
  'PostCompact',
  'TaskCreated',
  'InstructionsLoaded',
]

/**
 * Read ~/.claude/cast/hook-last-fired/*.timestamp files and build a map of
 * hook_type → last fired mtime (ISO string).
 *
 * Each hook script touches <HOOK_TYPE>.timestamp when it fires. The file mtime
 * is the authoritative last-fired-at time.
 */
function buildHookTypeLastFiredMap(): Map<string, string> {
  const markerDir = path.join(CLAUDE_DIR, 'cast', 'hook-last-fired')
  const map = new Map<string, string>()

  try {
    if (!fs.existsSync(markerDir)) return map
    const files = fs.readdirSync(markerDir).filter(f => f.endsWith('.timestamp'))

    for (const file of files) {
      const hookType = file.slice(0, -'.timestamp'.length)
      const filePath = path.join(markerDir, file)
      try {
        const mtime = fs.statSync(filePath).mtime
        map.set(hookType, mtime.toISOString())
      } catch {
        continue
      }
    }
  } catch {
    // ignore missing dir
  }

  return map
}

// GET /api/hooks/health
hookHealthRouter.get('/', (_req, res) => {
  try {
    const allCommands: Array<{ hook_type: string; command: string }> = []

    // Read settings.json (global)
    if (fs.existsSync(SETTINGS_GLOBAL_FILE)) {
      try {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8')) as Record<string, unknown>
        allCommands.push(...extractHookCommands(settings))
      } catch { /* ignore parse errors */ }
    }

    // Read settings.local.json (local overrides)
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Record<string, unknown>
        allCommands.push(...extractHookCommands(settings))
      } catch { /* ignore parse errors */ }
    }

    const hookTypeLastFiredMap = buildHookTypeLastFiredMap()

    const results: HookHealthEntry[] = allCommands.map(({ hook_type, command }) => {
      const scriptPath = extractScriptPath(command)
      const exists = scriptPath ? fs.existsSync(scriptPath) : false
      let executable = false
      if (exists && scriptPath) {
        try {
          fs.accessSync(scriptPath, fs.constants.X_OK)
          executable = true
        } catch {
          executable = false
        }
      }

      // Look up last fired by matching hook_type against event files
      const last_fired_at = hookTypeLastFiredMap.get(hook_type) ?? null

      let health: 'green' | 'yellow' | 'red'
      if (!exists) {
        health = 'red'
      } else if (!executable) {
        health = 'yellow'
      } else {
        health = 'green'
      }

      return {
        hook_type,
        command,
        script_path: scriptPath,
        exists,
        executable,
        last_fired_at,
        health,
      }
    })

    res.json({ hooks: results })
  } catch (err) {
    console.error('Hook health error:', err)
    res.status(500).json({ error: 'Failed to compute hook health' })
  }
})
