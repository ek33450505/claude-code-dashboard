import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { PROJECTS_DIR } from '../constants.js'
import { decodeProjectPath } from '../parsers/projectPath.js'
import type { LiveAgent, TodoItem } from '../../src/types/index.js'

export const agentsLiveRouter = Router()

/** Scan subagent directories for recently-active agent JSONL files */
agentsLiveRouter.get('/', (_req, res) => {
  const cutoff = Date.now() - 5 * 60 * 1000 // 5 minutes
  const activeCutoff = Date.now() - 2 * 60 * 1000 // 2 minutes = "active"
  const agents: LiveAgent[] = []

  if (!fs.existsSync(PROJECTS_DIR)) {
    res.json([])
    return
  }

  try {
    const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
      try { return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory() } catch { return false }
    })

    for (const projDir of projectDirs) {
      const projPath = path.join(PROJECTS_DIR, projDir)
      const decodedPath = decodeProjectPath(projDir)
      const projectName = path.basename(decodedPath)

      // Look for session directories (UUIDs) that contain subagents/
      let entries: string[]
      try { entries = fs.readdirSync(projPath) } catch { continue }

      for (const entry of entries) {
        const sessionDir = path.join(projPath, entry)
        try { if (!fs.statSync(sessionDir).isDirectory()) continue } catch { continue }

        const subagentDir = path.join(sessionDir, 'subagents')
        if (!fs.existsSync(subagentDir)) continue

        let subFiles: string[]
        try { subFiles = fs.readdirSync(subagentDir) } catch { continue }

        const jsonlFiles = subFiles.filter(f => f.endsWith('.jsonl'))

        for (const jsonlFile of jsonlFiles) {
          const filePath = path.join(subagentDir, jsonlFile)
          let stat: fs.Stats
          try { stat = fs.statSync(filePath) } catch { continue }

          if (stat.mtimeMs < cutoff) continue

          // Read meta.json sidecar
          const metaPath = filePath.replace(/\.jsonl$/, '.meta.json')
          let agentType: string | undefined
          let description: string | undefined
          try {
            if (fs.existsSync(metaPath)) {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
              agentType = meta.agentType
              description = meta.description
            }
          } catch { /* ignore */ }

          // Count lines and read first line for timestamp/model
          let messageCount = 0
          let startedAt = ''
          let model: string | undefined
          let taskPrompt: string | undefined
          let todos: TodoItem[] | undefined
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            const lines = content.split('\n').filter(Boolean)
            messageCount = lines.length

            // First line: timestamp + task prompt
            if (lines[0]) {
              const firstEntry = JSON.parse(lines[0])
              startedAt = firstEntry.timestamp ?? ''
              // Extract task prompt from first user message
              const msgContent = firstEntry.message?.content
              if (typeof msgContent === 'string') {
                taskPrompt = msgContent.slice(0, 400)
              } else if (Array.isArray(msgContent)) {
                const textBlock = msgContent.find((b: { type: string; text?: string }) => b.type === 'text')
                taskPrompt = textBlock?.text?.slice(0, 400)
              }
            }

            // Scan all lines for model + latest TodoWrite call
            let latestTodoIndex = -1
            let latestTodos: TodoItem[] | undefined
            lines.forEach((line, idx) => {
              try {
                const e = JSON.parse(line)
                // Grab model from first assistant message
                if (!model && e.message?.role === 'assistant' && e.message?.model) {
                  model = e.message.model
                }
                // Find latest TodoWrite tool_use in assistant content blocks
                if (e.message?.role === 'assistant' && Array.isArray(e.message?.content)) {
                  for (const block of e.message.content as Array<{ type: string; name?: string; input?: { todos?: TodoItem[] } }>) {
                    if (block.type === 'tool_use' && block.name === 'TodoWrite' && Array.isArray(block.input?.todos)) {
                      if (idx >= latestTodoIndex) {
                        latestTodoIndex = idx
                        latestTodos = block.input!.todos as TodoItem[]
                      }
                    }
                  }
                }
              } catch { /* skip */ }
            })

            if (latestTodos) todos = latestTodos
          } catch { /* ignore */ }

          const agentId = path.basename(jsonlFile, '.jsonl')

          agents.push({
            agentId,
            agentType,
            description,
            taskPrompt,
            todos,
            sessionId: entry,
            projectDir: projDir,
            projectName,
            startedAt,
            lastModifiedMs: stat.mtimeMs,
            messageCount,
            model,
            isActive: stat.mtimeMs >= activeCutoff,
          })
        }
      }
    }
  } catch { /* ignore */ }

  agents.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
  res.json(agents)
})
