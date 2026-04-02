import express from 'express'
import fs from 'fs'
import rateLimit from 'express-rate-limit'
import { PORT, DASHBOARD_COMMANDS_DIR } from './constants.js'
import { router } from './routes/index.js'
import { attachSSE } from './watchers/sse.js'

// Ensure dashboard commands directory exists before watchers start
fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })

const app = express()
app.use(express.json())

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
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

app.use('/api/seed', controlLimiter)
app.use('/api/control', destructiveLimiter)

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

  // Non-blocking auto-seed on startup: backfill tokens without user action.
  // Fire-and-forget — never delays the process start.
  setImmediate(() => {
    fetch(`http://localhost:${PORT}/api/cast/seed`, { method: 'POST' })
      .then(r => r.json())
      .then(body => console.log('[auto-seed]', JSON.stringify(body)))
      .catch(err => console.error('[auto-seed] failed:', err))
  })
})
