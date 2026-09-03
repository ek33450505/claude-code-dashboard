import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const broadcast = vi.fn()

vi.mock('../watchers/sse.js', () => ({ broadcast }))

const { hookEventsRouter } = await import('../routes/hookEvents.js')

const app = express()
app.use(express.json())
app.use('/', hookEventsRouter)

beforeEach(() => {
  broadcast.mockClear()
})

describe('POST /api/hook-events — additive fan-out onto the main SSE feed', () => {
  it('still writes to the ring buffer / own SSE registry (unchanged, backward-compatible)', async () => {
    const res = await request(app).post('/').send({ hook_type: 'PostToolUse', tool_name: 'Read' })
    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)

    const recent = await request(app).get('/recent')
    expect(recent.body.events).toHaveLength(1)
    expect(recent.body.events[0].hook_type).toBe('PostToolUse')
  })

  it('also calls the shared broadcast() with a type: hook_event LiveEvent', async () => {
    await request(app).post('/').send({ hook_type: 'PostCompact', trigger: 'auto' })

    expect(broadcast).toHaveBeenCalledTimes(1)
    const event = broadcast.mock.calls[0][0]
    expect(event.type).toBe('hook_event')
    expect(event.hookEventName).toBe('PostCompact')
    expect(event.hookTrigger).toBe('auto')
    expect(typeof event.timestamp).toBe('string')

    // MUTATION CHECK (manually verified, not left in tree): remove the broadcast(...)
    // call from hookEvents.ts's POST handler — broadcast is then never invoked and
    // the first assertion above fails.
  })

  it('passes through subagent_type and agent_id when present', async () => {
    await request(app).post('/').send({ hook_type: 'TaskCreated', subagent_type: 'backend-writer', agent_id: 'agt-1' })

    const event = broadcast.mock.calls[0][0]
    expect(event.hookAgentName).toBe('backend-writer')
    expect(event.hookAgentId).toBe('agt-1')
  })
})
