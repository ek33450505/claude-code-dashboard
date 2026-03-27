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
 * Read the cast/events directory and build a map of script-name → last fired ISO timestamp.
 * The event JSON files have a "message" or we match by the hook command name embedded in filenames.
 * We read each event file and look for a "hook" or "script" field, else fall back to timestamp from filename.
 */
function buildLastFiredMap(): Map<string, string> {
  const eventsDir = path.join(CLAUDE_DIR, 'cast', 'events')
  const map = new Map<string, string>()

  try {
    if (!fs.existsSync(eventsDir)) return map
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'))

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(eventsDir, file), 'utf-8')
        const evt = JSON.parse(raw) as Record<string, unknown>
        const ts = (evt.timestamp as string) ?? null
        if (!ts) continue

        // Try to extract a script name from known event fields
        const candidates: string[] = []
        if (typeof evt.script === 'string') candidates.push(evt.script)
        if (typeof evt.command === 'string') candidates.push(evt.command)
        if (typeof evt.hook_script === 'string') candidates.push(evt.hook_script)
        if (typeof evt.message === 'string') {
          // message may mention a script path
          const m = evt.message.match(/([^\s]+\.sh)/)
          if (m) candidates.push(m[1])
        }

        for (const c of candidates) {
          const basename = path.basename(c)
          const existing = map.get(basename)
          if (!existing || ts > existing) {
            map.set(basename, ts)
          }
          // Also index by full path
          if (!map.has(c) || ts > (map.get(c) ?? '')) {
            map.set(c, ts)
          }
        }
      } catch {
        // skip malformed files
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

    const lastFiredMap = buildLastFiredMap()

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

      // Look up last fired by script basename or full path
      let last_fired_at: string | null = null
      if (scriptPath) {
        const byFull = lastFiredMap.get(scriptPath) ?? null
        const byBase = lastFiredMap.get(path.basename(scriptPath)) ?? null
        last_fired_at = byFull ?? byBase
      }

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
