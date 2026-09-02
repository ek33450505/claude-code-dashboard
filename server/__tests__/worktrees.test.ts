/**
 * S4 + D8 regression tests — GET /api/cast/worktrees.
 *
 * S4: the handler used to shell out synchronously (execSync, 5s timeout) on a public,
 * unauthenticated GET, blocking the event loop for the whole request. D8: it ran with
 * no `cwd`, so it silently returned the DASHBOARD's own worktrees while the UI
 * presented them as CAST agent worktrees. The fix moves to async execFile with
 * `cwd: CAST_REPO_DIR`.
 *
 * child_process is auto-mocked so no real git process is ever spawned. Node's
 * util.promisify(execFile) resolves via execFile's `[util.promisify.custom]` symbol
 * rather than the plain `execFile` export — vi.mock's automock preserves that symbol
 * as its OWN separate mock stub, so it (not the base `execFile` mock) is what must be
 * given an implementation for these tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'

vi.mock('child_process')

import { worktreesRouter } from '../routes/agentRuns.js'
import { CAST_REPO_DIR } from '../constants.js'

const execFileCustom = (execFile as unknown as Record<symbol, unknown>)[
  (promisify as unknown as { custom: symbol }).custom
]

function makeApp() {
  const app = express()
  app.use('/api/cast/worktrees', worktreesRouter)
  return app
}

// S6: rooted under the REAL os.homedir() (not an arbitrary '/Users/ed/...' fixture)
// so relativizeHome()'s `startsWith(home)` check actually engages on this machine —
// an unrelated absolute path would make the relativization a silent no-op and this
// test would pass without exercising the fix at all.
const REPO_PATH = path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team')
const WORKTREE_PATH = path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team-worktrees', 'feature-x')
const SAMPLE_PORCELAIN = [
  `worktree ${REPO_PATH}`,
  'HEAD abc123',
  'branch refs/heads/main',
  '',
  `worktree ${WORKTREE_PATH}`,
  'HEAD def456',
  'branch refs/heads/feature/x',
  '',
].join('\n')

describe('GET /api/cast/worktrees', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs `git worktree list --porcelain` with cwd set to CAST_REPO_DIR, not the dashboard cwd', async () => {
    vi.mocked(execFileCustom).mockResolvedValue({ stdout: SAMPLE_PORCELAIN, stderr: '' })

    const res = await request(makeApp()).get('/api/cast/worktrees')
    expect(res.status).toBe(200)

    expect(vi.mocked(execFileCustom)).toHaveBeenCalledTimes(1)
    const [file, args, options] = vi.mocked(execFileCustom).mock.calls[0] as [string, string[], { cwd?: string }]
    expect(file).toBe('git')
    expect(args).toEqual(['worktree', 'list', '--porcelain'])
    expect(options.cwd).toBe(CAST_REPO_DIR)
    // D8 regression guard: cwd must never silently fall back to the dashboard
    // process's own working directory (which is what shipped before this fix).
    expect(options.cwd).not.toBe(process.cwd())

    // S6: git's absolute paths come back ~-prefixed (S4's public/unauthenticated GET
    // must not hand out the operator's directory layout).
    expect(res.body.worktrees).toEqual([
      { path: path.join('~', 'Projects', 'personal', 'claude-agent-team'), branch: 'main', head: 'abc123' },
      { path: path.join('~', 'Projects', 'personal', 'claude-agent-team-worktrees', 'feature-x'), branch: 'feature/x', head: 'def456' },
    ])
    expect(res.body.worktrees.every((w: { path: string }) => !w.path.includes(os.homedir()))).toBe(true)

    // MUTATION TEST (manually verified, not left in the tree): drop the `cwd:
    // CAST_REPO_DIR` option from the execFileAsync call in agentRuns.ts. With the
    // mutation, `options.cwd` is `undefined`, so `expect(options.cwd).toBe(CAST_REPO_DIR)`
    // fails immediately — this is the exact D8 regression (silently running against
    // the dashboard's own cwd instead of the CAST flagship repo).

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(line.slice(9))!` in agentRuns.ts back to
    // `path: line.slice(9)`. With that corruption, res.body.worktrees[0].path comes
    // back as the raw absolute REPO_PATH (containing the real home directory) and
    // both assertions above fail.
  })

  it('returns an empty list (not a 500) when git fails, preserving prior error behavior', async () => {
    vi.mocked(execFileCustom).mockRejectedValue(new Error('fatal: not a git repository'))

    const res = await request(makeApp()).get('/api/cast/worktrees')
    expect(res.status).toBe(200)
    expect(res.body.worktrees).toEqual([])
  })
})
