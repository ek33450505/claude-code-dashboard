import fs from 'fs'
import path from 'path'
import type { Express, Request, Response } from 'express'
import chokidar from 'chokidar'
import Database from 'better-sqlite3'
import { PROJECTS_DIR, DASHBOARD_COMMANDS_DIR, CAST_DB } from '../constants.js'
import { decodeProjectPath } from '../parsers/projectPath.js'
import type { LiveEvent, LogEntry } from '../../src/types/index.js'
import { parseWorkLog, synthesizeWorkLog } from '../parsers/workLog.js'
import type { ParsedWorkLog } from '../../src/types/index.js'
import { startCastDbWatcher, stopCastDbWatcher } from './castDbWatcher.js'

const clients: Set<Response> = new Set()

// Staleness tracking: maps sessionId → last seen timestamp (ms)
export const lastSeenMs: Map<string, number> = new Map()

// Idle completion timers: maps filePath → NodeJS.Timeout
const idleTimers: Map<string, NodeJS.Timeout> = new Map()

/** Format tool input as a human-readable preview string */
function formatInputPreview(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return (input.file_path as string | undefined) ?? JSON.stringify(input).slice(0, 500)
    case 'Bash':
      return (input.command as string | undefined)?.slice(0, 500) ?? JSON.stringify(input).slice(0, 500)
    case 'Glob':
      return (input.pattern as string | undefined) ?? JSON.stringify(input).slice(0, 500)
    case 'Grep': {
      const pattern = (input.pattern as string | undefined) ?? ''
      const path = (input.path as string | undefined) ?? ''
      const glob = (input.glob as string | undefined) ?? ''
      const parts = [pattern, path && `in ${path}`, glob && `(${glob})`].filter(Boolean)
      return parts.join(' ') || JSON.stringify(input).slice(0, 500)
    }
    case 'Agent': {
      const subtype = (input.subagent_type as string | undefined) ?? ''
      const desc = (input.description as string | undefined) ?? ''
      const prompt = (input.prompt as string | undefined) ?? ''
      const label = subtype || desc
      return label ? `[${label}] ${prompt.slice(0, 300)}` : prompt.slice(0, 500)
    }
    default:
      return JSON.stringify(input).slice(0, 500)
  }
}

function broadcast(event: LiveEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const client of clients) {
    client.write(data)
  }
}

/** Read the last non-empty line of a file without reading the whole thing */
function readLastLine(filePath: string): LogEntry | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trimEnd().split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim()) {
        return JSON.parse(lines[i])
      }
    }
  } catch {
    // skip
  }
  return undefined
}

function extractSessionInfo(filePath: string) {
  const relative = filePath.replace(PROJECTS_DIR + '/', '')
  const parts = relative.split('/')
  if (parts.length < 2) return { projectDir: parts[0] ?? '', sessionId: '', isSubagent: false, subagentId: undefined as string | undefined }
  const projectDir = parts[0] ?? ''
  // Subagent paths: projDir/sessionId/subagents/agent-x.jsonl = 4 parts
  const isSubagent = parts.length === 4 && parts[2] === 'subagents'
  const sessionId = isSubagent
    ? (parts[1] ?? '')
    : path.basename(parts[1] ?? '', '.jsonl')
  const subagentId = isSubagent ? path.basename(parts[3] ?? '', '.jsonl') : undefined
  return { projectDir, sessionId, isSubagent, subagentId }
}

/** If the first user message in a subagent JSONL starts with a CAST agent identity line,
 *  return the agent name (lowercased). Handles patterns:
 *  - "You are the commit agent"
 *  - "You are a code-writer agent"
 *  - "You are the CAST orchestrator"
 *  - "You are the CAST orchestrator agent"
 */
function extractCastAgentName(jsonlPath: string): string | undefined {
  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const firstLine = content.split('\n').find(l => l.trim())
    if (!firstLine) return undefined
    const entry = JSON.parse(firstLine) as { message?: { role?: string; content?: unknown } }
    if (entry.message?.role !== 'user') return undefined
    const text = typeof entry.message.content === 'string'
      ? entry.message.content
      : Array.isArray(entry.message.content)
        ? (entry.message.content as Array<{ type?: string; text?: string }>)
            .filter(b => b.type === 'text').map(b => b.text ?? '').join(' ')
        : ''
    const m = text.match(/^You are (?:(?:the|a) CAST |(?:the|a) )?`?([a-z][a-z0-9-]+)`?(?: agent)?[.\s,]/im)
    return m ? m[1]!.toLowerCase() : undefined
  } catch {
    return undefined
  }
}

