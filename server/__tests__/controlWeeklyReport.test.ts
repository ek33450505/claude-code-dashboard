/**
 * S6 follow-up — POST /api/control/weekly-report echoes the weekly-report
 * script's stdout verbatim as `reportPath`. Unlike the rest of this sweep's
 * findings, this route sits behind controlGate (requires
 * CAST_DASHBOARD_CONTROL=1 + a valid DASHBOARD_TOKEN) — fixed anyway for
 * consistency. relativizeHome() is a no-op if stdout isn't actually a path, so
 * this is safe regardless of what the script prints.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import { execFile } from 'child_process'
import os from 'os'
import path from 'path'

vi.mock('child_process')

const { controlRouter } = await import('../routes/control.js')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/control', controlRouter)
  return app
}

describe('POST /api/control/weekly-report — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ~-prefixed reportPath with no real home dir leak', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const reportPath = path.join(os.homedir(), '.claude', 'reports', 'weekly-2026-08-01.md')
    vi.mocked(execFile).mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
      cb(null, reportPath + '\n', '')
      return {} as ReturnType<typeof execFile>
    }) as unknown as typeof execFile)

    const res = await request(makeApp()).post('/api/control/weekly-report')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.reportPath).toBe(path.join('~', '.claude', 'reports', 'weekly-2026-08-01.md'))
    expect(res.body.reportPath).not.toContain(os.homedir())

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `reportPath: relativizeHome(stdout.trim())` in control.ts back to
    // `reportPath: stdout.trim()`. With that corruption, res.body.reportPath
    // comes back as the raw absolute reportPath and both assertions above fail.
  })
})
