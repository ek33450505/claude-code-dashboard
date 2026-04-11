import { getEdgeOpacity, getEdgeStrokeWidth, getNodeColor } from './constellationLayout'
import type { SimEdge } from './useForceSimulation'

interface DispatchEdgeProps {
  edge: SimEdge
}

export function DispatchEdge({ edge }: DispatchEdgeProps) {
  const { source, target, lastDispatchAt, dispatchCount24h } = edge

  if (typeof source === 'string' || typeof target === 'string') return null

  const x1 = source.x ?? 0
  const y1 = source.y ?? 0
  const x2 = target.x ?? 0
  const y2 = target.y ?? 0

  // Quadratic bezier: control point perpendicular to midpoint
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Perpendicular offset — scale with edge length but cap it
  const offset = Math.min(40, len * 0.2)
  const cpx = mx - (dy / len) * offset
  const cpy = my + (dx / len) * offset

  const pathD = `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`

  const opacity = getEdgeOpacity(lastDispatchAt)
  const strokeWidth = getEdgeStrokeWidth(dispatchCount24h)
  const color = getNodeColor(source.model)

  const ageMs = Date.now() - new Date(lastDispatchAt).getTime()
  const isRecent = ageMs < 60_000

  // Animated dash for recent edges
  const pathLength = len // approximate
  const dashArray = isRecent ? `${pathLength * 0.15} ${pathLength * 0.1}` : undefined
  const animationId = `dash-${source.id}-${target.id}`

  return (
    <g opacity={opacity}>
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashArray}
      >
        {isRecent && dashArray && (
          <animate
            attributeName="stroke-dashoffset"
            from={pathLength}
            to={0}
            dur="1.5s"
            repeatCount="indefinite"
            id={animationId}
          />
        )}
      </path>
    </g>
  )
}
