import React from 'react'
import { Handle, Position } from '@xyflow/react'

export interface SessionNodeData {
  sessionId: string
  projectName: string
  costUsd: number
  elapsedMs: number
  connected: boolean
}

interface SessionNodeProps {
  data: SessionNodeData
}

export default function SessionNode({ data }: SessionNodeProps) {
  const { sessionId, projectName, connected } = data

  return (
    <div className="relative flex items-center justify-center">
      {connected && (
        <div
          className="absolute rounded-full bg-[var(--accent)] animate-ping opacity-20"
          style={{ width: 80, height: 80 }}
        />
      )}
      <div
        className="relative flex flex-col items-center justify-center rounded-full bg-[var(--bg-secondary)]"
        style={{
          width: 64,
          height: 64,
          border: '2px solid var(--accent)',
          boxShadow: connected ? '0 0 20px rgba(0,255,194,0.25)' : undefined,
        }}
      >
        <span className="text-[10px] font-semibold text-center leading-tight text-[var(--text-primary)] px-1 truncate max-w-[52px]">
          {projectName}
        </span>
        <span className="font-mono text-[9px] text-[var(--text-muted)]">
          {sessionId.slice(0, 6)}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
