import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import AgentWebTree from './AgentWebTree'
import type { SessionGroup } from './SessionGroupList'

interface AgentWebSessionProps {
  session: SessionGroup
}

export default function AgentWebSession({ session }: AgentWebSessionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const projectLabel =
    session.projectName ||
    session.projectDir?.split('/').filter(Boolean).at(-1) ||
    session.sessionId.slice(0, 8)

  return (
    <div className="rounded-xl border border-border overflow-hidden mb-3 bg-card">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {session.isActive && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${session.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
        </span>
        <span className="text-xs font-mono font-semibold text-foreground flex-1 text-left truncate">
          {projectLabel}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {session.agents?.length ?? 0} agents
        </span>
        <motion.span
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.span>
      </button>

      {/* Tree body */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AgentWebTree agents={session.agents ?? []} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
