/**
 * S3 — default-deny coverage for non-GET requests.
 *
 * Two complementary checks:
 *   1. Enumerated coverage (drift detection, NOT the runtime guarantee) —
 *      statically parses source text for two shapes and asserts each found
 *      path is covered by a GATED_PREFIXES entry:
 *        (i)  every POST/PUT/DELETE/PATCH handler reachable from
 *             routes/index.ts's `router.use('<prefix>', <var>)` mount topology
 *             — covers a new router mounted through the normal path but never
 *             added to GATED_PREFIXES;
 *        (ii) every `app.post/put/delete/patch(<literal>)` registered
 *             directly on the Express `app`, anywhere under `server/` (except
 *             `server/__tests__/`) — this is the S1 shape specifically:
 *             `/api/test-broadcast` was registered directly on `app` inside
 *             `attachSSE()`, never routed through routes/index.ts, so (i)
 *             alone could not and did not catch it (verified: reinserting the
 *             original ungated `app.post('/api/test-broadcast', ...)` and
 *             re-running with only (i) implemented passed 27/27 — a false
 *             negative). (ii) closes that hole for the literal-path case.
 *      Being a source-text parser, this has real, permanent blind spots: a
 *      path assembled from a variable/template expression rather than a
 *      string literal, or a router mounted from a file this parser doesn't
 *      walk, is invisible to it. It is drift detection layered on top of the
 *      real guarantee, not a substitute for it.
 *   2. Behavioral (the actual runtime guarantee) — proves defaultDenyGate
 *      itself, not the manifest, rejects a non-GET to an ungated /api/* path,
 *      and that a valid DASHBOARD_TOKEN does not open it. This is what
 *      actually stops a route matching either blind spot above at runtime —
 *      confirmed independently (2026-09-02): corrupting defaultDenyGate's
 *      guard to `if (true)` flips both harness assertions below from 404 to 200.
 *
 * WHY (i) PARSES SOURCE INSTEAD OF WALKING `app.router.stack`:
 * The task spec's original approach was a runtime walk of `router.stack` /
 * `app._router.stack`, reconstructing each layer's full mount path from its
 * regexp. That does not work reliably for a `.use()`-mounted sub-router on
 * this stack: Express 5's router package (router@2.2.0) compiles every
 * `.use()` path into an opaque path-to-regexp `match()` closure and never
 * retains the original path string or a `.regexp` property on the Layer
 * (confirmed empirically — a compiled matcher's own `Object.keys()` is `[]`).
 * `layer.path` is only populated as a *side effect* of calling
 * `layer.match(candidatePath)` against a real request path during dispatch.
 * (Direct `app.<method>(literalPath, ...)` registrations are the one shape
 * where the static string IS retained, on `layer.route.path` — that's exactly
 * what (ii) reads instead of introspecting the layer.) Reading the sub-router
 * mount topology from source instead uses the exact same information (which
 * router is mounted at which prefix, and which methods each router registers)
 * expressed as plain strings — dynamic (re-parsed every run) and guarded
 * against a vacuous parse below.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import request from 'supertest'
import { app } from '../index.js'
import { controlGate, defaultDenyGate, GATED_PREFIXES } from '../middleware/controlGate.js'

const ROUTES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes')
const SERVER_DIR = path.resolve(ROUTES_DIR, '..')

interface MutatingRoute {
  method: string
  path: string
}

/**
 * Parses server/routes/index.ts for `router.use('<suffix>', <varName>)` mounts
 * and their `import { varName } from './<file>.js'` origins, then scans each
 * referenced file for POST/PUT/DELETE/PATCH handler registrations to build the
 * (method, full path) manifest for routes reachable through the normal
 * routes/index.ts mount topology. See shape (i) in the file header comment.
 */
