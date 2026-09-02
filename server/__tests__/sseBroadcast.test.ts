import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'http'
import type { AddressInfo } from 'net'
import { attachClient, broadcast, clients } from '../watchers/sse.js'
import type { LiveEvent } from '../../src/types/index.js'

// P7: exercises the REAL attachClient()/broadcast() wiring from sse.ts against real
// http.ServerResponse objects — not hand-rolled fakes.
//
// An earlier version of this file used a fake client whose write() threw
// synchronously to simulate a "dead client". A real-Node repro (v26.8.1, see the
// comment on attachClient() in sse.ts) showed that's not what actually happens:
// writing to an ended or destroyed http.ServerResponse never throws and — in this
// repro, across three scenarios and repeated attempts over 500ms — never emitted an
// async 'error' event either; it just silently returns `false`. A synchronous-throw
// fake tested a failure mode that doesn't occur in practice and would have kept
// passing even with the fix fully removed (the exact false-proxy class this project
// keeps getting bitten by). This file replaces it with real connections.

function waitForResponse(req: http.ClientRequest): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    req.on('response', resolve)
    req.on('error', reject)
  })
}

function collect(res: http.IncomingMessage): { chunks: string[]; text: () => string } {
  const chunks: string[] = []
  res.on('data', (c: Buffer) => chunks.push(c.toString()))
  return { chunks, text: () => chunks.join('') }
}

function tick(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('broadcast / attachClient (P7) — real http.ServerResponse', () => {
  let server: http.Server
  let baseUrl: string
  let serverResponses: http.ServerResponse[]

  beforeEach(async () => {
    clients.clear()
    serverResponses = []
    server = http.createServer((_req, res) => {
      serverResponses.push(res)
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('\n')
      attachClient(res) // the exact production wiring under test — not reimplemented here
      res.on('close', () => clients.delete(res)) // mirrors the /api/events handler's own close cleanup
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const { port } = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterEach(async () => {
    clients.clear()
    for (const res of serverResponses) {
      if (!res.writableEnded) res.end()
    }
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('delivers a broadcast to every live (real, connected) client', async () => {
    const reqA = http.get(baseUrl)
    const reqB = http.get(baseUrl)
    const dataA = collect(await waitForResponse(reqA))
    const dataB = collect(await waitForResponse(reqB))
    expect(clients.size).toBe(2)

    broadcast({ type: 'heartbeat', timestamp: 'now' } as LiveEvent)
    await tick()

    expect(dataA.text()).toContain('"type":"heartbeat"')
    expect(dataB.text()).toContain('"type":"heartbeat"')

    reqA.destroy()
    reqB.destroy()
  })

  it('a client whose response has already ended is skipped (no write attempted) and pruned synchronously within broadcast(), without blocking delivery to the other client', async () => {
    const reqA = http.get(baseUrl)
    const reqB = http.get(baseUrl)
    const dataA = collect(await waitForResponse(reqA))
    await waitForResponse(reqB)
    expect(serverResponses).toHaveLength(2)
    const [, resB] = serverResponses
    expect(clients.has(resB)).toBe(true)

    // The real "client already gone away" state broadcast() must detect — end the
    // server-side response directly (the write-after-end scenario verified against
    // real Node in attachClient()'s comment).
    resB.end()
    expect(resB.writableEnded).toBe(true)

    expect(() => broadcast({ type: 'heartbeat', timestamp: 'now' } as LiveEvent)).not.toThrow()

    // Synchronous prune, right after the broadcast() call returns — this is
    // broadcast()'s writableEnded/destroyed pre-check doing the work, not the async
    // 'close' handler (which would also eventually fire, but not synchronously).
    expect(clients.has(resB)).toBe(false)

    await tick()
    expect(dataA.text()).toContain('"type":"heartbeat"')

    reqA.destroy()
    reqB.destroy()
  })

  it('a client whose socket is destroyed mid-connection is eventually pruned via the close handler, and a later broadcast() does not crash', async () => {
    const reqA = http.get(baseUrl)
    const reqB = http.get(baseUrl)
    const dataA = collect(await waitForResponse(reqA))
    await waitForResponse(reqB)
    expect(clients.size).toBe(2)

    reqB.destroy() // abrupt client-side disconnect — the real failure mode, not a mock
    await tick(150)
    expect(clients.size).toBe(1)

    expect(() => broadcast({ type: 'heartbeat', timestamp: 'now' } as LiveEvent)).not.toThrow()
    await tick()
    expect(dataA.text()).toContain('"type":"heartbeat"')

    reqA.destroy()
  })

  it('attachClient() prevents an unhandled "error" event on the response from crashing the process, and prunes the client', async () => {
    const reqA = http.get(baseUrl)
    await waitForResponse(reqA)
    expect(serverResponses).toHaveLength(1)
    const [res] = serverResponses
    expect(clients.has(res)).toBe(true)

    // Node's EventEmitter throws synchronously when 'error' is emitted with no
    // listener attached — this is the actual crash mechanism attachClient() guards
    // against per the http.OutgoingMessage/Writable API contract, regardless of what
    // in production would trigger 'error' on a real response (this repro could not
    // reliably reproduce that trigger on Node v26.8.1 itself — see attachClient()'s
    // comment). Emitting it directly here exercises the real response object's real
    // EventEmitter machinery with a synthetic trigger, which is a standard way to
    // test that an 'error' listener is actually wired up.
    expect(() => res.emit('error', new Error('simulated'))).not.toThrow()
    expect(clients.has(res)).toBe(false)

    reqA.destroy()
  })
})
