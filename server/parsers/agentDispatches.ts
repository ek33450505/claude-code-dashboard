import fs from 'fs'
import path from 'path'
import { PROJECTS_DIR } from '../constants.js'
import type { RoutingEvent } from '../../src/types/index.js'

interface ContentBlock {
  type: string
  name?: string
  input?: AgentToolInput
}

/**
 * Scan subagent session files (in {sessionId}/subagents/) for recent agent dispatches.
 * Uses meta.json sidecars for the correct agent type — more reliable than scanning
 * parent JSONL tool_use blocks (which lack subagent_type for general-purpose agents).
 */
export function getRecentAgentDispatches(limit = 50): RoutingEvent[] {
  if (!fs.existsSync(PROJECTS_DIR)) return []

  const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
  const dispatches: RoutingEvent[] = []

  try {
    const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
      const full = path.join(PROJECTS_DIR, d)
      return fs.statSync(full).isDirectory()
    })

    for (const projDir of projectDirs) {
      const projPath = path.join(PROJECTS_DIR, projDir)

      // Scan session subdirectories for subagent session files.
      // Each session directory is named by its UUID and may contain a subagents/ dir.
      const sessionIds = fs.readdirSync(projPath).filter(d => {
        try {
          return fs.statSync(path.join(projPath, d)).isDirectory()
        } catch { return false }
      })

      for (const sessionId of sessionIds) {
        const subagentDir = path.join(projPath, sessionId, 'subagents')
        try {
          if (fs.existsSync(subagentDir) && fs.statSync(subagentDir).isDirectory()) {
            const subFiles = fs.readdirSync(subagentDir)
              .filter(f => f.endsWith('.jsonl'))
              .filter(f => {
                try {
                  return fs.statSync(path.join(subagentDir, f)).mtimeMs >= cutoff
                } catch { return false }
              })

            for (const subFile of subFiles) {
              const subPath = path.join(subagentDir, subFile)
              // Read meta.json sidecar for agent identity
              const metaPath = subPath.replace(/\.jsonl$/, '.meta.json')
              let agentType: string | null = null
              let description = ''
              try {
                if (fs.existsSync(metaPath)) {
                  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
                  agentType = meta.agentType ?? null
                  description = meta.description ?? ''
                }
              } catch { /* ignore */ }

              // Read first line for timestamp and prompt preview
              let timestamp = ''
              let model: string | null = null
              try {
                const firstLine = fs.readFileSync(subPath, 'utf-8').split('\n')[0]
                if (firstLine) {
                  const entry = JSON.parse(firstLine)
                  timestamp = entry.timestamp ?? ''
                  model = entry.message?.model ?? null
                  if (!description && entry.message?.content) {
                    const content = typeof entry.message.content === 'string'
                      ? entry.message.content
                      : Array.isArray(entry.message.content)
                        ? entry.message.content.find((b: ContentBlock) => b.type === 'text')?.text ?? ''
                        : ''
                    description = content.slice(0, 200)
                  }
                }
              } catch { /* ignore */ }

              // Fall back to extracting agent id from filename (agent-<id>.jsonl)
              const agentId = agentType ?? path.basename(subFile, '.jsonl')

              dispatches.push({
                timestamp,
                promptPreview: description.slice(0, 200),
                action: 'agent_dispatch',
                matchedRoute: agentId,
                command: null,
                pattern: null,
                agentName: agentType,
                agentModel: model,
              })
            }
          }
        } catch { /* ignore */ }
      }
    }
  } catch {
    return []
  }

  // Sort newest first, limit results
  dispatches.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  return dispatches.slice(0, limit)
}
