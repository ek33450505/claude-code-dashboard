import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Express, Request, Response } from 'express'
import chokidar from 'chokidar'
import { PROJECTS_DIR } from '../constants.js'
import { decodeProjectPath } from '../parsers/projectPath.js'
import type { LiveEvent, LogEntry } from '../../src/types/index.js'
import { parseRoutingLog } from '../parsers/routing.js'

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
  const projectDir = parts[0]
  const isSubagent = parts.length === 3
  const sessionId = isSubagent ? parts[1] : path.basename(parts[1] || '', '.jsonl')
  return { projectDir, sessionId, isSubagent }
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
    depth: 2,
  })

  watcher.on('add', (filePath) => {
    if (!filePath.endsWith('.jsonl')) return
    const { projectDir, sessionId, isSubagent } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)

    broadcast({
      type: isSubagent ? 'agent_spawned' : 'session_updated',
      path: filePath,
      sessionId,
      projectDir,
      timestamp: new Date().toISOString(),
      lastEntry,
    })
  })

  watcher.on('change', (filePath) => {
    if (!filePath.endsWith('.jsonl')) return
    const { projectDir, sessionId } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)

    broadcast({
      type: 'session_updated',
      path: filePath,
      sessionId,
      projectDir,
      timestamp: new Date().toISOString(),
      lastEntry,
    })
  })

  // Watch routing log
  const routingWatcher = chokidar.watch(ROUTING_LOG, {
    persistent: true,
    ignoreInitial: true,
  })

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
