import express from 'express'
import fs from 'fs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PORT, DASHBOARD_COMMANDS_DIR } from './constants.js'
import { router } from './routes/index.js'
import { controlGate } from './middleware/controlGate.js'
import { attachSSE } from './watchers/sse.js'
import { getCastDb } from './routes/castDb.js'
import { logSchemaDrift } from './utils/schemaGuard.js'

// Ensure dashboard commands directory exists before watchers start
fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })

const app = express()

// Security headers. CSP is intentionally left off: the production build is a
// bundled SPA whose chart/animation libraries set inline styles, and this server
// is intended for localhost. Enable a tuned CSP before exposing beyond localhost.
app.use(helmet({ contentSecurityPolicy: false }))

app.use(express.json({ limit: '256kb' }))

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Dashboard-Token')
  next()
})
app.options(/.*/, (_req, res) => res.sendStatus(204))

const controlLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// Tighter limiter for destructive control endpoints (rollback, dispatch)
const destructiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

app.use('/api/cast/seed', controlLimiter)
app.use('/api/control', destructiveLimiter)
app.use('/api/cast/exec', destructiveLimiter)
app.use('/api/castd', controlLimiter)
app.use('/api/swarm', controlLimiter)
app.use('/api/constellation', controlLimiter)

// Opt-in write gate: reads always pass; writes require CAST_DASHBOARD_CONTROL=1
// plus a matching X-Dashboard-Token. Mounted on every state-changing surface.
app.use('/api/control', controlGate)
app.use('/api/castd', controlGate)
app.use('/api/cast/exec', controlGate)

app.use('/api', router)
attachSSE(app)

// Global error handler — must be last middleware
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  const status = (err as { status?: number }).status ?? 500
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}: ${message}`)
  if (!res.headersSent) {
    res.status(status).json({ error: message })
  }
})

app.listen(PORT, () => {
  console.log(`Claude Dashboard server on :${PORT}`)

  // Warn loudly if cast.db has drifted from the columns the routes expect.
  logSchemaDrift(getCastDb())

  // Non-blocking auto-seed on startup: backfill tokens without user action.
  // Fire-and-forget — never delays the process start.
  setImmediate(() => {
    fetch(`http://localhost:${PORT}/api/cast/seed`, { method: 'POST' })
      .then(r => r.json())
      .then(body => console.log('[auto-seed]', JSON.stringify(body)))
      .catch(err => console.error('[auto-seed] failed:', err))
  })
})
