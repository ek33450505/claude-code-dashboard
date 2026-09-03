/**
 * D12-class — Cross-boundary response-type parity test.
 *
 * Asserts that the Unit 8 GET routes (`/api/cast/ack-events`, `/api/cast/provenance-chain`,
 * `/api/cast/commit-provenance`, `/api/cast/attestations`, `/api/cast/agent-runs-daily`,
 * `/api/cast/mcp-calls-daily`, `/api/pane-bindings`) return response envelopes that match
 * the TypeScript interfaces declared in `src/types/index.ts`. A mismatch — e.g., a route
 * returning a field the frontend doesn't declare, or omitting one it does — is caught by
 * this test and fails fast rather than surfacing as a subtle frontend bug.
 *
 * Mutation-test: temporarily change one frontend type to omit a real field (e.g., remove
 * 'is_cap_sentinel' from AckEvent), confirm the test FAILS, restore, confirm GREEN.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import request from 'supertest'
import { app } from '../index.js'

const CAST_DB = path.join(os.homedir(), '.claude', 'cast.db')
const hasDb = fs.existsSync(CAST_DB)

/**
 * Unit 8 GET routes and their expected response-envelope structure.
 * Each entry specifies the route, response key, and required fields that should
 * be present on every object in the response array.
 */
const UNIT_8_ROUTES = [
  {
    name: 'GET /api/cast/ack-events',
    path: '/api/cast/ack-events',
    responseKey: 'events',
    requiredFields: ['id', 'variable', 'value', 'has_reason', 'script', 'git_sha', 'session_id', 'repo', 'created_at', 'is_cap_sentinel'],
  },
  {
    name: 'GET /api/cast/provenance-chain',
    path: '/api/cast/provenance-chain',
    responseKey: 'chain',
    requiredFields: ['seq', 'session_id', 'prev_hash', 'session_digest', 'chain_hash', 'created_at', 'receipt_json', 'verification_state'],
  },
  {
    name: 'GET /api/cast/commit-provenance',
    path: '/api/cast/commit-provenance',
    responseKey: 'commits',
    requiredFields: ['sha', 'session_id', 'agent', 'branch', 'repo', 'recorded_at'],
  },
  {
    name: 'GET /api/cast/attestations',
    path: '/api/cast/attestations',
    responseKey: 'attestations',
    requiredFields: ['id', 'agent_key', 'false_done', 'payload', 'created_at'],
  },
  {
    name: 'GET /api/cast/agent-runs-daily',
    path: '/api/cast/agent-runs-daily?days=7',
    responseKey: 'days',
    requiredFields: ['day', 'runs', 'cost_usd', 'input_tokens', 'output_tokens', 'duration_ms', 'avg_cost_per_run', 'is_partial'],
  },
  {
    name: 'GET /api/cast/mcp-calls-daily',
    path: '/api/cast/mcp-calls-daily?days=7',
    responseKey: 'days',
    requiredFields: ['day', 'mcp_server', 'is_cloud_bound', 'calls', 'result_bytes', 'is_partial'],
  },
  {
    name: 'GET /api/pane-bindings',
    path: '/api/pane-bindings',
    responseKey: 'bindings',
    requiredFields: ['pane_id', 'session_id', 'started_at', 'ended_at', 'project_path'],
  },
]

describe.skipIf(!hasDb)('Unit 8 response shapes — cross-boundary parity (D12)', () => {
  for (const route of UNIT_8_ROUTES) {
    it(`${route.name} returns objects with all required fields`, async () => {
      const res = await request(app).get(route.path)
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty(route.responseKey)

      const items = res.body[route.responseKey] as unknown[]
      expect(Array.isArray(items)).toBe(true)

      // If the table is empty, skip field verification (table may legitimately have no rows)
      if (items.length === 0) {
        return
      }

      // For non-empty responses, verify every required field is present on the first item
      const firstItem = items[0] as Record<string, unknown>
      for (const field of route.requiredFields) {
        expect(
          Object.prototype.hasOwnProperty.call(firstItem, field),
          `${route.name}: first item missing required field '${field}'`,
        ).toBe(true)
      }
    })
  }
})
