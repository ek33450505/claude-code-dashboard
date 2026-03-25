import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Express, Request, Response } from 'express'
import chokidar from 'chokidar'
import { PROJECTS_DIR } from '../constants.js'
import { decodeProjectPath } from '../parsers/projectPath.js'
import type { LiveEvent, LogEntry } from '../../src/types/index.js'
import { parseRoutingLog } from '../parsers/routing.js'
import { parseWorkLog, synthesizeWorkLog } from '../parsers/workLog.js'
import type { ParsedWorkLog } from '../../src/types/index.js'

const ROUTING_LOG = path.join(os.homedir(), '.claude', 'routing-log.jsonl')

const clients: Set<Response> = new Set()

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
  if (parts.length < 2) return { projectDir: parts[0] ?? '', sessionId: '', isSubagent: false }
  const projectDir = parts[0] ?? ''
  // Subagent paths: projDir/sessionId/subagents/agent-x.jsonl = 4 parts
  const isSubagent = parts.length === 4 && parts[2] === 'subagents'
  const sessionId = isSubagent
    ? (parts[1] ?? '')
    : path.basename(parts[1] ?? '', '.jsonl')
  return { projectDir, sessionId, isSubagent }
}

/** Read agent identity from .meta.json sidecar */
function readAgentMeta(jsonlPath: string): { agentType?: string; description?: string } {
  const metaPath = jsonlPath.replace(/\.jsonl$/, '.meta.json')
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
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

    // Replay recent routing history
    const recentEvents = parseRoutingLog(30)
    for (const event of recentEvents.slice().reverse()) {
      const historyMsg: LiveEvent = {
        type: 'routing_event',
        event,
        timestamp: event.timestamp,
        historical: true,
      }
      res.write(`data: ${JSON.stringify(historyMsg)}\n\n`)
    }

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

    const heartbeat = setInterval(() => {
      const event: LiveEvent = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }, 30_000)

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

  // Active sessions endpoint — returns sessions modified in the last 5 minutes
  app.get('/api/active', (_req: Request, res: Response) => {
    const cutoff = Date.now() - 5 * 60 * 1000
    const active: Array<{
      sessionId: string
      projectDir: string
      projectName: string
      filePath: string
      lastModified: number
      lastEntry?: LogEntry
    }> = []

    if (!fs.existsSync(PROJECTS_DIR)) {
      res.json([])
      return
    }

    const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d =>
      fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
    )

    for (const projDir of projectDirs) {
      const projPath = path.join(PROJECTS_DIR, projDir)
      const decodedPath = decodeProjectPath(projDir)
      const projectName = path.basename(decodedPath)

      const entries = fs.readdirSync(projPath)
      for (const entry of entries) {
        if (!entry.endsWith('.jsonl')) continue
        const filePath = path.join(projPath, entry)
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs > cutoff) {
          active.push({
            sessionId: path.basename(entry, '.jsonl'),
            projectDir: projDir,
            projectName,
            filePath,
            lastModified: stat.mtimeMs,
            lastEntry: readLastLine(filePath),
          })
        }
      }
    }

    active.sort((a, b) => b.lastModified - a.lastModified)
    res.json(active)
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
    const { projectDir, sessionId, isSubagent } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)
    const meta = isSubagent ? readAgentMeta(filePath) : {}

    broadcast({
      type: isSubagent ? 'agent_spawned' : 'session_updated',
      path: filePath,
      sessionId,
      projectDir,
      timestamp: new Date().toISOString(),
      lastEntry,
      agentType: meta.agentType,
      agentDescription: meta.description,
    })
  })

  watcher.on('change', (filePath) => {
    if (!filePath.endsWith('.jsonl')) return
    const { projectDir, sessionId } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)

    // Parse Work Log if the last entry is an assistant message with one
    let workLog: ParsedWorkLog | undefined
    let agentName: string | undefined
    if (lastEntry?.message?.role === 'assistant') {
      const text = extractTextContent(lastEntry)
      workLog = parseWorkLog(text) ?? synthesizeWorkLog(text) ?? undefined
    }
    // Attempt to get agent name from meta sidecar (unconditional — works for top-level sessions too)
    const meta = readAgentMeta(filePath)
    if (meta.agentType) agentName = meta.agentType

    broadcast({
      type: 'session_updated',
      path: filePath,
      sessionId,
      projectDir,
      timestamp: new Date().toISOString(),
      lastEntry,
      ...(workLog ? { workLog } : {}),
      ...(agentName ? { agentName } : {}),
    })

    // Detect Agent tool_use in the last entry and emit as routing_event
    if (lastEntry?.message?.content && Array.isArray(lastEntry.message.content)) {
      for (const block of lastEntry.message.content as Array<{ type: string; name?: string; input?: { subagent_type?: string; description?: string; prompt?: string; model?: string } }>) {
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
    }
  })

  // Watch routing log
  const routingWatcher = chokidar.watch(ROUTING_LOG, {
    persistent: true,
    ignoreInitial: true,
  } as any)

  routingWatcher.on('change', () => {
    const events = parseRoutingLog(1)
    if (events.length === 0) return
    broadcast({
      type: 'routing_event',
      event: events[0],
      timestamp: new Date().toISOString(),
    })
  })
}
