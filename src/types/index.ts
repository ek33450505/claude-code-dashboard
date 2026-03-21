// Agent definition (parsed from ~/.claude/agents/*.md frontmatter)
export interface AgentDefinition {
  name: string
  description: string
  model: 'sonnet' | 'haiku' | 'opus' | string
  color: string
  tools: string[]
  maxTurns: number
  memory: 'local' | 'none' | string
  disallowedTools?: string[]
  filePath: string
}

// Session (derived from ~/.claude/projects/<project>/<uuid>.jsonl)
export interface Session {
  id: string
  project: string
  projectPath: string
  projectEncoded: string
  startedAt: string
  endedAt?: string
  durationMs?: number
  messageCount: number
  toolCallCount: number
  agentCount: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  model?: string
  estimatedCost?: number
  gitBranch?: string
  slug?: string
  version?: string
}

// Individual JSONL log entry
export interface LogEntry {
  parentUuid: string | null
  isSidechain?: boolean
  agentId?: string
  type: 'user' | 'assistant' | 'progress'
  message?: {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
    model?: string
    usage?: TokenUsage
  }
  uuid: string
  timestamp: string
  cwd?: string
  sessionId?: string
  gitBranch?: string
  slug?: string
  toolUseID?: string
  data?: ProgressData
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
  id?: string
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface ProgressData {
  type: string
  hookEvent?: string
  hookName?: string
  command?: string
}

// Subagent (from subagents/ directory)
export interface Subagent {
  id: string
  sessionId: string
  agentType?: string
  messageCount: number
  toolCallCount: number
}

// Memory file
export interface MemoryFile {
  agent: string
  path: string
  name?: string
  description?: string
  type?: string
  body: string
  modifiedAt: string
}

// Plan file
export interface PlanFile {
  filename: string
  title: string
  date: string
  path: string
  preview: string
  modifiedAt: string
}

// System health/overview
export interface SystemOverview {
  agentCount: number
  commandCount: number
  skillCount: number
  ruleCount: number
  planCount: number
  projectMemoryCount: number
  agentMemoryCount: number
  sessionCount: number
  hooks: HookEntry[]
  env: Record<string, string>
  model: string
  version?: string
}

export interface HookEntry {
  event: string
  matcher?: string
  description?: string
  type: string
}

// SSE live event
export interface LiveEvent {
  type: 'session_updated' | 'agent_spawned' | 'file_changed' | 'heartbeat' | 'routing_event'
  event?: RoutingEvent
  path?: string
  sessionId?: string
  projectDir?: string
  timestamp: string
  lastEntry?: LogEntry
}

// Active session summary (for live view)
export interface ActiveSession {
  sessionId: string
  projectDir: string
  projectName: string
  lastActivity: string
  lastEntryType?: string
  lastEntryPreview?: string
  subagentCount: number
  messageCount: number
  toolCallCount: number
}

export interface RoutingEvent {
  timestamp: string
  promptPreview: string
  action: 'suggested' | 'opus_escalation' | 'dispatched' | 'skipped'
  matchedRoute: string | null
  command: string | null
  pattern: string | null
}

export interface RoutingStats {
  totalEvents: number
  routedCount: number
  routingRate: number  // 0-1
  topAgents: Array<{ agent: string; count: number }>
  recentEvents: RoutingEvent[]
}

// Output file (briefings, meetings, reports)
export interface OutputFile {
  filename: string
  category: 'briefings' | 'meetings' | 'reports'
  path: string
  preview: string
  modifiedAt: string
}
