import fs from 'fs'
import path from 'path'
import { PROJECTS_DIR } from '../constants.js'
import type { RoutingEvent } from '../../src/types/index.js'

interface AgentToolInput {
  subagent_type?: string
  description?: string
  prompt?: string
  name?: string
  model?: string
}

interface ContentBlock {
  type: string
  name?: string
  input?: AgentToolInput
}

/**
 * Scan recent session JSONL files for Agent tool_use entries.
 * These represent direct sub-agent dispatches from the main agent
 * that bypass the UserPromptSubmit routing hook.
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
      const entries = fs.readdirSync(projPath)
      const jsonlFiles = entries
        .filter(f => f.endsWith('.jsonl') && fs.statSync(path.join(projPath, f)).isFile())
        .filter(f => {
          const stat = fs.statSync(path.join(projPath, f))
          return stat.mtimeMs >= cutoff
        })

      for (const jsonlFile of jsonlFiles) {
        const filePath = path.join(projPath, jsonlFile)
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter(Boolean)

          for (const line of lines) {
            try {
              const entry = JSON.parse(line)
              if (!entry.message?.content || !Array.isArray(entry.message.content)) continue

              for (const block of entry.message.content as ContentBlock[]) {
                if (block.type === 'tool_use' && block.name === 'Agent' && block.input) {
                  const subagent = block.input.subagent_type ?? 'general-purpose'
                  const agentName = block.input.name ?? null
                  const agentModel = block.input.model ?? null
                  const description = block.input.description ?? block.input.prompt?.slice(0, 200) ?? ''
                  dispatches.push({
                    timestamp: entry.timestamp ?? '',
                    promptPreview: description.slice(0, 200),
                    action: 'agent_dispatch',
                    matchedRoute: subagent,
                    command: null,
                    pattern: null,
                    agentName,
                    agentModel,
                  })
                }
              }
            } catch {
              // skip malformed lines
            }
          }
        } catch {
          // skip unreadable files
        }
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
