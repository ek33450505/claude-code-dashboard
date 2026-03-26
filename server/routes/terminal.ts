import { Router } from 'express'
import { createSession, listSessions, killSession } from '../terminal/ptyManager.js'

export const terminalRouter = Router()

// POST /api/terminal/sessions — create a new PTY session
terminalRouter.post('/sessions', (req, res) => {
  const cwd = (req.body?.cwd as string | undefined) || process.env.HOME || '/'
  const session = createSession(cwd)
  res.status(201).json({ id: session.id, cwd: session.cwd, createdAt: session.createdAt })
})

// GET /api/terminal/sessions — list active sessions
terminalRouter.get('/sessions', (_req, res) => {
  res.json(listSessions())
})

// DELETE /api/terminal/sessions/:id — kill a session
terminalRouter.delete('/sessions/:id', (req, res) => {
  const killed = killSession(req.params.id)
  if (!killed) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json({ ok: true })
})
