import { useEffect, useRef, useState } from 'react'

export interface HookEvent {
  id: string
  timestamp: string
  hook_type: string
  tool_name: string | null
  result: string | null
  duration_ms: number | null
  payload: Record<string, unknown>
}

/**
 * useHookEventsStream — SSE connection to /api/hook-events/stream.
 * Returns the live ring of received events (newest first, capped at maxEvents).
 */
export function useHookEventsStream(maxEvents = 50) {
  const [events, setEvents] = useState<HookEvent[]>([])
  const [connected, setConnected] = useState(false)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let es: EventSource
    let cancelled = false

    function connect() {
      if (cancelled) return
      es = new EventSource('/api/hook-events/stream')

      es.onopen = () => {
        if (!cancelled) setConnected(true)
      }

      es.onerror = () => {
        if (cancelled) return
        setConnected(false)
        es.close()
        if (retryTimer.current) clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null
          connect()
        }, 3000)
      }

      es.onmessage = (e) => {
        if (cancelled) return
        try {
          const event: HookEvent = JSON.parse(e.data)
          setEvents(prev => [event, ...prev].slice(0, maxEvents))
        } catch {
          // skip malformed SSE data
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer.current) {
        clearTimeout(retryTimer.current)
        retryTimer.current = null
      }
      es?.close()
      setConnected(false)
    }
  }, [maxEvents])

  return { events, connected }
}
