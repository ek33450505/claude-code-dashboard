import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// getCastDb would otherwise open the real ~/.claude/cast.db — mock it out so this
// test never touches a live DB.
vi.mock('../routes/castDb.js', () => ({ getCastDb: () => null }))

const { systemIntegrityRouter } = await import('../routes/systemIntegrity.js')

function makeApp() {
  const app = express()
  app.use('/api/system/integrity', systemIntegrityRouter)
  return app
}

const BACKUPS_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'cast', 'db-backups')

// S6: snapshots.dir is an absolute server path (leaks username + directory
// layout). The route reads/stats the directory via the absolute path
// internally, then must hand back a ~-prefixed value.
describe('GET /api/system/integrity — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ~-prefixed snapshots.dir with no /Users/ (or real home dir) leak', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === BACKUPS_DIR)
    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue(['2026-08-01.db'] as unknown as fs.Dirent[])
    const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: Date.now() } as fs.Stats)

    const res = await request(makeApp()).get('/api/system/integrity')

    expect(res.status).toBe(200)
    expect(res.body.snapshots.dir).toBe(
      path.join('~', 'Library', 'Application Support', 'cast', 'db-backups')
    )
    expect(res.body.snapshots.dir).not.toContain(os.homedir())
    expect(res.body.snapshots.count).toBe(1)
    // The internal directory read/stat must still have used the real absolute path.
    expect(readdirSpy).toHaveBeenCalledWith(BACKUPS_DIR)
    expect(statSpy).toHaveBeenCalledWith(path.join(BACKUPS_DIR, '2026-08-01.db'))

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `dir: relativizeHome(backupsDir)!` in systemIntegrity.ts back to `dir: backupsDir`
    // (both occurrences). With that corruption, res.body.snapshots.dir comes back as
    // the raw absolute BACKUPS_DIR (containing the real home directory) and the
    // `not.toContain` assertion above fails.
  })

  it('returns a ~-prefixed default dir even when the backups directory does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const res = await request(makeApp()).get('/api/system/integrity')

    expect(res.status).toBe(200)
    expect(res.body.snapshots.dir).toBe(
      path.join('~', 'Library', 'Application Support', 'cast', 'db-backups')
    )
    expect(res.body.snapshots.count).toBe(0)
  })
})
