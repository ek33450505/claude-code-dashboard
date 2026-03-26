import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  sessionId: string
  isActive: boolean
}

export default function TerminalPanel({ sessionId, isActive }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background: 'var(--bg-primary, #070A0F)',
        foreground: 'var(--text-primary, #E2E8F0)',
        cursor: 'var(--accent, #00FFC2)',
        selectionBackground: 'rgba(0, 255, 194, 0.2)',
      },
      fontFamily: 'GeistMono, "Geist Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
    })
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    const ws = new WebSocket(`ws://localhost:3001/api/terminal/${sessionId}`)

    ws.onopen = () => {
      // Send initial size after connection
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = (event) => {
      term.write(event.data as string)
    }

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[Connection error — terminal disconnected]\x1b[0m\r\n')
    }

    ws.onclose = () => {
      term.write('\r\n\x1b[33m[Session closed]\x1b[0m\r\n')
    }

    // Keystroke passthrough
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // ResizeObserver: refit terminal and send resize to PTY
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
      term.dispose()
      ws.close()
    }
  }, [sessionId])

  return (
    <div
      className="h-full w-full"
      style={{ display: isActive ? 'block' : 'none' }}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ padding: '8px' }}
      />
    </div>
  )
}
