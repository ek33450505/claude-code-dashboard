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
