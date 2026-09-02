import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { CAST_BIN } from '../constants.js'
import { relativizeHome } from '../utils/relativizeHome.js'

export const castExecRouter = Router()

const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans')
const EXEC_STATE_DIR = path.join(os.homedir(), '.claude', 'cast', 'exec-state')

/** Check if a file contains a json dispatch manifest block */
function hasManifest(content: string): boolean {
  return /json\s+dispatch/i.test(content)
}

// GET /api/cast/plans
castExecRouter.get('/plans', (_req, res) => {
  if (!fs.existsSync(PLANS_DIR)) {
    res.json([])
    return
  }

  try {
    const files = fs.readdirSync(PLANS_DIR)
    const plans = files
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(PLANS_DIR, f)
        try {
          const stat = fs.statSync(filePath)
          const content = fs.readFileSync(filePath, 'utf-8')
          return {
            name: f,
            // filePath stays absolute above for statSync/readFileSync — relativize
            // only in the returned entry.
            path: relativizeHome(filePath),
            modified_at: stat.mtime.toISOString(),
            has_manifest: hasManifest(content),
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.modified_at).getTime() - new Date(a!.modified_at).getTime())

    res.json(plans)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list plans' })
  }
})

// POST /api/cast/exec
castExecRouter.post('/exec', (req, res) => {
  const { planFile } = req.body as { planFile?: string }
  if (!planFile) {
    res.status(400).json({ error: 'planFile is required' })
    return
  }

  // Sanitize: only allow basename to prevent path traversal
  const basename = path.basename(planFile)
  const resolvedPath = path.join(PLANS_DIR, basename)

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'Plan file not found' })
    return
  }

  if (!fs.existsSync(CAST_BIN)) {
    console.error(`cast exec: CAST_BIN not found at ${CAST_BIN}`)
    res.status(500).json({ error: 'cast binary not found' })
    return
  }

  const planId = path.basename(basename, '.md')

  try {
    const child = spawn(CAST_BIN, ['exec', resolvedPath], {
      detached: true,
      stdio: 'ignore',
    })
    // spawn() reports a missing/unexecutable binary ASYNCHRONOUSLY via an 'error'
    // event on the ChildProcess, not as a synchronous throw — the try/catch here
    // only catches spawn-call-site failures, not ENOENT. This listener is the
    // backstop for that race (the existsSync check above closes the common case,
    // but the binary could still vanish between the check and the spawn). Must be
    // attached BEFORE unref() — an unref'd child with no 'error' listener still
    // throws uncaught and crashes the process when the event fires.
    child.on('error', (err) => {
      console.error('cast exec: spawn error', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to spawn cast exec' })
      }
    })
    child.unref()
  } catch (err) {
    res.status(500).json({ error: 'Failed to spawn cast exec' })
    return
  }

  res.json({ plan_id: planId })
})

// GET /api/cast/exec/:plan_id/status
castExecRouter.get('/exec/:plan_id/status', (req, res) => {
  const { plan_id } = req.params
  // Sanitize plan_id — only allow safe filename chars
  if (!/^[\w.\-]+$/.test(plan_id)) {
    res.status(400).json({ error: 'Invalid plan_id' })
    return
  }

  const stateFile = path.join(EXEC_STATE_DIR, `${plan_id}.json`)

  if (!fs.existsSync(stateFile)) {
    res.json({ status: 'not_started' })
    return
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8')
    const state = JSON.parse(content)
    res.json(state)
  } catch {
    res.status(500).json({ error: 'Failed to read exec state' })
  }
})
