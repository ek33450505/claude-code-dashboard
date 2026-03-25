import { Router } from 'express'
import { parseRoutingLog, getRoutingStats } from '../parsers/routing.js'
import { getRecentAgentDispatches } from '../parsers/agentDispatches.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

const ROUTING_TABLE = path.join(os.homedir(), '.claude', 'config', 'routing-table.json')
const PROPOSALS_FILE = path.join(os.homedir(), '.claude', 'routing-proposals.json')
const ROUTE_INSTALL_SCRIPT = path.join(os.homedir(), '.claude', 'scripts', 'cast-route-install.sh')

export const routingRouter = Router()

// GET /api/routing/stats — summary + recent events
routingRouter.get('/stats', (_req, res) => {
  const routingEvents = parseRoutingLog(200)
  const dispatchEvents = getRecentAgentDispatches(200)
  // Merge both sources by timestamp (newest first)
  const events = [...routingEvents, ...dispatchEvents]
    .sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  res.json(getRoutingStats(events))
})

// GET /api/routing/events — raw event log (routing-log + session dispatches, merged by timestamp)
routingRouter.get('/events', (req, res) => {
  const parsed = parseInt(String(req.query.limit ?? '50'))
  const limit = Number.isNaN(parsed) ? 50 : Math.max(1, Math.min(parsed, 1000))
  const routingEvents = parseRoutingLog(limit)
  const dispatchEvents = getRecentAgentDispatches(limit)
  const merged = [...routingEvents, ...dispatchEvents]
    .sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    .slice(0, limit)
  res.json(merged)
})

// GET /api/routing/table — which agents have routing patterns
routingRouter.get('/table', (_req, res) => {
  if (!fs.existsSync(ROUTING_TABLE)) {
    return res.json({ routes: [] })
  }
  try {
    const table = JSON.parse(fs.readFileSync(ROUTING_TABLE, 'utf-8'))
    const routes = (table.routes ?? []).map((r: { agent: string; command: string; patterns: string[]; postChain?: string[] }) => ({
      agent: r.agent,
      command: r.command,
      patternCount: r.patterns?.length ?? 0,
      patterns: r.patterns ?? [],
      postChain: r.postChain ?? null,
    }))
    res.json({ routes })
  } catch {
    res.json({ routes: [] })
  }
})

// GET /api/routing/proposals — pending route proposals
routingRouter.get('/proposals', (_req, res) => {
  if (!fs.existsSync(PROPOSALS_FILE)) {
    return res.json({ proposals: [], pendingCount: 0 })
  }
  try {
    const data = JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf-8'))
    const proposals = data.proposals ?? []
    const pendingCount = proposals.filter((p: { status: string }) => p.status === 'pending').length
    res.json({ proposals, pendingCount })
  } catch {
    res.json({ proposals: [], pendingCount: 0 })
  }
})

// Helper: run cast-route-install.sh with a flag and ID, return stdout/stderr
function runInstallScript(flag: string, id: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    if (!fs.existsSync(ROUTE_INSTALL_SCRIPT)) {
      resolve({ code: 2, stdout: '', stderr: 'cast-route-install.sh not found' })
      return
    }
    // Validate id to prevent path traversal (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      resolve({ code: 1, stdout: '', stderr: 'Invalid proposal ID format' })
      return
    }
    let stdout = ''
    let stderr = ''
    const child = spawn('bash', [ROUTE_INSTALL_SCRIPT, flag, id])
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
    child.on('error', (err) => {
      resolve({ code: 1, stdout: '', stderr: err.message })
    })
  })
}

// POST /api/routing/proposals/:id/approve
routingRouter.post('/proposals/:id/approve', async (req, res) => {
  const { id } = req.params
  const result = await runInstallScript('--approve', id)
  if (result.code === 2) {
    return res.status(503).json({ error: result.stderr.trim() || 'Install script not found' })
  }
  if (result.code !== 0) {
    return res.status(400).json({ error: result.stderr.trim() || 'Approval failed' })
  }
  try {
    const data = JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf-8'))
    const updated = (data.proposals ?? []).find((p: { id: string }) => p.id === id)
    res.json({ proposal: updated ?? null, message: result.stdout.trim() })
  } catch {
    res.json({ proposal: null, message: result.stdout.trim() })
  }
})

// POST /api/routing/proposals/:id/reject
routingRouter.post('/proposals/:id/reject', async (req, res) => {
  const { id } = req.params
  const result = await runInstallScript('--reject', id)
  if (result.code === 2) {
    return res.status(503).json({ error: result.stderr.trim() || 'Install script not found' })
  }
  if (result.code !== 0) {
    return res.status(400).json({ error: result.stderr.trim() || 'Rejection failed' })
  }
  try {
    const data = JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf-8'))
    const updated = (data.proposals ?? []).find((p: { id: string }) => p.id === id)
    res.json({ proposal: updated ?? null, message: result.stdout.trim() })
  } catch {
    res.json({ proposal: null, message: result.stdout.trim() })
  }
})
