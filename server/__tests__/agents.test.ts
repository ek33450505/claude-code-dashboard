import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const ABS_FILE_PATH = path.join(os.homedir(), '.claude', 'agents', 'code-writer.md')
const FAKE_AGENT = {
  name: 'code-writer',
  description: 'test agent',
  model: 'sonnet',
  color: 'blue',
  tools: [],
  maxTurns: 10,
  memory: 'none',
  disallowedTools: [],
  filePath: ABS_FILE_PATH,
}

// Mock the loadAgents and other parsers before importing the router
vi.mock('../parsers/agents.js', () => ({
  loadAgents: () => [FAKE_AGENT],
  writeAgent: vi.fn(() => FAKE_AGENT),
  createAgent: vi.fn(() => FAKE_AGENT),
}))

const { agentsRouter } = await import('../routes/agents.js')

const app = express()
app.use(express.json())
app.use('/api/agents', agentsRouter)

describe('GET /api/agents/roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with correct shape when agents directory exists', async () => {
    const res = await request(app).get('/api/agents/roster')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('agents')
    expect(res.body).toHaveProperty('count')
    expect(res.body).toHaveProperty('source')
    expect(Array.isArray(res.body.agents)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('returns count === agents.length when source is filesystem', async () => {
    const res = await request(app).get('/api/agents/roster')

    expect(res.status).toBe(200)
    if (res.body.source === 'filesystem') {
      expect(res.body.count).toBe(res.body.agents.length)
    }
  })

  it('returns agents when filesystem exists, with count matching array length', async () => {
    const res = await request(app).get('/api/agents/roster')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.agents)).toBe(true)
    expect(typeof res.body.count).toBe('number')
    // When filesystem source, count must match agents.length
    if (res.body.source === 'filesystem') {
      expect(res.body.count).toBe(res.body.agents.length)
    }
  })

  it('returns sorted agents when source is filesystem', async () => {
    const res = await request(app).get('/api/agents/roster')

    if (res.status === 200 && res.body.source === 'filesystem' && res.body.agents.length > 0) {
      const sorted = [...res.body.agents].sort()
      expect(res.body.agents).toEqual(sorted)
    }
  })
})

// S6: filePath is an absolute server path (leaks username + directory layout).
// GET /api/agents and GET /api/agents/:name must hand back a ~-prefixed value
// while the route's own fs.readFileSync (GET /:name) keeps using the real
// absolute path internally.
describe('GET /api/agents — S6 path relativization', () => {
  it('returns a ~-prefixed filePath with no /Users/ (or real home dir) leak', async () => {
    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(200)
    expect(res.body[0].filePath).toBe(path.join('~', '.claude', 'agents', 'code-writer.md'))
    expect(res.body[0].filePath).not.toContain(os.homedir())

    // MUTATION TEST (manually verified, not left in the tree): revert the
    // `res.json(agents.map(forResponse))` line in routes/agents.ts back to
    // `res.json(agents)`. With that corruption, `res.body[0].filePath` comes back
    // as the raw absolute ABS_FILE_PATH (containing the real home directory) and
    // both assertions above fail.
  })
})

describe('GET /api/agents/:name — S6 path relativization', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('---\nname: code-writer\n---\nbody')
  })

  it('relativizes filePath in the response while still reading from the absolute path', async () => {
    const res = await request(app).get('/api/agents/code-writer')

    expect(res.status).toBe(200)
    expect(res.body.filePath).toBe(path.join('~', '.claude', 'agents', 'code-writer.md'))
    // The internal read must have used the REAL absolute path, not a ~-prefixed one
    // (fs does not expand ~) — confirms relativization happens only at the response.
    expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(ABS_FILE_PATH, 'utf-8')

    // MUTATION TEST (manually verified, not left in the tree): change
    // `fs.readFileSync(agent.filePath, 'utf-8')` in routes/agents.ts to read
    // `forResponse(agent).filePath` instead (the relativized value). With that
    // corruption, the readFileSync spy is called with the ~-prefixed path instead
    // of ABS_FILE_PATH — real fs would throw ENOENT for a literal '~/...' path — and
    // the `toHaveBeenCalledWith(ABS_FILE_PATH, ...)` assertion above fails.
  })
})
