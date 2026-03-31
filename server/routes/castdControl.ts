import { Router } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const castdControlRouter = Router()

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
    // Append "# CAST-MANAGED" marker so it can be identified later
    const newEntry = `${schedule} ${command} # CAST-MANAGED`
    // Read existing crontab, append, write back
    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const updated = stdout.trimEnd() + '\n' + newEntry + '\n'
    await execAsync(`echo ${JSON.stringify(updated)} | crontab -`)
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
    await execAsync(`echo ${JSON.stringify(filtered)} | crontab -`)
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
    // Security: only allow commands that are in CAST-MANAGED crontab
    const { stdout: crontab } = await execAsync('crontab -l 2>/dev/null || true')
    const knownCommands = crontab.split('\n')
      .filter(l => l.includes('# CAST-MANAGED'))
      .map(l => l.replace(/^(\S+\s+){5}/, '').replace(/\s*#\s*CAST-MANAGED.*$/, '').trim())
    if (!knownCommands.some(c => command.trim().startsWith(c.split(' ')[0]))) {
      return res.status(403).json({ error: 'Command not in CAST-MANAGED crontab' })
    }
    const { stdout, stderr } = await execAsync(command, { timeout: 30_000 })
    res.json({ ok: true, stdout, stderr })
  } catch (err) {
    console.error('Cron trigger error:', err)
    res.status(500).json({ error: 'Failed to trigger command' })
  }
})