/** Read agent identity from .meta.json sidecar */
function readAgentMeta(jsonlPath: string): { agentType?: string; description?: string } {
  const metaPath = jsonlPath.replace(/\.jsonl$/, '.meta.json')
  let result: { agentType?: string; description?: string } = {}
  try {
    if (fs.existsSync(metaPath)) {
      result = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  // If agentType is generic, try to extract real CAST agent name from prompt
  if (!result.agentType || result.agentType === 'general-purpose') {
    const castName = extractCastAgentName(jsonlPath)
    if (castName) result = { ...result, agentType: castName }
  }
  return result
}


/** Read the promptId from the first line of a sub-agent JSONL */
async function readSubagentPromptId(filePath: string): Promise<string | undefined> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const firstLine = content.split('\n').find(l => l.trim())
    if (!firstLine) return undefined
    const entry = JSON.parse(firstLine)
    return typeof entry.promptId === 'string' ? entry.promptId : undefined
  } catch {
    return undefined
  }
}

/** Find the agentId of the sibling file that contains a matching promptId in its entries */
async function findParentAgentId(subagentsDir: string, newAgentFile: string, promptId: string): Promise<string | undefined> {
  let files: string[]
  try {
    files = await fs.promises.readdir(subagentsDir)
  } catch {
    return undefined
  }

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue
    const fullPath = path.join(subagentsDir, file)
    if (fullPath === newAgentFile) continue
    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8')
      const lines = content.split('\n').filter(l => l.trim()).slice(0, 100)
      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          if (entry.promptId === promptId && typeof entry.agentId === 'string') {
            return entry.agentId as string
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* skip unreadable */ }
  }
  return undefined
}

/** Extract plain text from a LogEntry message content (string or ContentBlock array) */
function extractTextContent(entry: { message?: { content?: unknown } }): string {
  const c = entry.message?.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return (c as Array<{ type: string; text?: string }>)
      .filter(b => b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text as string)
      .join('\n')
  }
  return ''
}

