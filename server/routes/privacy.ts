import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'

const AUDIT_LOG = path.join(os.homedir(), '.claude', 'logs', 'audit.jsonl')

export const privacyRouter = Router()

interface AuditEntry {
  timestamp?: string
  session_id?: string
  tool_name?: string
  is_cloud_bound?: boolean
  redacted?: boolean
  redacted_count?: number
  url?: string
  query?: string
  command_preview?: string
}

interface PrivacyStats {
  total_calls: number
  cloud_calls: number
  local_calls: number
  redacted_calls: number
  violations: number
  traffic_light: 'green' | 'yellow' | 'red'
  timeline: AuditEntry[]
  top_tools: Array<{ tool: string; count: number }>
  last_updated: string
}

function parseAuditLog(): AuditEntry[] {
  if (!fs.existsSync(AUDIT_LOG)) return []
  try {
    const content = fs.readFileSync(AUDIT_LOG, 'utf-8')
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) as AuditEntry }
        catch { return null }
      })
      .filter((e): e is AuditEntry => e !== null)
  } catch {
    return []
  }
}

// GET /api/privacy
privacyRouter.get('/', (_req, res) => {
  const entries = parseAuditLog()

  const total_calls = entries.length
  const cloud_entries = entries.filter(e => e.is_cloud_bound)
  const cloud_calls = cloud_entries.length
  const local_calls = total_calls - cloud_calls
  const redacted_calls = cloud_entries.filter(e => e.redacted).length
  const violations = cloud_calls - redacted_calls

  let traffic_light: 'green' | 'yellow' | 'red' = 'green'
  if (violations > 0) {
    traffic_light = 'red'
  } else if (cloud_calls > 0) {
    traffic_light = 'yellow'
  }

  // Last 20 entries for timeline
  const timeline = entries.slice(-20).reverse()

  // Top 5 tools by count
  const toolCounts: Record<string, number> = {}
  for (const e of entries) {
    const tool = e.tool_name ?? 'unknown'
    toolCounts[tool] = (toolCounts[tool] ?? 0) + 1
  }
  const top_tools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tool, count]) => ({ tool, count }))

  const result: PrivacyStats = {
    total_calls,
    cloud_calls,
    local_calls,
    redacted_calls,
    violations,
    traffic_light,
    timeline,
    top_tools,
    last_updated: new Date().toISOString(),
  }

  res.json(result)
})
