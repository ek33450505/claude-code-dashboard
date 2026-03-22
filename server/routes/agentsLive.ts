import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { PROJECTS_DIR } from '../constants.js'
import { decodeProjectPath } from '../parsers/projectPath.js'
import type { LiveAgent } from '../../src/types/index.js'

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
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            const lines = content.split('\n').filter(Boolean)
            messageCount = lines.length
            if (lines[0]) {
              const firstEntry = JSON.parse(lines[0])
              startedAt = firstEntry.timestamp ?? ''
            }
            // Find first assistant message for model
            for (const line of lines) {
              try {
                const e = JSON.parse(line)
                if (e.message?.role === 'assistant' && e.message?.model) {
                  model = e.message.model
                  break
                }
              } catch { /* skip */ }
            }
          } catch { /* ignore */ }

          const agentId = path.basename(jsonlFile, '.jsonl')

          agents.push({
            agentId,
            agentType,
            description,
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
