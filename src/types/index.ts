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
  command?: string
  timeout?: number
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
  agentType?: string
  agentDescription?: string
}

// Todo item (from TodoWrite tool_use inside subagent JSONL)
export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

// Live agent (from /api/agents/live)
export interface LiveAgent {
  agentId: string
  agentType?: string
  description?: string
  taskPrompt?: string        // first user message from subagent JSONL (400 chars)
  todos?: TodoItem[]         // latest TodoWrite call in the subagent session
  sessionId: string
  projectDir: string
  projectName: string
  startedAt: string
  lastModifiedMs: number
  messageCount: number
  model?: string
  isActive: boolean
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
  action: 'suggested' | 'dispatched' | 'opus_escalation' | 'no_match' | 'skipped' | 'agent_dispatch' | 'senior_dev_dispatch'
  matchedRoute: string | null
  command: string | null
  pattern: string | null
  // Agent dispatch metadata (only present for agent_dispatch events)
  agentName?: string | null
  agentModel?: string | null
  reasoning?: string | null
}

export interface RoutingStats {
  totalEvents: number       // user prompts only (from routing log)
  routedCount: number       // hook-dispatched prompts only
  autoDispatchCount: number // auto-dispatched agents (from session JSONLs)
  routingRate: number       // 0-1, routedCount / (routedCount + no_match)
  topAgents: Array<{ agent: string; count: number; routed: number; direct: number }>
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

export interface HookDefinition {
  event: string
  type: string
  matcher?: string
  command?: string
  timeout?: number
  description?: string
}

export interface ScriptFile {
  name: string
  path: string
  size: number
  modifiedAt: string
}

export interface PluginEntry {
  name: string
  provider: string
  enabled: boolean
}

export interface KeybindingContext {
  context: string
  bindings: Record<string, string>
}

export interface LaunchConfig {
  name: string
  runtimeExecutable: string
  runtimeArgs: string[]
  port: number
}

export interface TaskEntry {
  id: string
  hasConfig: boolean
  hasLock: boolean
  modifiedAt: string
}

export interface DebugLogFile {
  id: string
  path: string
  size: number
  modifiedAt: string
}

export interface RoutingRule {
  agent: string
  command: string
  patterns: string[]
  postChain: string[] | null
}
