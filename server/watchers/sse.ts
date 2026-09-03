import fs from 'fs'
import path from 'path'
import type { Express, Request, Response } from 'express'
import chokidar from 'chokidar'
import { PROJECTS_DIR, DASHBOARD_COMMANDS_DIR, CORS_ORIGIN } from '../constants.js'
import { decodeProjectPath } from '../parsers/projectPath.js'
import { redactPath } from '../utils/projectKey.js'
import type { LiveEvent, LogEntry } from '../../src/types/index.js'
import { parseWorkLog, synthesizeWorkLog } from '../parsers/workLog.js'
import type { ParsedWorkLog } from '../../src/types/index.js'
import { startCastDbWatcher, stopCastDbWatcher } from './castDbWatcher.js'
import { getCastDb } from '../routes/castDb.js'

// Exported for direct testing (P7) — same pattern as readTail/readLastLine below.
export const clients: Set<Response> = new Set()

// Staleness tracking: maps sessionId → last seen timestamp (ms)
export const lastSeenMs: Map<string, number> = new Map()

// Idle completion timers: maps filePath → NodeJS.Timeout
const idleTimers: Map<string, NodeJS.Timeout> = new Map()

// Most-recently-active session JSONL, tracked incrementally by the watcher so each
// new SSE connection can replay from it without a full per-connection directory
// sweep (P3). Seeded once at startup, then kept fresh on every add/change.
let activeJsonlPath: string | null = null
let activeJsonlMtime = 0
function noteActiveFile(filePath: string) {
  activeJsonlMtime = Date.now()
  activeJsonlPath = filePath
}
function seedActiveFile() {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) return
    for (const proj of fs.readdirSync(PROJECTS_DIR)) {
      const projPath = path.join(PROJECTS_DIR, proj)
      let entries: string[]
      try { entries = fs.readdirSync(projPath) } catch { continue }
      for (const f of entries) {
        if (!f.endsWith('.jsonl')) continue
        const fp = path.join(projPath, f)
        try {
          const m = fs.statSync(fp).mtimeMs
          if (m > activeJsonlMtime) { activeJsonlMtime = m; activeJsonlPath = fp }
        } catch { /* skip */ }
      }
    }
  } catch { /* best-effort */ }
}

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

// P7: register a client for broadcast() and guard the connection so a write to it
// after it has gone away can never crash the process. Used by both the /api/events
// route handler below and directly by tests, so the exact wiring under test is the
// exact wiring in production (not a reimplementation of it).
//
// Correction to an earlier version of this fix: a write to a client whose socket has
// already gone away does NOT throw synchronously. Verified against real Node v26.8.1
// — both write-after-res.end() and write-to-a-destroyed-socket return `false`
// synchronously and never throw. So a try/catch around client.write() is dead code
// for this failure mode; that is why the checks below are synchronous state tests
// rather than exception handling.
//
// BOTH guards here are load-bearing; neither is decorative:
//
//   1. The `writableEnded`/`destroyed` checks in broadcast() and the heartbeat skip
//      the write for a client already known to be gone, and prune it.
//
//   2. This 'error' listener prevents a process crash. Write-after-end DOES emit an
//      asynchronous 'error' event (ERR_STREAM_WRITE_AFTER_END) — confirmed on this
//      same Node v26.8.1 — and an http.ServerResponse with no 'error' listener turns
//      that into an uncaughtException, taking down the server for every connected
//      user. /api/events is public and unauthenticated, so that is remotely
//      reachable. A repro that attaches no listener prints exactly:
//        UNCAUGHT (no listener) -> ERR_STREAM_WRITE_AFTER_END
//
// Do NOT delete this listener on the grounds that the checks in (1) already skip the
// write: (1) only covers clients whose state has already flipped by the time
// broadcast() runs. A socket dying between the check and the write, or any other
// write path in this file, still routes through 'error'.
export function attachClient(res: Response): void {
  clients.add(res)
  res.on('error', () => {
    clients.delete(res)
  })
}

export function broadcast(event: LiveEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  const dead: Response[] = []
  for (const client of clients) {
    // Fast path: skip a client we already know is gone rather than attempting a
    // write that (per the repro above) would silently no-op anyway. This is what
    // prunes a known-dead client synchronously within this call — deleting from
    // `clients` while iterating it would skip or double-visit entries depending on
    // Set iteration semantics, so the removal pass runs separately below.
    if (client.writableEnded || client.destroyed) {
      dead.push(client)
      continue
    }
    client.write(data)
  }
  for (const client of dead) {
    clients.delete(client)
  }
}

const TAIL_BYTES = 256 * 1024

/** Read up to the last `maxBytes` of a file as UTF-8, dropping a possibly-partial
 *  first line at the chunk boundary. Returns the whole file when it is smaller than
 *  the cap. Avoids loading multi-MB JSONL files on every append (P1). */
