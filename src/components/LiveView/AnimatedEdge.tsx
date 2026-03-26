import React, { useRef } from 'react'
import {
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

function edgeColor(targetStatus: string): string {
  if (targetStatus === 'running') return '#60a5fa'        // blue-400
  if (targetStatus === 'DONE') return '#22c55e'           // green-500
  if (targetStatus === 'DONE_WITH_CONCERNS') return '#facc15' // yellow-400
  if (targetStatus === 'BLOCKED') return '#f87171'        // red-400
  return '#475569'                                         // slate-600 inactive
}

export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const targetStatus = (data?.targetStatus as string) ?? 'running'
  const isRunning = targetStatus === 'running'
  const color = edgeColor(targetStatus)

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const markerId = `arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.7" />
        </marker>
        {isRunning && (
          <style>{`
            @keyframes dash-flow-${id} {
              from { stroke-dashoffset: 24; }
              to   { stroke-dashoffset: 0; }
            }
          `}</style>
        )}
      </defs>
      <path
        id={id}
        d={edgePath}
        stroke={color}
        strokeWidth={isRunning ? 1.5 : 1}
        strokeOpacity={isRunning ? 0.8 : 0.4}
        fill="none"
        strokeDasharray={isRunning ? '8 4' : '0'}
        style={
          isRunning
            ? {
                animation: `dash-flow-${id} 0.8s linear infinite`,
              }
            : undefined
        }
        markerEnd={`url(#${markerId})`}
      />
    </>
  )
}
