import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_ROOT = join(__dirname, '..')

/**
 * D3 guard: `getSessionCostMap` (JSONL-priced) must never be imported by a route
 * that also sums `agent_runs.cost_usd` into the same response field — that mixing
 * is what made `totalCost` mean two different things per row (agentRuns.ts:304,
 * removed in D3 along with the dead `sessionAgentsRouter.get('/', ...)` handler
 * that was its only consumer).
 *
 * PROXY DISCLOSURE: this is not a full structural check for "same response field."
 * It only asserts `getSessionCostMap` has zero remaining importers under server/ —
 * i.e. the mixing surface was deleted outright rather than merely not-currently-
 * mixed. It does NOT generically detect a *future* route that reintroduces mixing
 * via a *different* JSONL helper (e.g. `getJsonlTokenTotals`) combined with a
 * `cost_usd` sum in one field. That would require a broader AST-level check this
 * test does not attempt.
 */
function collectTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full))
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('D3 cost-source guard', () => {
  it('getSessionCostMap has no importers under server/ (dead code deleted, not just unused)', () => {
    const files = collectTsFiles(SERVER_ROOT)
    const importers = files.filter(f => {
      const content = readFileSync(f, 'utf-8')
      return /getSessionCostMap/.test(content)
    })
    expect(importers).toEqual([])
  })

  it('getSessionCostMap is no longer exported from jsonlTokenTotals.ts', () => {
    const content = readFileSync(join(SERVER_ROOT, 'utils', 'jsonlTokenTotals.ts'), 'utf-8')
    expect(content).not.toMatch(/export function getSessionCostMap/)
  })
})
