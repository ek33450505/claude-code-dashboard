import pty from 'node-pty'

export interface PtySession {
  id: string
  pty: pty.IPty
  cwd: string
  createdAt: string
}

const sessions = new Map<string, PtySession>()

export function createSession(cwd: string = process.env.HOME ?? '/'): PtySession {
  const id = crypto.randomUUID()
  const ptyProcess = pty.spawn('claude', ['--dangerously-skip-permissions'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  })

  const session: PtySession = {
    id,
    pty: ptyProcess,
    cwd,
    createdAt: new Date().toISOString(),
  }

  sessions.set(id, session)

  // Clean up when PTY exits
  ptyProcess.onExit(() => {
    sessions.delete(id)
  })

  return session
}

export function getSession(id: string): PtySession | undefined {
  return sessions.get(id)
}

export function listSessions(): Array<Omit<PtySession, 'pty'>> {
  return Array.from(sessions.values()).map(({ id, cwd, createdAt }) => ({
    id,
    cwd,
    createdAt,
  }))
}

export function killSession(id: string): boolean {
  const session = sessions.get(id)
  if (!session) return false
  try {
    session.pty.kill()
  } catch {
    // PTY may already be dead
  }
  sessions.delete(id)
  return true
}
