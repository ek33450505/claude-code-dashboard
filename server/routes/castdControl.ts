import { Router } from 'express'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

export const castdControlRouter = Router()

// Allowlist of CAST script basenames permitted in cron and trigger endpoints
const CAST_SCRIPT_ALLOWLIST = new Set([
  'cast',
  'cast-db-init.sh',
  'cast-db-log.py',
  'cast-log-append.py',
  'cast-memory-router.py',
  'cast-memory-fts5-migrate.py',
  'cast-memory-seed-procedural.py',
  'cast-redact.py',
  'cast-stop-failure-hook.sh',
  'cast-swarm-bootstrap.sh',
  'cast-swarm-merge.sh',
  'cast-swarm-teardown.sh',
  'cast-upgrade-check.sh',
])

// Cron schedule regex: 5 fields, each *, number, or common cron expressions
const CRON_SCHEDULE_RE = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/

/** Extract the basename of the first token of a command string */
function commandBasename(cmd: string): string {
  const firstToken = cmd.trim().split(/\s+/)[0] ?? ''
  return path.basename(firstToken)
}

/** Return true if the command's binary is in the CAST allowlist */
function isAllowedCommand(cmd: string): boolean {
  return CAST_SCRIPT_ALLOWLIST.has(commandBasename(cmd))
}

/** Parse a cron command string into [binary, ...args] for execFile */
function parseCronCommand(cmd: string): string[] {
  // Simple whitespace split — sufficient for CAST scripts which don't use complex quoting
  return cmd.trim().split(/\s+/)
}

// GET /api/castd/status — read crontab and return CAST-related entries
castdControlRouter.get('/status', async (_req, res) => {
  try {
    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const all = stdout.split('\n').filter(Boolean)
    const castLines = all.filter(l =>
      l.toLowerCase().includes('cast') || l.includes('.claude/scripts')
    )
    res.json({ entries: castLines, count: castLines.length })
  } catch (err) {
    res.json({ entries: [], count: 0, error: String(err) })
  }
})

// POST /api/castd/cron — add a new CAST-MANAGED cron entry
castdControlRouter.post('/cron', async (req, res) => {
  try {
    const { schedule, command } = req.body as { schedule?: string; command?: string }
    if (!schedule || !command) return res.status(400).json({ error: 'schedule and command required' })

    // F08: Reject inputs containing newlines (crontab injection vector)
    if (schedule.includes('\n') || schedule.includes('\r') || command.includes('\n') || command.includes('\r')) {
      return res.status(400).json({ error: 'Invalid characters in schedule or command' })
    }

    // F08: Validate schedule format
    if (!CRON_SCHEDULE_RE.test(schedule.trim())) {
      return res.status(400).json({ error: 'Invalid cron schedule format' })
    }

    // F08: Validate command starts with an allowlisted CAST script
    if (!isAllowedCommand(command)) {
      return res.status(403).json({ error: 'Command not in CAST script allowlist' })
    }

    // Append "# CAST-MANAGED" marker so it can be identified later
    const newEntry = `${schedule.trim()} ${command.trim()} # CAST-MANAGED`
    // Read existing crontab, append, write back
    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const updated = stdout.trimEnd() + '\n' + newEntry + '\n'
    await execFileAsync('bash', ['-c', `echo ${JSON.stringify(updated)} | crontab -`])
    res.json({ ok: true, entry: newEntry })
  } catch (err) {
    console.error('Cron add error:', err)
    res.status(500).json({ error: 'Failed to add cron entry' })
  }
})

// DELETE /api/castd/cron — remove a cron entry by exact line match
castdControlRouter.delete('/cron', async (req, res) => {
  try {
    const { entry } = req.body as { entry?: string }
    if (!entry) return res.status(400).json({ error: 'entry required' })
    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const filtered = stdout.split('\n').filter(l => l.trim() !== entry.trim()).join('\n')
    await execFileAsync('bash', ['-c', `echo ${JSON.stringify(filtered)} | crontab -`])
    res.json({ ok: true })
  } catch (err) {
    console.error('Cron delete error:', err)
    res.status(500).json({ error: 'Failed to delete cron entry' })
  }
})

// POST /api/castd/trigger — manually run a CAST-MANAGED cron command
castdControlRouter.post('/trigger', async (req, res) => {
  try {
    const { command } = req.body as { command?: string }
    if (!command) return res.status(400).json({ error: 'command required' })

    // F04: Validate command binary is in the CAST allowlist
    if (!isAllowedCommand(command)) {
      return res.status(403).json({ error: 'Command not in CAST script allowlist' })
    }

    // F04: Parse command into binary + args and resolve binary to scripts directory
    const parts = parseCronCommand(command)
    const binaryName = path.basename(parts[0])
    const args = parts.slice(1)

    // Resolve to the CAST scripts directory or use PATH for 'cast' itself
    let resolvedBinary: string
    if (binaryName === 'cast') {
      resolvedBinary = 'cast'
    } else {
      resolvedBinary = path.join(os.homedir(), '.claude', 'scripts', binaryName)
    }

    // F04: Use execFile instead of exec to prevent shell injection
    const { stdout, stderr } = await execFileAsync(resolvedBinary, args, { timeout: 30_000 })
    res.json({ ok: true, stdout, stderr })
  } catch (err) {
    console.error('Cron trigger error:', err)
    res.status(500).json({ error: 'Failed to trigger command' })
  }
})