function collectRouterMountRoutes(): MutatingRoute[] {
  const indexSrc = fs.readFileSync(path.join(ROUTES_DIR, 'index.ts'), 'utf-8')

  // varName -> file (module name without extension)
  const fileByVar = new Map<string, string>()
  for (const m of indexSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)\.js'/g)) {
    const names = m[1]!.split(',').map((s) => s.trim()).filter(Boolean)
    for (const name of names) fileByVar.set(name, m[2]!)
  }

  const routes: MutatingRoute[] = []
  for (const m of indexSrc.matchAll(/router\.use\('([^']+)',\s*([A-Za-z0-9_]+)\)/g)) {
    const mountSuffix = m[1]!
    const varName = m[2]!
    const file = fileByVar.get(varName)
    if (!file) continue // every mounted var is imported above; absence means a parse gap, not a real gap
    const src = fs.readFileSync(path.join(ROUTES_DIR, `${file}.ts`), 'utf-8')
    for (const rm of src.matchAll(/\.(post|put|delete|patch)\(\s*(['"`])([^'"`]*)\2/g)) {
      const method = rm[1]!
      const subPath = rm[3]!
      const full = `/api${mountSuffix}${subPath === '/' ? '' : subPath}`.replace(/\/{2,}/g, '/')
      routes.push({ method: method.toUpperCase(), path: full })
    }
  }
  return routes
}

/** Recursively lists every `.ts` file under `dir`, skipping any directory name in `exclude`. */
function walkTsFiles(dir: string, exclude: string[]): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full, exclude))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Scans every `.ts` file under `server/` (excluding `server/__tests__/`) for
 * `app.post/put/delete/patch('<literal path>', ...)` — routes registered
 * directly on the Express `app` rather than through a mounted router. This is
 * the S1 shape (`/api/test-broadcast` lived in `server/watchers/sse.ts`,
 * registered directly on `app` inside `attachSSE()`, never routed through
 * routes/index.ts) — see shape (ii) in the file header comment. Paths found
 * here are already absolute (the literal passed to `app.<method>(...)`); they
 * are NOT prefixed with `/api`, unlike collectRouterMountRoutes's output.
 */
function collectDirectAppRoutes(): MutatingRoute[] {
  const routes: MutatingRoute[] = []
  for (const file of walkTsFiles(SERVER_DIR, ['__tests__'])) {
    const src = fs.readFileSync(file, 'utf-8')
    for (const rm of src.matchAll(/\bapp\.(post|put|delete|patch)\(\s*(['"`])([^'"`]*)\2/g)) {
      const method = rm[1]!
      const literalPath = rm[3]!
      routes.push({ method: method.toUpperCase(), path: literalPath })
    }
  }
  return routes
}

function collectMutatingRoutes(): MutatingRoute[] {
  return [...collectRouterMountRoutes(), ...collectDirectAppRoutes()]
}

/** Mirrors controlGate.ts's own prefix-match rule (exact or `/`-bounded sub-path). */
function isGatedPath(reqPath: string): boolean {
  return GATED_PREFIXES.some((prefix) => reqPath === prefix || reqPath.startsWith(`${prefix}/`))
}

describe('defaultDenyGate — enumerated router-tree coverage', () => {
  const mutators = collectMutatingRoutes()

  it('found a plausible number of mutating routes (guards against a vacuous walk)', () => {
    // 20+ non-GET routes exist across server/routes/*.ts as of this writing
    // (grep -rn "\.post(\|\.put(\|\.delete(" server/routes/*.ts). A near-zero
    // count here means the parser silently broke, not that the app got safer.
    expect(mutators.length).toBeGreaterThan(5)
  })

  it('sanity check: a known-good mount (POST /api/hook-events) is present in the parsed manifest', () => {
    expect(mutators.some((r) => r.method === 'POST' && r.path === '/api/hook-events')).toBe(true)
  })

  for (const { method, path: routePath } of collectMutatingRoutes()) {
    it(`${method} ${routePath} is covered by a GATED_PREFIXES entry`, () => {
      expect(
        isGatedPath(routePath),
        `${method} ${routePath} is NOT covered by any GATED_PREFIXES entry — a new ` +
          'ungated mutator shipped (this is exactly how S1\'s /api/test-broadcast happened)',
      ).toBe(true)
    })
  }
})

describe('defaultDenyGate — behavioral', () => {
  const ORIG_ENV: Record<string, string | undefined> = {}
  const UNGATED_NO_HANDLER_PATH = '/api/analytics/__deny_gate_probe__'
  const TOKEN = 'defaultdeny-unit-test-token'

  beforeAll(() => {
    ORIG_ENV.CAST_DASHBOARD_CONTROL = process.env.CAST_DASHBOARD_CONTROL
    ORIG_ENV.DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN
  })

  afterEach(() => {
    if (ORIG_ENV.CAST_DASHBOARD_CONTROL !== undefined) {
      process.env.CAST_DASHBOARD_CONTROL = ORIG_ENV.CAST_DASHBOARD_CONTROL
    } else {
      delete process.env.CAST_DASHBOARD_CONTROL
    }
    if (ORIG_ENV.DASHBOARD_TOKEN !== undefined) {
      process.env.DASHBOARD_TOKEN = ORIG_ENV.DASHBOARD_TOKEN
    } else {
      delete process.env.DASHBOARD_TOKEN
    }
  })

  // Smoke check against the real, fully-wired app: an ungated path with no
  // registered handler anywhere 404s regardless of defaultDenyGate (the main
  // router's own catch-all would produce the same result on its own) — this
  // documents current behavior but is NOT the regression guard; see the
  // harness test below for that.
  it('POST to an ungated, unregistered /api/* path 404s on the real app', async () => {
    delete process.env.CAST_DASHBOARD_CONTROL
    const res = await request(app).post(UNGATED_NO_HANDLER_PATH).send({})
    expect(res.status).toBe(404)
  })

  // Regression guard: mounts the REAL exported controlGate/defaultDenyGate/
  // GATED_PREFIXES next to a rogue route that mimics S1 — a real, working
  // POST handler mounted under a prefix that is NOT in GATED_PREFIXES. This is
  // the exact shape defaultDenyGate exists to catch: a smoke test against a
  // path with no handler (above) can't distinguish "the gate blocked this"
  // from "nothing was listening anyway," but a rogue route WOULD return 200 if
  // defaultDenyGate failed to block it.
  //
  // Mutation-tested: temporarily changing defaultDenyGate's guard condition to
  // `if (true)` (always allow) flips both assertions below from 404 to 200 —
  // confirmed by running this file with that change applied, then reverted.
  function makeHarnessApp() {
    const harness = express()
    harness.use(express.json())
    for (const prefix of GATED_PREFIXES) harness.use(prefix, controlGate)
    harness.use(defaultDenyGate)
    harness.post('/api/rogue-unguarded', (_req, res) => res.status(200).json({ ok: true, leaked: true }))
    harness.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))
    return harness
  }

  it('blocks a rogue mutating route mounted outside GATED_PREFIXES (control disabled)', async () => {
    delete process.env.CAST_DASHBOARD_CONTROL
    const res = await request(makeHarnessApp()).post('/api/rogue-unguarded').send({})
    expect(res.status).toBe(404)
  })

  it('still blocks the rogue route with control enabled + a valid token (an ungated path is not a gated one)', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN
    const res = await request(makeHarnessApp())
      .post('/api/rogue-unguarded')
      .set('X-Dashboard-Token', TOKEN)
      .send({})
    expect(res.status).toBe(404)
  })
})
