import { useEffect, useRef } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { getNodeRadius, getNodeColor, getGlowIntensity } from './constellationLayout'
import type { SimNode } from './useForceSimulation'

interface AgentNodeProps {
  node: SimNode
  recentlyFired: boolean
  onDrag?: (id: string, x: number, y: number) => void
  onDragEnd?: (id: string) => void
}

export function AgentNode({ node, recentlyFired, onDrag, onDragEnd }: AgentNodeProps) {
  const radius = getNodeRadius(node)
  const color = getNodeColor(node.model)
  const glow = getGlowIntensity(node.status, color)
  const isDormant = node.status === 'dormant'
  const isActive = node.status === 'active'

  const controls = useAnimation()
  const gRef = useRef<SVGGElement>(null)
  const dragState = useRef<{ dragging: boolean; svgStartX: number; svgStartY: number } | null>(null)

  // Pulse on recently fired
  useEffect(() => {
    if (recentlyFired) {
      controls.start({
        scale: [1, 1.3, 1],
        transition: { duration: 0.6, ease: 'easeOut' },
      })
    }
  }, [recentlyFired, controls])

  // Pointer-based drag — avoids d3-drag generic type complexity
  useEffect(() => {
    const el = gRef.current
    if (!el) return

    function getSvgPoint(e: PointerEvent): { x: number; y: number } | null {
      const svg = el!.closest('svg') as SVGSVGElement | null
      if (!svg) return null
      // Account for the zoom transform on the container <g>
      const zoomG = el!.closest('g[transform]') as SVGGElement | null
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      // Get the combined CTM of the zoom group to invert it
      const ctm = zoomG ? zoomG.getCTM() : svg.getScreenCTM()
      if (!ctm) return null
      const inversed = ctm.inverse()
      const transformed = pt.matrixTransform(inversed)
      return { x: transformed.x, y: transformed.y }
    }

    function handlePointerDown(e: PointerEvent) {
      e.stopPropagation()
      el!.setPointerCapture(e.pointerId)
      const pt = getSvgPoint(e)
      if (!pt) return
      dragState.current = { dragging: true, svgStartX: pt.x, svgStartY: pt.y }
      node.fx = node.x
      node.fy = node.y
    }

    function handlePointerMove(e: PointerEvent) {
      if (!dragState.current?.dragging) return
      const pt = getSvgPoint(e)
      if (!pt) return
      node.fx = pt.x
      node.fy = pt.y
      onDrag?.(node.id, pt.x, pt.y)
    }

    function handlePointerUp() {
      if (!dragState.current?.dragging) return
      dragState.current = null
      node.fx = null
      node.fy = null
      onDragEnd?.(node.id)
    }

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerUp)

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerup', handlePointerUp)
      el.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [node, onDrag, onDragEnd])

  const labelFontSize = Math.max(9, Math.min(12, radius * 0.35))

  return (
    <g ref={gRef} transform={`translate(${node.x},${node.y})`} style={{ cursor: 'grab' }}>
      {/* Active glow ring */}
      {isActive && (
        <motion.circle
          r={radius + 8}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.3}
          animate={{ r: [radius + 6, radius + 14, radius + 6], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Main circle */}
      <motion.circle
        r={radius}
        fill={color}
        fillOpacity={isDormant ? 0.15 : isActive ? 0.9 : 0.6}
        stroke={color}
        strokeWidth={isDormant ? 1 : 2}
        strokeOpacity={isDormant ? 0.3 : 0.8}
        style={{ filter: glow !== 'none' ? glow : undefined }}
        animate={controls}
        whileHover={{ scale: 1.15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      />

      {/* Agent name label */}
      <text
        y={radius + labelFontSize + 4}
        textAnchor="middle"
        fill="white"
        fontSize={labelFontSize}
        fontFamily="inherit"
        opacity={isDormant ? 0.35 : 0.85}
        style={{ textShadow: '0 1px 4px #000', pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.name}
      </text>
    </g>
  )
}