export function readTail(filePath: string, maxBytes = TAIL_BYTES): string {
  const stat = fs.statSync(filePath)
  if (stat.size <= maxBytes) {
    return fs.readFileSync(filePath, 'utf-8')
  }
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.allocUnsafe(maxBytes)
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, stat.size - maxBytes)
    const chunk = buf.toString('utf-8', 0, bytesRead)
    // Drop the (possibly partial) first line — the read may start mid-line.
    const nl = chunk.indexOf('\n')
    return nl >= 0 ? chunk.slice(nl + 1) : chunk
  } finally {
    fs.closeSync(fd)
  }
}

/** Parse the last non-empty line of a JSONL string. */
function parseLastNonEmptyLine(content: string): LogEntry | undefined {
  const lines = content.trimEnd().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      try { return JSON.parse(lines[i]) as LogEntry } catch { return undefined }
    }
  }
  return undefined
}

/** Read the last non-empty JSONL entry without loading the whole file (P1). Falls
 *  back to a full read only when the tail held no complete line (e.g. a single
 *  entry larger than the tail window). */
export function readLastLine(filePath: string): LogEntry | undefined {
  try {
    const fromTail = parseLastNonEmptyLine(readTail(filePath))
    if (fromTail) return fromTail
    // Tail yielded nothing parseable — the last entry may exceed the tail window.
    if (fs.statSync(filePath).size > TAIL_BYTES) {
      return parseLastNonEmptyLine(fs.readFileSync(filePath, 'utf-8'))
    }
    return undefined
  } catch {
    return undefined
  }
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
// Per-file cache of the extracted-name result (including a definitive "no match").
// Separate from agentMetaCache below: this one is safe to cache negatives in,
// because it only ever reads the FIRST LINE of an append-only JSONL log, which is
// immutable once written — unlike the .meta.json sidecar (cached by agentMetaCache),
// which can legitimately be written some time after the jsonl and must stay
// re-checkable. Only cache once a real first line was read and parsed — a read
// error or empty file may mean chokidar's 'add' fired before content was flushed,
// and that case must be retried on the next call, not cached as a permanent miss.
const castAgentNameCache: Map<string, string | undefined> = new Map()

// Exported for direct testing — same pattern as readTail/readLastLine above.
export function extractCastAgentName(jsonlPath: string): string | undefined {
  if (castAgentNameCache.has(jsonlPath)) return castAgentNameCache.get(jsonlPath)
  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const firstLine = content.split('\n').find(l => l.trim())
    if (!firstLine) return undefined
    const entry = JSON.parse(firstLine) as { message?: { role?: string; content?: unknown } }
    if (entry.message?.role !== 'user') {
      castAgentNameCache.set(jsonlPath, undefined)
      return undefined
    }
    const text = typeof entry.message.content === 'string'
      ? entry.message.content
      : Array.isArray(entry.message.content)
        ? (entry.message.content as Array<{ type?: string; text?: string }>)
            .filter(b => b.type === 'text').map(b => b.text ?? '').join(' ')
        : ''
    const m = text.match(/^You are (?:(?:the|a) CAST |(?:the|a) )?`?([a-z][a-z0-9-]+)`?(?: agent)?[.\s,]/im)
    const result = m ? m[1]!.toLowerCase() : undefined
    castAgentNameCache.set(jsonlPath, result)
    return result
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

/** Per-file cache of resolved agent identity. The identity comes from the first
 *  JSONL line / sidecar and never changes, so resolve it once per file instead of
 *  re-reading the whole file on every append (P1). Only cached once a concrete
 *  agentType is known (the sidecar may be written slightly after the jsonl). */
const agentMetaCache: Map<string, { agentType?: string; description?: string }> = new Map()
function readAgentMetaCached(jsonlPath: string): { agentType?: string; description?: string } {
  const cached = agentMetaCache.get(jsonlPath)
  if (cached) return cached
  const meta = readAgentMeta(jsonlPath)
  if (meta.agentType) agentMetaCache.set(jsonlPath, meta)
  return meta
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
  // Seed the active-file pointer once; the watcher keeps it fresh afterward (P3).
  seedActiveFile()

  app.get('/api/events', (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      Vary: 'Origin',
    })

    res.write('\n')
    attachClient(res)

    // Replay last 15 messages from the most recently active session JSONL.
    // The active file is tracked incrementally (P3), so no per-connection sweep.
    try {
      const activeFile = activeJsonlPath
      if (activeFile && fs.existsSync(activeFile)) {
        const lines = readTail(activeFile).split('\n').filter(l => l.trim())
        const recent = lines.slice(-15)
        for (const line of recent) {
          try {
            const entry: LogEntry = JSON.parse(line)
            if (entry.message?.role && entry.message?.content) {
              res.write(`data: ${JSON.stringify({
                type: 'session_updated',
                // activeFile stays absolute above (fs.existsSync/readTail) —
                // redact only in the emitted event. LiveEvent.path is unauthenticated
                // and client-facing. activeFile lives under PROJECTS_DIR, so it embeds
                // the username BOTH as a leading real-home prefix and inside the
                // encoded project-directory segment mid-string — redactPath() (=
                // relativizeHome + maskProjectKey) closes both; a bare relativizeHome()
                // left the encoded segment exposed (same bug as compactionEvents.ts's
                // transcript_path and search.ts's memories[].path).
                path: redactPath(activeFile) ?? undefined,
                sessionId: '',
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
    // Reuses the shared readonly singleton (getCastDb()) instead of opening a fresh
    // connection per SSE connect — EventSource auto-reconnects aggressively on any
    // network blip, so a fresh open/close pair here was real per-reconnect overhead.
    // It also inherits the singleton's busy_timeout pragma, which every other cast.db
    // reader in this codebase relies on because the flagship's hooks write to cast.db
    // out-of-process; without it, a reconnect landing mid-write got SQLITE_BUSY
    // immediately and this try/catch silently swallowed it as "best-effort". Do NOT
    // close this connection — it is shared and long-lived, owned by castDb.ts.
    try {
      const db = getCastDb()
      if (db) {
        const rows = db.prepare(`
          SELECT DISTINCT session_id
          FROM agent_runs
          WHERE status IN ('DONE','DONE_WITH_CONCERNS','BLOCKED','NEEDS_CONTEXT','failed','stale')
            AND ended_at IS NOT NULL
            AND unixepoch(ended_at) > unixepoch('now', '-2 hours')
        `).all() as Array<{ session_id: string }>
        const doneSessionIds = rows.map(r => r.session_id).filter(Boolean)
        if (doneSessionIds.length > 0) {
          res.write(`data: ${JSON.stringify({
            type: 'stale_reconcile',
            timestamp: new Date().toISOString(),
            doneSessionIds,
          } satisfies LiveEvent)}\n\n`)
        }
      }
    } catch { /* stale reconciliation is best-effort — never block SSE setup */ }

    const heartbeat = setInterval(() => {
      // Same fast-path check as broadcast() above — skip a client we already know is
      // gone instead of attempting a write that would silently no-op (see the repro
      // notes on attachClient()/broadcast()).
      if (res.writableEnded || res.destroyed) {
        clearInterval(heartbeat)
        clients.delete(res)
        return
      }
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
    noteActiveFile(filePath)
    const { projectDir, sessionId, isSubagent, subagentId } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)
    const meta = readAgentMetaCached(filePath)

    broadcast({
      type: isSubagent ? 'agent_spawned' : 'session_updated',
      // filePath stays absolute above (noteActiveFile, extractSessionInfo,
      // readLastLine, readAgentMetaCached, path.dirname for subagentsDir) —
      // redact only in the broadcast event. filePath embeds the username both
      // as a leading real-home prefix and inside the encoded project-directory
      // segment mid-string (it lives under PROJECTS_DIR) — redactPath() closes
      // both; relativizeHome() alone left the encoded segment exposed.
      path: redactPath(filePath) ?? undefined,
      sessionId,
      // projectDir (the raw hyphen-encoded ~/.claude/projects/<encoded> directory
      // name) embeds the username in plaintext and is dropped from the broadcast
      // payload entirely rather than redacted in place, because it also collapses
      // multiple real project segments (Projects/personal/x) down to one opaque
      // token — redactPath() would hide the username but still isn't the same
      // shape as the human-readable projectName clients actually want. projectName
      // (derived below) is the safe, final-segment-only value that's actually sent.
      // The fallback is '' (not `?? projectDir`) — falling back to projectDir would
      // re-emit the exact encoded name this field exists to avoid leaking.
      projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? '',
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
              // '' fallback, not `?? projectDir` — see the comment above.
              projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? '',
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
    noteActiveFile(filePath)
    const { projectDir, sessionId, subagentId } = extractSessionInfo(filePath)
    const lastEntry = readLastLine(filePath)

    // Cancel any existing idle timer for this file; set a fresh 30-second one
    const existingTimer = idleTimers.get(filePath)
    if (existingTimer) clearTimeout(existingTimer)
    const idleTimer = setTimeout(() => {
      idleTimers.delete(filePath)
      // Always emit session_complete after 30s of idle — this covers orchestrators that
      // never write a "Status:" line. Use 'stale' as the fallback status.
      const meta = readAgentMetaCached(filePath)
      const finalEntry = readLastLine(filePath)
      let terminalStatus: string = 'stale'
      try {
        const content = readTail(filePath)
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
    const meta = readAgentMetaCached(filePath)
    if (meta.agentType) agentName = meta.agentType

    // Update lastSeenMs for staleness tracking
    lastSeenMs.set(sessionId, Date.now())

    broadcast({
      type: 'session_updated',
      // filePath stays absolute above (noteActiveFile, readLastLine, idleTimers/
      // agentMetaCache keys) — redact only in the broadcast event. Same compound
      // leak (leading home prefix + embedded encoded segment) as the 'add' handler
      // above — see that comment.
      path: redactPath(filePath) ?? undefined,
      sessionId,
      // projectDir dropped from the payload, and '' fallback (not `?? projectDir`)
      // — see the comment on the 'add' handler's broadcast above.
      projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? '',
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
    agentMetaCache.delete(filePath)
    castAgentNameCache.delete(filePath)
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
    watcher.close()
    commandsWatcher.close()
    stopCastDbWatcher()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
