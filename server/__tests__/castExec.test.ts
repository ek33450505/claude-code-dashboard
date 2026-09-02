import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { EventEmitter } from 'events'
import { spawn } from 'child_process'

// C2: the /exec endpoint spawns a detached `cast exec` process. Auto-mock
// child_process so NO real process is ever launched; fs is spied per-test so NO
// real filesystem is touched. `spawn` here is the same mocked binding the route uses.
vi.mock('child_process')

import { castExecRouter } from '../routes/castExec.js'

const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/cast', castExecRouter)
  return app
}

describe('POST /api/cast/exec', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReturnValue({ unref: () => {}, on: () => {} } as unknown as ReturnType<typeof spawn>)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 when planFile is missing and does not spawn', async () => {
    const res = await request(makeApp()).post('/api/cast/exec').send({})
    expect(res.status).toBe(400)
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()
  })

  it('returns 404 when the plan file does not exist and does not spawn', async () => {
    // statSync throws ENOENT for a missing path — this is the real signal the
    // route now checks (see the isFile()-check tests below for why existsSync
    // alone is no longer sufficient).
    vi.spyOn(fs, 'statSync').mockImplementation(() => {
      throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
    })
    const res = await request(makeApp()).post('/api/cast/exec').send({ planFile: 'real-plan.md' })
    expect(res.status).toBe(404)
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()
  })

  it('confines the spawned path to PLANS_DIR for a traversal planFile', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true) // CAST_BIN check
    vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true } as fs.Stats)
    const res = await request(makeApp())
      .post('/api/cast/exec')
      .send({ planFile: '../../etc/passwd' })
    expect(res.status).toBe(200)
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(spawn).mock.calls[0][1]
    // basename('../../etc/passwd') === 'passwd' → confined under PLANS_DIR, never /etc/passwd
    expect(args).toEqual(['exec', path.join(PLANS_DIR, 'passwd')])
  })

  // C9: path.basename('..') returns '..' unchanged (no separator to strip), so
  // basename() alone did not fully constrain this input — path.join(PLANS_DIR, '..')
  // resolves to PLANS_DIR's parent, which exists, and would have been passed to
  // `cast exec` as the resolved arg. safeResolve() closes this by rejecting any
  // basename that still escapes PLANS_DIR after flattening.
  it('rejects a planFile that basename() alone cannot flatten (".. escapes PLANS_DIR)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const res = await request(makeApp())
      .post('/api/cast/exec')
      .send({ planFile: '..' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid planFile')
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `const resolvedPath = safeResolve(PLANS_DIR, basename)` back to
    // `const resolvedPath = path.join(PLANS_DIR, basename)` (dropping the
    // safeResolve null-check). With that reversion this test fails with
    // `expected 404 to be 400` — NOT 200. The two guards are stacked: without
    // safeResolve, `..` resolves to PLANS_DIR's parent, which the isFile check
    // below then rejects as a directory, so the request 404s rather than
    // reaching spawn(). It still fails, and still fails for the right reason
    // (the escape is no longer classified as an invalid path), but the
    // safeResolve guard is what distinguishes 400 from 404 here — it is not
    // the only thing standing between this input and spawn().
    //
    // Deleting BOTH guards is what yields 200 with spawn() called on
    // PLANS_DIR's parent. An earlier version of this comment claimed the
    // single-guard reversion produced 200; that was wrong, and worth stating
    // precisely, because a mutation comment that overstates what one assertion
    // proves is exactly how a guard gets deleted later as "redundant".
  })

  // C9 follow-up: basename('.') === '.', and safeResolve's equal-to-base branch
  // ALLOWS a resolved path that equals PLANS_DIR itself (that's the correct
  // behavior for callers that legitimately want the directory — it just isn't
  // legitimate for THIS route, which always wants a single file). Before the
  // isFile() check, this resolved to PLANS_DIR, existsSync(PLANS_DIR) was true
  // (it's a real directory), and the route would have spawned `cast exec
  // <PLANS_DIR>` — passing a directory where a plan file is expected.
  it('rejects a planFile that resolves to PLANS_DIR itself (a directory, not a file)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => false } as fs.Stats)
    const res = await request(makeApp())
      .post('/api/cast/exec')
      .send({ planFile: '.' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Plan file not found')
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()

    // MUTATION TEST (manually verified, not left in the tree): revert the
    // `if (!stat || !stat.isFile())` check in castExec.ts back to the bare
    // `if (!fs.existsSync(resolvedPath))`. With that reversion, existsSync is
    // mocked true above, so the route proceeds past the guard and calls
    // spawn() with PLANS_DIR itself, returning 200 instead of 404.
  })

  // Same isFile() guard, exercised against a subdirectory that stays fully
  // contained under PLANS_DIR (so safeResolve's containment check alone would
  // never catch it) — confirms the fix isn't specific to the '.' input shape.
  it('rejects a planFile that resolves to a subdirectory of PLANS_DIR', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => false } as fs.Stats)
    const res = await request(makeApp())
      .post('/api/cast/exec')
      .send({ planFile: 'some-subdir' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Plan file not found')
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()
  })
})

