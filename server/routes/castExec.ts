import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { CAST_BIN, PLANS_DIR, EXEC_STATE_DIR } from '../constants.js'
import { relativizeHome } from '../utils/relativizeHome.js'
import { safeResolve } from '../utils/safeResolve.js'

export const castExecRouter = Router()

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

  // Sanitize in three steps: (1) flatten to a basename, dropping any directory
  // components the caller supplied; (2) confirm containment via safeResolve —
  // basename() alone is not sufficient, since path.basename('..') returns '..'
  // unchanged (no separator to strip) and would otherwise resolve to PLANS_DIR's
  // parent, and basename('.') resolves to PLANS_DIR itself (safeResolve's
  // equal-to-base case allows it, since a directory request there is normally
  // legitimate — it's just never legitimate for THIS route); (3) require the
  // resolved target to be a regular file, not a directory, since spawn() below
  // hands resolvedPath to `cast exec` as if it were a single plan file.
  const basename = path.basename(planFile)
  const resolvedPath = safeResolve(PLANS_DIR, basename)

  if (!resolvedPath) {
    res.status(400).json({ error: 'Invalid planFile' })
    return
  }

  // statSync (not existsSync) so a resolved directory — e.g. planFile: '.' —
  // is rejected, not silently spawned as if it were a plan file. Wrapped in
  // try/catch because statSync throws ENOENT on a missing path, where the
  // prior existsSync-based check simply returned false; without the catch a
  // genuinely missing plan would 500 instead of 404. A directory is reported
  // the same way as missing ("Plan file not found") — 404, not a new/400
  // status — since neither case has a plan file to run.
  let stat: fs.Stats | null = null
  try {
    stat = fs.statSync(resolvedPath)
  } catch {
    stat = null
  }
  if (!stat || !stat.isFile()) {
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
