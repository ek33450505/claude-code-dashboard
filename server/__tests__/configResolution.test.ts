/**
 * Config resolution — server/constants.ts
 *
 * Covers two real (not cosmetic) defects fixed together:
 *
 * Fix 1: CAST_REPO_PATH and CAST_REPO_DIR were duplicate variables with the
 * same default (constants.ts derived CAST_REPO_DIR, server/routes/control.ts
 * separately derived a private CAST_REPO_PATH used for `git revert`). An
 * operator who set only one env var got a half-configured system. Now
 * CAST_REPO_DIR is resolved once in constants.ts, with CAST_REPO_PATH kept
 * as a deprecated fallback alias.
 *
 * Fix 2: CAST_DB_PATH was documented/used elsewhere in the CAST ecosystem
 * (scripts/make-banner.py, the Python os.environ.get('CAST_DB_PATH', ...)
 * convention) but silently ignored by the dashboard server, which hardcoded
 * CAST_DB. Now CAST_DB honors CAST_DB_PATH when set.
 *
 * Each constant is read once at module-load time, so every case below needs
 * a fresh module graph via vi.resetModules() + re-import — mirrors the
 * pattern in corsOrigin.test.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'

const ENV_KEYS = ['CAST_DB_PATH', 'CAST_REPO_DIR', 'CAST_REPO_PATH', 'CAST_BIN'] as const

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
  vi.resetModules()
})

describe('CAST_DB — honors CAST_DB_PATH (Fix 2)', () => {
  it('defaults to <home>/.claude/cast.db when CAST_DB_PATH is unset', async () => {
    delete process.env.CAST_DB_PATH
    vi.resetModules()
    const { CAST_DB } = await import('../constants.js')

    expect(CAST_DB).toBe(path.join(os.homedir(), '.claude', 'cast.db'))
  })

  it('honors CAST_DB_PATH when set', async () => {
    process.env.CAST_DB_PATH = '/tmp/custom-cast.db'
    vi.resetModules()
    const { CAST_DB } = await import('../constants.js')

    expect(CAST_DB).toBe('/tmp/custom-cast.db')
  })
})

describe('CAST_REPO_DIR — resolves canonically, with CAST_REPO_PATH as a deprecated fallback (Fix 1)', () => {
  it('defaults correctly when neither var is set', async () => {
    delete process.env.CAST_REPO_DIR
    delete process.env.CAST_REPO_PATH
    vi.resetModules()
    const { CAST_REPO_DIR } = await import('../constants.js')

    expect(CAST_REPO_DIR).toBe(path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team'))
  })

  it('honors CAST_REPO_DIR when set', async () => {
    process.env.CAST_REPO_DIR = '/tmp/canonical-repo'
    vi.resetModules()
    const { CAST_REPO_DIR } = await import('../constants.js')

    expect(CAST_REPO_DIR).toBe('/tmp/canonical-repo')
  })

  it('falls back to the deprecated CAST_REPO_PATH alias when only that is set', async () => {
    delete process.env.CAST_REPO_DIR
    process.env.CAST_REPO_PATH = '/tmp/legacy-repo'
    vi.resetModules()
    const { CAST_REPO_DIR } = await import('../constants.js')

    expect(CAST_REPO_DIR).toBe('/tmp/legacy-repo')
  })

  it('prefers CAST_REPO_DIR when both are set (precedence is explicit, not accidental)', async () => {
    process.env.CAST_REPO_DIR = '/tmp/canonical-repo'
    process.env.CAST_REPO_PATH = '/tmp/legacy-repo'
    vi.resetModules()
    const { CAST_REPO_DIR } = await import('../constants.js')

    expect(CAST_REPO_DIR).toBe('/tmp/canonical-repo')
  })

  it('CAST_BIN follows the resolved CAST_REPO_DIR, so the legacy alias alone still points the cast binary at the right checkout', async () => {
    delete process.env.CAST_REPO_DIR
    delete process.env.CAST_BIN
    process.env.CAST_REPO_PATH = '/tmp/legacy-repo'
    vi.resetModules()
    const { CAST_BIN } = await import('../constants.js')

    expect(CAST_BIN).toBe(path.join('/tmp/legacy-repo', 'bin', 'cast'))
  })
})
