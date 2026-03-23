import { useEffect, useRef, useState } from 'react'
import type { LiveEvent } from '../types'

export function useLiveEvents(onEvent?: (e: LiveEvent) => void) {
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)

  // Keep ref current without triggering reconnect
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      const event: LiveEvent = JSON.parse(e.data)
      onEventRef.current?.(event)
    }
    return () => { es.close(); setConnected(false) }
  }, []) // connect once — callback stays current via ref

  return { connected }
}
