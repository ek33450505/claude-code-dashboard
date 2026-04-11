import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTaskSatelliteRadius, getTaskStatusColor, getNodeColor } from './constellationLayout'
import type { SimTaskNode } from './useForceSimulation'
import type { AgentNode } from './constellationLayout'

interface TaskSatelliteProps {
  task: SimTaskNode
  parentNode: AgentNode
  parentX: number
  parentY: number
}

// Checkmark SVG path (normalized to ~12px circle)
const CHECKMARK_PATH = 'M -4 0 L -1.5 3 L 4.5 -3'
// X mark paths
const X_PATH_1 = 'M -3.5 -3.5 L 3.5 3.5'
const X_PATH_2 = 'M 3.5 -3.5 L -3.5 3.5'

function truncate(s: string | null, maxLen: number): string {
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s
}

export function TaskSatellite({ task, parentNode, parentX, parentY }: TaskSatelliteProps) {
  const parentColor = getNodeColor(parentNode.model)
  const radius = getTaskSatelliteRadius(task.status)
  const { fill, stroke, fillOpacity } = getTaskStatusColor(task.status, parentColor)
  const [visible, setVisible] = useState(true)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const isDone = task.status === 'done' || task.status === 'DONE' || task.status === 'DONE_WITH_CONCERNS'
  const isFailed = task.status === 'failed' || task.status === 'BLOCKED' || task.status === 'NEEDS_CONTEXT'
  const isActive = task.status === 'active' || task.status === 'running'
  const isPending = task.status === 'pending'

  // Collapse done satellites back into parent after 3 seconds
  useEffect(() => {
    if (isDone && !collapsed) {
      collapseTimer.current = setTimeout(() => {
        setCollapsed(true)
        setTimeout(() => setVisible(false), 700)
      }, 3000)
    }
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    }
  }, [isDone, collapsed])

  if (!visible) return null

  const label = truncate(task.subject, 20)

  return (
    <AnimatePresence>
      {!collapsed && (
        <motion.g
          key={task.taskId}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            scale: 0,
            x: parentX - task.x,
            y: parentY - task.y,
          }}
          transition={{ duration: 0.6, ease: 'easeIn' }}
          transform={`translate(${task.x},${task.y})`}
        >
          {/* Connector line to parent */}
          <line
            x1={0}
            y1={0}
            x2={parentX - task.x}
            y2={parentY - task.y}
            stroke={parentColor}
            strokeWidth={1}
            strokeOpacity={0.3}
            strokeDasharray="3,3"
          />

          {/* Active pulse */}
          {isActive && (
            <motion.circle
              r={radius}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={stroke}
              strokeWidth={1.5}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Main circle */}
          {!isActive && (
            <circle
              r={radius}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={stroke}
              strokeWidth={isPending ? 1.5 : 1.5}
              strokeOpacity={isPending ? 0.5 : 1}
              style={isFailed ? { filter: `drop-shadow(0 0 4px #f87171)` } : undefined}
            />
          )}

          {/* Done checkmark */}
          {isDone && (
            <motion.path
              d={CHECKMARK_PATH}
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
            />
          )}

          {/* Failed X mark */}
          {isFailed && (
            <>
              <motion.path
                d={X_PATH_1}
                stroke="white"
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25 }}
              />
              <motion.path
                d={X_PATH_2}
                stroke="white"
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, delay: 0.1 }}
              />
            </>
          )}

          {/* Label */}
          {label && (
            <text
              y={-radius - 4}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              opacity={0.6}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {label}
            </text>
          )}
        </motion.g>
      )}
    </AnimatePresence>
  )
}
