import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { DASHBOARD_COMMANDS_DIR } from '../constants.js'
import type { DashboardCommand, CommandType } from '../../src/types/index.js'

// Hardcoded CAST repo path — never accept this from request body
const CAST_REPO_PATH = '/Users/edkubiak/Projects/personal/claude-agent-team'

export const controlRouter = Router()

/** Ensure the commands directory exists before writing */
function ensureDir() {
  fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })
}

/** Write a command file and return the created command */
function writeCommand(type: CommandType, payload: Record<string, unknown>): DashboardCommand {
  ensureDir()
  const id = crypto.randomUUID()
  const queuedAt = new Date().toISOString()
  const cmd: DashboardCommand = { id, type, payload, queuedAt }
  const timestamp = queuedAt.replace(/[:.]/g, '-')
  const filename = `${timestamp}-${type}-${id}.json`
  const filePath = path.join(DASHBOARD_COMMANDS_DIR, filename)
  // Write with processedAt: null explicitly so the processor can detect unprocessed files
  fs.writeFileSync(filePath, JSON.stringify({ ...cmd, processedAt: null }, null, 2), 'utf-8')
  return cmd
}

// GET /api/control/queue — list all commands sorted by queuedAt desc
controlRouter.get('/queue', (_req, res) => {
  ensureDir()
  const commands: DashboardCommand[] = []
  try {
    const files = fs.readdirSync(DASHBOARD_COMMANDS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(DASHBOARD_COMMANDS_DIR, file), 'utf-8')
        commands.push(JSON.parse(raw) as DashboardCommand)
      } catch { /* skip malformed */ }
    }
    commands.sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())
    res.json(commands)
  } catch {
    res.json([])
  }
})

// POST /api/control/dispatch — queue an agent dispatch
controlRouter.post('/dispatch', (req, res) => {
  const { agentType, prompt, model } = req.body as { agentType?: string; prompt?: string; model?: string }
  if (!agentType || typeof agentType !== 'string' || agentType.trim() === '') {
    return res.status(400).json({ error: 'agentType is required' })
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required' })
  }
  const payload: Record<string, unknown> = { agentType: agentType.trim(), prompt: prompt.trim() }
  if (model && typeof model === 'string') payload.model = model.trim()
  const cmd = writeCommand('dispatch', payload)
  res.status(201).json(cmd)
})

// POST /api/control/kill/:sessionId — queue a kill signal
controlRouter.post('/kill/:sessionId', (req, res) => {
  const { sessionId } = req.params
  // Validate sessionId: only allow alphanumeric, dash, underscore (UUID format)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId format' })
  }
  const cmd = writeCommand('kill', { sessionId })
  res.status(201).json(cmd)
})

// POST /api/control/batch/:chainId/approve — queue batch approval
controlRouter.post('/batch/:chainId/approve', (req, res) => {
  const { chainId } = req.params
  if (!/^[a-zA-Z0-9_-]+$/.test(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId format' })
  }
  const cmd = writeCommand('batch_approve', { chainId })
  res.status(201).json(cmd)
})

// POST /api/control/batch/:chainId/reject — queue batch rejection
controlRouter.post('/batch/:chainId/reject', (req, res) => {
  const { chainId } = req.params
  if (!/^[a-zA-Z0-9_-]+$/.test(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId format' })
  }
  const cmd = writeCommand('batch_reject', { chainId })
  res.status(201).json(cmd)
})

// POST /api/control/rollback — git revert a commit in the CAST repo
controlRouter.post('/rollback', (req, res) => {
  const { commit_sha } = req.body as { commit_sha?: string }
  if (!commit_sha || !/^[a-f0-9]{7,40}$/.test(commit_sha)) {
    return res.status(400).json({ error: 'commit_sha must be a valid 7-40 char hex string' })
  }

  execFile(
    'git',
    ['-C', CAST_REPO_PATH, 'revert', '--no-edit', commit_sha],
    { timeout: 30_000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error('Rollback failed:', stderr)
        return res.status(500).json({
          success: false,
          output: stderr || err.message,
          commit_sha,
        })
      }
      res.json({ success: true, output: stdout.trim(), commit_sha })
    }
  )
})
