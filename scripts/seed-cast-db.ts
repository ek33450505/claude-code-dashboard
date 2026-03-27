/**
 * seed-cast-db.ts
 *
 * Reads all JSONL sessions from ~/.claude/projects/ and populates cast.db
 * with sessions and agent_runs rows.
 *
 * Adapts to the existing cast.db schema:
 *   sessions:   id, project, project_root, started_at, ended_at,
 *               total_input_tokens, total_output_tokens, total_cost_usd, model
 *   agent_runs: id (AUTOINCREMENT), session_id, agent, model, started_at,
 *               ended_at, status, input_tokens, output_tokens, cost_usd,
 *               task_summary, prompt, project
 *
 * Run with: npm run seed
 */

import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { listSessions, loadSession } from '../server/parsers/sessions.js'

const CAST_DB = path.join(os.homedir(), '.claude', 'cast.db')

function openDb(): ReturnType<typeof Database> {
  return new Database(CAST_DB)
}

function ensureTables(db: ReturnType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                    TEXT PRIMARY KEY,
      project               TEXT,
      project_root          TEXT,
      started_at            TEXT,
      ended_at              TEXT,
      total_input_tokens    INTEGER DEFAULT 0,
      total_output_tokens   INTEGER DEFAULT 0,
      total_cost_usd        REAL DEFAULT 0.0,
      model                 TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT REFERENCES sessions(id),
      agent           TEXT NOT NULL,
      model           TEXT,
      started_at      TEXT,
      ended_at        TEXT,
      status          TEXT,
      input_tokens    INTEGER,
      output_tokens   INTEGER,
      cost_usd        REAL,
      task_summary    TEXT,
      prompt          TEXT,
      project         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent   ON agent_runs(agent);
  `)
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * 0.000003 + outputTokens * 0.000015
}

function seed(): { sessions: number; agentRuns: number } {
  const db = openDb()
  ensureTables(db)

  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, project, project_root, started_at, ended_at, total_input_tokens, total_output_tokens, total_cost_usd, model)
    VALUES
      (@id, @project, @project_root, @started_at, @ended_at, @total_input_tokens, @total_output_tokens, @total_cost_usd, @model)
  `)

  // Check for duplicate by session_id + agent + started_at to avoid re-inserting on reseed
  const checkRun = db.prepare(`
    SELECT id FROM agent_runs WHERE session_id = ? AND agent = ? AND started_at = ? LIMIT 1
  `)

  const insertRun = db.prepare(`
    INSERT INTO agent_runs
      (session_id, agent, model, started_at, ended_at, status, input_tokens, output_tokens, cost_usd, task_summary, prompt, project)
    VALUES
      (@session_id, @agent, @model, @started_at, @ended_at, @status, @input_tokens, @output_tokens, @cost_usd, @task_summary, @prompt, @project)
  `)

  let sessionCount = 0
  let runCount = 0

  const sessions = listSessions()

  for (const session of sessions) {
    const totalCost = estimateCost(session.inputTokens ?? 0, session.outputTokens ?? 0)

    const sessionResult = insertSession.run({
      id: session.id,
      project: session.project,
      project_root: session.projectPath,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      total_input_tokens: session.inputTokens ?? 0,
      total_output_tokens: session.outputTokens ?? 0,
      total_cost_usd: totalCost,
      model: session.model ?? null,
    })

    if (sessionResult.changes > 0) {
      sessionCount++
    }

    // Load full session entries to find agent dispatches
    const entries = loadSession(session.projectEncoded, session.id)

    // Build a map from tool_use_id -> result info for quick lookup.
    // Tool results appear in 'user' entries as content blocks with type 'tool_result'.
    const toolResultsByUseId: Record<string, { timestamp: string; content: unknown }> = {}
    for (const entry of entries) {
      if (entry.type !== 'user') continue
      const content = entry.message?.content
      if (!Array.isArray(content)) continue
      for (const rawBlock of content) {
        const block = rawBlock as unknown as Record<string, unknown>
        if (block.type === 'tool_result' && block.tool_use_id) {
          const useId = block.tool_use_id as string
          toolResultsByUseId[useId] = {
            timestamp: entry.timestamp,
            content: block.content,
          }
        }
      }
    }

    for (const entry of entries) {
      if (entry.type !== 'assistant') continue
      const content = entry.message?.content
      if (!Array.isArray(content)) continue

      for (const block of content) {
        if (block.type !== 'tool_use' || block.name !== 'Agent') continue

        const input = block.input as Record<string, unknown> | undefined
        if (!input) continue

        const agentName = (input.subagent_type as string) ?? 'unknown'
        const agentModel = (input.model as string) ?? 'sonnet'
        const prompt = (input.prompt as string) ?? ''
        const taskSummary = prompt.slice(0, 200) || null

        const startedAt = entry.timestamp ?? session.startedAt

        // Skip if we already have this run (idempotent reseed)
        const existing = checkRun.get(session.id, agentName, startedAt)
        if (existing) continue

        const result = block.id ? toolResultsByUseId[block.id] : undefined
        const endedAt = result?.timestamp ?? null

        let status = 'done'
        if (result?.content) {
          const contentStr = typeof result.content === 'string'
            ? result.content.toLowerCase()
            : JSON.stringify(result.content).toLowerCase()
          if (contentStr.includes('error') || contentStr.includes('failed')) {
            status = 'failed'
          }
        }

        insertRun.run({
          session_id: session.id,
          agent: agentName,
          model: agentModel,
          started_at: startedAt,
          ended_at: endedAt,
          status,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
          task_summary: taskSummary,
          prompt: prompt.slice(0, 2000) || null,
          project: session.project,
        })

        runCount++
      }
    }
  }

  db.close()
  return { sessions: sessionCount, agentRuns: runCount }
}

const result = seed()
console.log(`Seeded ${result.sessions} sessions, ${result.agentRuns} agent_runs`)
