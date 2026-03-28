import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'

const AUDIT_LOG = path.join(os.homedir(), '.claude', 'logs', 'audit.jsonl')

export const privacyAuditRouter = Router()

interface RawAuditEntry {
  timestamp?: string
  session_id?: string
  tool_name?: string
  is_cloud_bound?: boolean
  redacted?: boolean
  [key: string]: unknown
}

interface AuditRecentEntry {
  timestamp: string
  session_id: string
  tool: string
  destination: 'cloud' | 'local'
  redacted: boolean
}

interface AuditStats {
  total_calls: number
  cloud_calls: number
  local_calls: number
  redaction_events: number
  recent: AuditRecentEntry[]
  cloud_pct: number
}

const EMPTY: AuditStats = {
  total_calls: 0,
  cloud_calls: 0,
  local_calls: 0,
  redaction_events: 0,
  recent: [],
  cloud_pct: 0,
}

function parseAuditLog(): RawAuditEntry[] {
  if (!fs.existsSync(AUDIT_LOG)) return []
  try {
    const content = fs.readFileSync(AUDIT_LOG, 'utf-8')
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line) as RawAuditEntry
        } catch {
          return null
        }
      })
      .filter((e): e is RawAuditEntry => e !== null)
  } catch {
    return []
  }
}

// GET /api/privacy/audit
privacyAuditRouter.get('/', (_req, res) => {
  const entries = parseAuditLog()

  if (entries.length === 0) {
    res.json(EMPTY)
    return
  }

  const total_calls = entries.length
  const cloud_calls = entries.filter(e => e.is_cloud_bound).length
  const local_calls = total_calls - cloud_calls
  const redaction_events = entries.filter(e => e.redacted).length
  const cloud_pct = total_calls > 0 ? Math.round((cloud_calls / total_calls) * 100) : 0

  const recent: AuditRecentEntry[] = entries
    .slice(-50)
    .reverse()
    .map(e => ({
      timestamp: e.timestamp ?? '',
      session_id: e.session_id ?? '',
      tool: e.tool_name ?? 'unknown',
      destination: e.is_cloud_bound ? 'cloud' : 'local',
      redacted: e.redacted ?? false,
    }))

  const result: AuditStats = {
    total_calls,
    cloud_calls,
    local_calls,
    redaction_events,
    recent,
    cloud_pct,
  }

  res.json(result)
})
