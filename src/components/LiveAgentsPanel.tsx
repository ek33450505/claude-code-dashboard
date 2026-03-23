import { useLiveAgents } from '../api/useLiveAgents'
import { timeAgo, formatDuration } from '../utils/time'
import { PixelSprite } from './PixelSprite'
import { getAgentSprite, getModelTier, AGENT_PERSONALITIES } from '../utils/agentPersonalities'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

function TodoList({ todos, max = 5 }: { todos: NonNullable<ReturnType<typeof useLiveAgents>['data']>[number]['todos']; max?: number }) {
  if (!todos || todos.length === 0) return null
  const visible = todos.slice(0, max)
  return (
    <div className="mt-2 space-y-0.5">
      {visible.map((todo, i) => {
        const icon = todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '▶' : '□'
        const color =
          todo.status === 'completed' ? '#4ADE80'
          : todo.status === 'in_progress' ? '#00FFC2'
          : '#6B7280'
        return (
          <div key={i} className="flex items-start gap-1" style={{ ...PIXEL_FONT, fontSize: 6 }}>
            <span style={{ color, lineHeight: '1.6' }}>{icon}</span>
            <span
              className="leading-relaxed truncate"
              style={{
                color: todo.status === 'completed' ? '#6B7280' : todo.status === 'in_progress' ? '#E6E8EE' : '#9CA3AF',
                textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
              }}
            >
              {todo.status === 'in_progress' ? todo.activeForm : todo.content}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function LiveAgentsPanel() {
  const { data: agents } = useLiveAgents()

  const liveAgents = agents ?? []

  return (
    <div>
      {/* Header */}
      <h2
        className="mb-4 uppercase tracking-wider text-[var(--text-muted)]"
        style={{ ...PIXEL_FONT, fontSize: 9 }}
      >
        War Room
        <span
          className="ml-3"
          style={{
            color: liveAgents.length === 0 ? '#374151' : '#00FFC2',
            opacity: liveAgents.length === 0 ? 0.5 : 1,
            transition: 'color 0.3s, opacity 0.3s',
          }}
        >
          {liveAgents.length}
        </span>
      </h2>

      {/* Agent workstation grid */}
      {liveAgents.length === 0 ? (
        <div style={{
          padding: '16px',
          textAlign: 'center',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: '#374151',
          letterSpacing: '0.08em',
        }}>
          NO ACTIVE AGENTS
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {liveAgents.map((agent) => {
          const duration = agent.startedAt
            ? Date.now() - new Date(agent.startedAt).getTime()
            : 0

          const agentKey = agent.agentType?.toLowerCase().replace(/\s+/g, '-') ?? 'general-purpose'
          const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
          const sprite = getAgentSprite(agentKey)
          const modelTier = getModelTier(agent.model)

          // Current task: prefer in_progress activeForm, fall back to task prompt, then tagline
          const inProgressTodo = agent.todos?.find(t => t.status === 'in_progress')
          const currentTask = inProgressTodo?.activeForm
            ?? agent.description
            ?? agent.taskPrompt?.slice(0, 80)
            ?? personality.tagline

          // Status glow color
          const isIdle = !agent.isActive
          const glowColor = isIdle ? '#F59E0B' : personality.accentColor

          return (
            <div
              key={agent.agentId}
              className="relative rounded-xl overflow-hidden"
              style={{
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px), var(--bg-secondary)',
                border: `2px solid ${glowColor}40`,
                boxShadow: agent.isActive ? `0 0 16px ${glowColor}30, inset 0 0 20px ${glowColor}05` : 'none',
                transition: 'box-shadow 0.4s, border-color 0.4s',
              }}
            >
              {/* Active glow pulse */}
              {agent.isActive && (
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${personality.accentColor}10 0%, transparent 60%)`,
                    animation: 'pulse 3s ease-in-out infinite',
                  }}
                />
              )}

              <div className="relative p-3 flex gap-3">
                {/* Pixel sprite */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    style={{
                      animation: agent.isActive ? 'agent-idle 1.2s steps(2) infinite' : 'none',
                    }}
                  >
                    <PixelSprite grid={sprite} scale={3} />
                  </div>
                  {/* Status dot below sprite */}
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: glowColor,
                      boxShadow: agent.isActive ? `0 0 6px ${glowColor}` : 'none',
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  {/* Role title */}
                  <div
                    className="truncate"
                    style={{ ...PIXEL_FONT, fontSize: 7, color: personality.accentColor, lineHeight: '1.8' }}
                  >
                    {personality.roleTitle}
                  </div>

                  {/* Agent name (subtle) */}
                  <div className="text-[10px] text-[var(--text-muted)] font-mono truncate -mt-0.5 mb-1">
                    {agent.agentType ?? 'general-purpose'}
                  </div>

                  {/* Current task */}
                  <div
                    className="text-[var(--text-secondary)] leading-relaxed"
                    style={{ fontSize: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {currentTask}
                  </div>

                  {/* Todo list */}
                  <TodoList todos={agent.todos} max={4} />

                  {/* Footer row */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Model chip */}
                    <span
                      className="rounded px-1.5 py-0.5"
                      style={{ ...PIXEL_FONT, fontSize: 6, color: modelTier.color, backgroundColor: modelTier.bg }}
                    >
                      {modelTier.label}
                    </span>

                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{agent.projectName}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{agent.messageCount}m</span>
                    {duration > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)]">{formatDuration(duration)}</span>
                    )}
                    <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                      {agent.startedAt ? timeAgo(agent.startedAt) : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* Idle animation keyframes */}
      <style>{`
        @keyframes agent-idle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}
