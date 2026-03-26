import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'http'
import { getSession } from './ptyManager.js'

export function attachTerminalWS(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/api/terminal' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract session ID from URL: /api/terminal/<id>
    const match = req.url?.match(/\/api\/terminal\/([^/?]+)/)
    const sessionId = match?.[1]
    if (!sessionId) {
      ws.close(1008, 'Missing session ID')
      return
    }

    const session = getSession(sessionId)
    if (!session) {
      ws.close(1008, 'Session not found')
      return
    }

    // PTY → WS: forward output as text
    const dataHandler = session.pty.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // WS → PTY: handle keyboard input and resize messages
    ws.on('message', (msg: Buffer) => {
      try {
        const text = msg.toString()
        // Resize message format: JSON with { type: 'resize', cols, rows }
        if (text.startsWith('{')) {
          const parsed = JSON.parse(text) as { type: string; cols?: number; rows?: number }
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            session.pty.resize(parsed.cols, parsed.rows)
            return
          }
        }
      } catch {
        // Not JSON — treat as raw keystroke passthrough
      }
      session.pty.write(msg.toString())
    })

    ws.on('close', () => {
      dataHandler.dispose()
    })

    ws.on('error', (err) => {
      console.error(`[terminal ws] session ${sessionId}:`, err.message)
      dataHandler.dispose()
    })
  })
}