export function attachSSE(app: Express) {
  app.get('/api/events', (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:5173',
    })

    res.write('\n')
    clients.add(res)

    // Replay last 15 messages from the most recently modified session JSONL
    try {
      const allJsonl: Array<{ path: string; mtime: number }> = []
      if (fs.existsSync(PROJECTS_DIR)) {
        for (const proj of fs.readdirSync(PROJECTS_DIR)) {
          const projPath = path.join(PROJECTS_DIR, proj)
          for (const f of fs.readdirSync(projPath)) {
            if (!f.endsWith('.jsonl')) continue
            const fp = path.join(projPath, f)
            try { allJsonl.push({ path: fp, mtime: fs.statSync(fp).mtimeMs }) } catch { /* skip */ }
          }
        }
      }
      allJsonl.sort((a, b) => b.mtime - a.mtime)
      const activeFile = allJsonl[0]?.path
      if (activeFile) {
        const lines = fs.readFileSync(activeFile, 'utf-8').split('\n').filter(l => l.trim())
        const recent = lines.slice(-15)
        for (const line of recent) {
          try {
            const entry: LogEntry = JSON.parse(line)
            if (entry.message?.role && entry.message?.content) {
              res.write(`data: ${JSON.stringify({
                type: 'session_updated',
                path: activeFile,
                sessionId: '',
                projectDir: '',
                timestamp: entry.timestamp ?? new Date().toISOString(),
                lastEntry: entry,
                historical: true,
              } satisfies LiveEvent)}\n\n`)
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch { /* never block SSE setup */ }

    // Stale reconciliation — query cast.db for completed agent_runs from the last 2 hours
    // and emit sessionIds that are done so the client can clear stale 'running' states.
    try {
      if (fs.existsSync(CAST_DB)) {
        const db = new Database(CAST_DB, { readonly: true, fileMustExist: true })
        try {
          const rows = db.prepare(`
            SELECT DISTINCT session_id
            FROM agent_runs
            WHERE status IN ('DONE','DONE_WITH_CONCERNS','BLOCKED','NEEDS_CONTEXT','failed','stale')
              AND ended_at IS NOT NULL
              AND ended_at > datetime('now', '-2 hours')
          `).all() as Array<{ session_id: string }>
          const doneSessionIds = rows.map(r => r.session_id).filter(Boolean)
          if (doneSessionIds.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: 'stale_reconcile',
              timestamp: new Date().toISOString(),
              doneSessionIds,
            } satisfies LiveEvent)}\n\n`)
          }
        } finally {
          db.close()
        }
      }
    } catch { /* stale reconciliation is best-effort — never block SSE setup */ }

    const heartbeat = setInterval(() => {
      const event: LiveEvent = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }, 15_000)

    res.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(res)
    })
  })

  // Test broadcast endpoint — injects a fake LiveEvent for UI testing
  app.post('/api/test-broadcast', (req: Request, res: Response) => {
    broadcast(req.body as LiveEvent)
    res.json({ ok: true })
  })

  // HTTP hook receiver — Claude Code v2.1.63+ can POST hook payloads directly here.
  // Accepts the raw hook event payload and broadcasts a hook_event LiveEvent to SSE clients.
  // This is additive alongside file-based cast/events/ writes — dashboard gets real-time push
  // without polling while durable storage continues in parallel.
  app.post('/api/hook-events', (req: Request, res: Response) => {
    try {
      const payload = req.body as Record<string, unknown>
      const hookEventName = (payload.hook_event_name as string) ?? 'unknown'
      const sessionId = (payload.session_id as string) ?? ''
      const toolInput = (payload.tool_input as Record<string, unknown>) ?? {}

      const hookAgentName = (toolInput.subagent_type as string)
        ?? (toolInput.agent_type as string)
        ?? undefined
      const hookAgentId = (toolInput.agent_id as string) ?? undefined
      const hookTrigger = (payload.trigger as string) ?? undefined

      broadcast({
        type: 'hook_event',
        timestamp: new Date().toISOString(),
        sessionId,
        hookEventName,
        hookAgentName,
        hookAgentId,
        hookTrigger,
      } satisfies LiveEvent)

      res.json({ ok: true })
    } catch {
      res.status(400).json({ error: 'invalid payload' })
    }
  })

  // Watch for JSONL changes
  const watcher = chokidar.watch(PROJECTS_DIR, {
    ignored: [
      '**/tool-results/**',
      '**/node_modules/**',
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 4,
  })

  watcher.on('add', (filePath) => {
    if (!filePath.endsWith('.jsonl')) return
    const { projectDir, sessionId, isSubagent, subagentId } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)
    const meta = readAgentMeta(filePath)

    broadcast({
      type: isSubagent ? 'agent_spawned' : 'session_updated',
      path: filePath,
      sessionId,
      projectDir,
      projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? projectDir,
      timestamp: new Date().toISOString(),
      lastEntry,
      agentType: meta.agentType,
      agentDescription: meta.description,
      ...(subagentId ? { subagentId } : {}),
    })

    // After 200ms, attempt to resolve the parent agent and re-emit with attribution
    if (isSubagent && subagentId) {
      const subagentsDir = path.dirname(filePath)
      setTimeout(() => {
        readSubagentPromptId(filePath).then(promptId => {
          if (!promptId) return
          return findParentAgentId(subagentsDir, filePath, promptId).then(parentAgentId => {
            if (!parentAgentId) return
            broadcast({
              type: 'agent_spawned',
              sessionId,
              projectDir,
              projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? projectDir,
              timestamp: new Date().toISOString(),
              subagentId,
              parentAgentId,
            })
          })
        }).catch(() => { /* attribution is best-effort */ })
      }, 200)
    }
  })

  watcher.on('change', (filePath) => {
    if (!filePath.endsWith('.jsonl')) return
    const { projectDir, sessionId, subagentId } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)

    // Cancel any existing idle timer for this file; set a fresh 30-second one
    const existingTimer = idleTimers.get(filePath)
    if (existingTimer) clearTimeout(existingTimer)
    const idleTimer = setTimeout(() => {
      idleTimers.delete(filePath)
      // Always emit session_complete after 30s of idle — this covers orchestrators that
      // never write a "Status:" line. Use 'stale' as the fallback status.
      const meta = readAgentMeta(filePath)
      const finalEntry = readLastLine(filePath)
      let terminalStatus: string = 'stale'
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        // Search last 20 lines from bottom up for a Status block
        const lines = content.split('\n').filter(Boolean)
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
          try {
            const entry = JSON.parse(lines[i]!) as { message?: { role?: string; content?: unknown } }
            if (entry.message?.role === 'assistant') {
              const text = extractTextContent(entry)
              const m = text.match(/Status:\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)/im)
              if (m) { terminalStatus = m[1]!; break }
            }
          } catch { /* skip malformed lines */ }
        }
        // If still stale, scan the last 50 lines of raw text for any Status block
        if (terminalStatus === 'stale') {
          const fullText = lines.slice(-50).join('\n')
          const m = fullText.match(/Status:\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)/im)
          if (m) terminalStatus = m[1]!
        }
      } catch { /* keep stale */ }
      broadcast({
        type: 'session_complete',
        sessionId,
        projectDir,
        timestamp: new Date().toISOString(),
        ...(meta.agentType ? { agentName: meta.agentType } : {}),
        status: terminalStatus,
      })
    }, 30_000)
    idleTimers.set(filePath, idleTimer)

    // Parse Work Log if the last entry is an assistant message with one
    let workLog: ParsedWorkLog | undefined
    let agentName: string | undefined
    let agentStatus: string | undefined
    if (lastEntry?.message?.role === 'assistant') {
      const text = extractTextContent(lastEntry)
      workLog = parseWorkLog(text) ?? synthesizeWorkLog(text) ?? undefined
      // Extract terminal status from response text
      const statusMatch = text.match(/^Status:\s+(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)\s*$/im)
      if (statusMatch) agentStatus = statusMatch[1]
    }
    // Attempt to get agent name from meta sidecar (unconditional — works for top-level sessions too)
    const meta = readAgentMeta(filePath)
    if (meta.agentType) agentName = meta.agentType

    // Update lastSeenMs for staleness tracking
    lastSeenMs.set(sessionId, Date.now())

    broadcast({
      type: 'session_updated',
      path: filePath,
      sessionId,
      projectDir,
      projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? projectDir,
      timestamp: new Date().toISOString(),
      lastEntry,
      ...(workLog ? { workLog } : {}),
      ...(agentName ? { agentName } : {}),
      ...(agentStatus ? { agentStatus } : {}),
    })

    // Detect Agent tool_use in the last entry and emit as routing_event
    if (lastEntry?.message?.content && Array.isArray(lastEntry.message.content)) {
      for (const block of lastEntry.message.content as Array<{ type: string; name?: string; input?: { subagent_type?: string; description?: string; prompt?: string; model?: string } & Record<string, unknown> }>) {
        if (block.type === 'tool_use' && block.name === 'Agent' && block.input) {
          const subagent = block.input.subagent_type ?? block.input.description?.slice(0, 40) ?? 'ad-hoc task'
          const description = block.input.description ?? block.input.prompt?.slice(0, 200) ?? ''
          broadcast({
            type: 'routing_event',
            event: {
              timestamp: lastEntry.timestamp ?? new Date().toISOString(),
              promptPreview: description.slice(0, 200),
              action: 'agent_dispatch',
              matchedRoute: subagent,
              command: null,
              pattern: null,
              agentName: subagent,
              agentModel: block.input.model ?? null,
            },
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Emit tool_use_event for all tool calls (not just Agent)
      for (const block of lastEntry.message.content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>) {
        if (block.type === 'tool_use' && block.name && block.name !== 'Agent') {
          const inputPreview = formatInputPreview(block.name, block.input ?? {})
          broadcast({
            type: 'tool_use_event',
            sessionId,
            projectDir,
            timestamp: new Date().toISOString(),
            toolName: block.name,
            inputPreview,
            ...(subagentId ? { subagentId } : {}),
          })
        }
      }
    }
  })

  watcher.on('unlink', (filePath) => {
    const existing = idleTimers.get(filePath)
    if (existing) {
      clearTimeout(existing)
      idleTimers.delete(filePath)
    }
  })

  // Staleness guard: broadcast session_stale for sessions not seen in 8+ minutes
  const STALE_THRESHOLD_MS = 8 * 60 * 1000
  const staleInterval = setInterval(() => {
    const now = Date.now()
    for (const [sessionId, lastMs] of lastSeenMs.entries()) {
      if (now - lastMs > STALE_THRESHOLD_MS) {
        broadcast({
          type: 'session_stale',
          sessionId,
          timestamp: new Date().toISOString(),
        })
        // Remove from map so we only fire once per stale period
        lastSeenMs.delete(sessionId)
      }
    }
  }, 60_000)

  // Watch dashboard commands directory and broadcast command_queued events
  const commandsWatcher = chokidar.watch(DASHBOARD_COMMANDS_DIR, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
  })

  commandsWatcher.on('add', (filePath) => {
    if (!filePath.endsWith('.json')) return
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const cmd = JSON.parse(raw)
      broadcast({
        type: 'command_queued',
        timestamp: new Date().toISOString(),
        commandType: cmd.type,
        commandId: cmd.id,
      })
    } catch { /* skip malformed */ }
  })

  // Start cast.db change watcher — polls every 3s and broadcasts db_change_* SSE events
  startCastDbWatcher(broadcast)

  // Cleanup on process shutdown — prevent timer leaks
  const shutdown = () => {
    idleTimers.forEach(clearTimeout)
    idleTimers.clear()
    clearInterval(staleInterval)
    commandsWatcher.close()
    stopCastDbWatcher()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