// S5: spawn() reports ENOENT asynchronously via an 'error' event on the ChildProcess,
// not as a synchronous throw. Before the fix, a missing/moved CAST_BIN meant the
// try/catch around spawn() never fired, the event had no listener, and Node's default
// behavior for an unhandled 'error' event on an EventEmitter is to throw — crashing
// the whole dashboard process, after the handler had already replied 200. These two
// tests cover (a) the primary existsSync guard and (b) the 'error'-listener backstop.
describe('POST /api/cast/exec — S5 spawn safety', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 500 without spawning when CAST_BIN does not exist on disk', async () => {
    // The plan file itself must pass the isFile() check (statSync); CAST_BIN's
    // existence is checked separately via existsSync — false here simulates a
    // missing/moved binary without depending on real fs state or re-importing
    // the module (which would risk a second, distinct automock instance of
    // `spawn` that `vi.mocked(spawn)` below couldn't see).
    vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true } as fs.Stats)
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const res = await request(makeApp()).post('/api/cast/exec').send({ planFile: 'real-plan.md' })
    expect(res.status).toBe(500)
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()

    // MUTATION TEST (manually verified, not left in the tree): remove the
    // `if (!fs.existsSync(CAST_BIN))` guard from castExec.ts. With the guard gone,
    // this test fails: spawn() (the mock) IS called and the route returns 200
    // ({ plan_id: 'real-plan' }) instead of 500 — the mocked spawn never throws, so
    // nothing catches the missing binary until a real 'error' event would have fired.
  })

  it('handles an async spawn error event without an unhandled throw, replying 500 if not yet sent', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true } as fs.Stats)
    const fakeChild = new EventEmitter() as EventEmitter & { unref: () => void }
    fakeChild.unref = () => {}
    vi.mocked(spawn).mockReturnValue(fakeChild as unknown as ReturnType<typeof spawn>)

    const res = await request(makeApp()).post('/api/cast/exec').send({ planFile: 'real-plan.md' })
    expect(res.status).toBe(200)
    expect(res.body.plan_id).toBe('real-plan')

    // Simulate the real-world race: ENOENT arrives asynchronously, after the
    // handler already replied. EventEmitter's default behavior for an 'error'
    // event with NO listener is to throw synchronously on emit() — so if the
    // route failed to attach `child.on('error', ...)`, this line alone would
    // throw and fail the test. The res.headersSent guard is what keeps the
    // late event from also attempting (and crashing on) a second res.json() call.
    expect(() => fakeChild.emit('error', new Error('spawn ENOENT'))).not.toThrow()

    // MUTATION TEST (manually verified, not left in the tree): delete the
    // `child.on('error', ...)` block from castExec.ts entirely. With no listener
    // attached, the `fakeChild.emit('error', ...)` line above throws synchronously
    // inside the test (Node's default unhandled-'error'-event behavior), failing
    // this test with an uncaught exception instead of a clean assertion failure —
    // exactly mirroring the real crash this fix prevents.
  })
})

describe('GET /api/cast/exec/:plan_id/status', () => {
  it('returns 400 for an invalid plan_id', async () => {
    // 'bad$id' contains '$', which fails /^[\w.\-]+$/
    const res = await request(makeApp()).get('/api/cast/exec/bad%24id/status')
    expect(res.status).toBe(400)
  })
})

// S6: /plans returns each plan file's absolute path (leaks username + directory
// layout). The route reads/stats the file via the absolute path internally, then
// must hand back a ~-prefixed value.
describe('GET /api/cast/plans — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ~-prefixed path with no /Users/ (or real home dir) leak', async () => {
    const planFile = path.join(PLANS_DIR, 'my-plan.md')
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['my-plan.md'] as unknown as fs.Dirent[])
    vi.spyOn(fs, 'statSync').mockReturnValue({ mtime: new Date() } as fs.Stats)
    vi.spyOn(fs, 'readFileSync').mockReturnValue('# a plan\nno manifest here')

    const res = await request(makeApp()).get('/api/cast/plans')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].path).toBe(path.join('~', path.relative(os.homedir(), planFile)))
    expect(res.body[0].path).not.toContain(os.homedir())
    // The internal read/stat must still have used the real absolute path.
    expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(planFile, 'utf-8')
    expect(vi.mocked(fs.statSync)).toHaveBeenCalledWith(planFile)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(filePath)` in castExec.ts back to `path: filePath`.
    // With that corruption, res.body[0].path comes back as the raw absolute
    // planFile (containing the real home directory) and the `not.toContain`
    // assertion above fails.
  })
})
