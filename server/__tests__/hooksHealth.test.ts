import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { SETTINGS_GLOBAL_FILE } from '../constants.js'

// getCastDb would otherwise open the real ~/.claude/cast.db — mock it out so this
// test never touches a live DB, matching the fs mocks below.
vi.mock('../routes/castDb.js', () => ({ getCastDb: () => null }))

const { hooksRouter } = await import('../routes/hooks.js')

function makeApp() {
  const app = express()
  app.use('/api/hooks', hooksRouter)
  return app
}

const SCRIPT_PATH = path.join(os.homedir(), '.claude', 'scripts', 'my-hook.sh')

const FAKE_SETTINGS = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: `bash ~/.claude/scripts/my-hook.sh` }],
      },
    ],
  },
}

// S6: script_path is an absolute server path (leaks username + directory layout).
// The route stats the script via the absolute path internally, then must hand
// back a ~-prefixed value.
describe('GET /api/hooks/health — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ~-prefixed script_path with no /Users/ (or real home dir) leak', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === SETTINGS_GLOBAL_FILE)
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (p === SETTINGS_GLOBAL_FILE) return JSON.stringify(FAKE_SETTINGS)
      throw new Error(`unexpected readFileSync(${p})`)
    })
    const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((p) => {
      if (p === SCRIPT_PATH) return { mode: 0o755 } as fs.Stats
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const res = await request(makeApp()).get('/api/hooks/health')

    expect(res.status).toBe(200)
    expect(res.body.hooks).toHaveLength(1)
    expect(res.body.hooks[0].script_path).toBe(path.join('~', '.claude', 'scripts', 'my-hook.sh'))
    expect(res.body.hooks[0].script_path).not.toContain(os.homedir())
    expect(res.body.hooks[0].exists).toBe(true)
    expect(res.body.hooks[0].executable).toBe(true)
    // The internal existence/executability check must still have used the real
    // absolute path — fs does not expand '~'.
    expect(statSpy).toHaveBeenCalledWith(SCRIPT_PATH)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `script_path: relativizeHome(scriptPath) ?? null` in hooks.ts back to
    // `script_path: scriptPath`. With that corruption, res.body.hooks[0].script_path
    // comes back as the raw absolute SCRIPT_PATH (containing the real home
    // directory) and the `not.toContain` assertion above fails.
  })
})
