import fs from 'fs'
import path from 'path'
import { PROJECTS_DIR } from '../constants.js'
import { decodeProjectPath } from './projectPath.js'
import type { Session, LogEntry, ContentBlock } from '../../src/types/index.js'

export function listSessions(): Session[] {
  if (!fs.existsSync(PROJECTS_DIR)) return []

  const sessions: Session[] = []
  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
    const full = path.join(PROJECTS_DIR, d)
    return fs.statSync(full).isDirectory()
  })

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir)
    const projectPath = decodeProjectPath(projDir)
    const projectName = path.basename(projectPath)

    // Find .jsonl files at the top level only (not in subdirs like tasks/)
    const entries = fs.readdirSync(projPath)
    const jsonlFiles = entries.filter(f => f.endsWith('.jsonl') && fs.statSync(path.join(projPath, f)).isFile())

    for (const jsonlFile of jsonlFiles) {
      const filePath = path.join(projPath, jsonlFile)
      const sessionId = path.basename(jsonlFile, '.jsonl')

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter(Boolean)
        if (lines.length === 0) continue

        const firstLine = JSON.parse(lines[0])
        const lastLine = lines.length > 1 ? JSON.parse(lines[lines.length - 1]) : firstLine

        const startedAt = firstLine.timestamp || ''
        const endedAt = lastLine.timestamp || ''
        const durationMs = startedAt && endedAt
          ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
          : undefined

        // Count tool_use blocks
        let toolCallCount = 0
        let messageCount = lines.length
        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (entry.message?.content && Array.isArray(entry.message.content)) {
              toolCallCount += entry.message.content.filter(
                (b: ContentBlock) => b.type === 'tool_use'
              ).length
            }
          } catch {
            // skip malformed lines
          }
        }

        // Count subagent directories
        let agentCount = 0
        const sessionDir = path.join(projPath, sessionId)
        if (fs.existsSync(sessionDir) && fs.statSync(sessionDir).isDirectory()) {
          agentCount = fs.readdirSync(sessionDir).filter(d =>
            fs.statSync(path.join(sessionDir, d)).isDirectory()
          ).length
        }

        sessions.push({
          id: sessionId,
          project: projectName,
          projectPath,
          projectEncoded: projDir,
          startedAt,
          endedAt,
          durationMs,
          messageCount,
          toolCallCount,
          agentCount,
          gitBranch: firstLine.gitBranch,
          slug: firstLine.slug,
          version: firstLine.version,
        })
      } catch {
        // skip unreadable files
      }
    }
  }

  sessions.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
  return sessions
}

export function loadSession(projectEncoded: string, sessionId: string): LogEntry[] {
  const filePath = path.join(PROJECTS_DIR, projectEncoded, `${sessionId}.jsonl`)
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(Boolean)
  const entries: LogEntry[] = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch {
      // skip malformed
    }
  }

  return entries
}
