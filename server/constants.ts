import path from 'path'
import os from 'os'

export const CLAUDE_DIR = path.join(os.homedir(), '.claude')
export const AGENTS_DIR = path.join(CLAUDE_DIR, 'agents')
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')
export const PLANS_DIR = path.join(CLAUDE_DIR, 'plans')
export const AGENT_MEMORY_DIR = path.join(CLAUDE_DIR, 'agent-memory-local')
export const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills')
export const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')
export const RULES_DIR = path.join(CLAUDE_DIR, 'rules')
export const BRIEFINGS_DIR = path.join(CLAUDE_DIR, 'briefings')
export const MEETINGS_DIR = path.join(CLAUDE_DIR, 'meetings')
export const REPORTS_DIR = path.join(CLAUDE_DIR, 'reports')
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.local.json')
export const SETTINGS_GLOBAL_FILE = path.join(CLAUDE_DIR, 'settings.json')
export const CLAUDE_MD = path.join(CLAUDE_DIR, 'CLAUDE.md')
export const SCRIPTS_DIR = path.join(CLAUDE_DIR, 'scripts')
export const KEYBINDINGS_FILE = path.join(CLAUDE_DIR, 'keybindings.json')
export const LAUNCH_FILE = path.join(CLAUDE_DIR, 'launch.json')
export const TASKS_DIR = path.join(CLAUDE_DIR, 'tasks')
export const DEBUG_DIR = path.join(CLAUDE_DIR, 'debug')
export const EMAIL_SUMMARIES_DIR = path.join(CLAUDE_DIR, 'email-summaries')
export const DASHBOARD_COMMANDS_DIR = path.join(CLAUDE_DIR, 'dashboard-commands')

// `~/.claude/cast/*` — runtime state written by the CAST scripts/hooks ecosystem
// (exec-state, research-cache, tool-failure log, dispatch logs). One shared root
// so these siblings can't drift relative to each other.
export const CAST_DIR = path.join(CLAUDE_DIR, 'cast')
export const EXEC_STATE_DIR = path.join(CAST_DIR, 'exec-state')
export const RESEARCH_CACHE_DIR = path.join(CAST_DIR, 'research-cache')
export const TOOL_FAILURES_PATH = path.join(CAST_DIR, 'tool-failures.jsonl')
export const DISPATCH_LOGS_DIR = path.join(CAST_DIR, 'dispatch-logs')

export const LOGS_DIR = path.join(CLAUDE_DIR, 'logs')
export const MEMORY_BACKUP_LOG = path.join(LOGS_DIR, 'memory-backup.log')

// CAST v8 Pillar 2 data lives OUTSIDE the ~/.claude blast radius.
export const CAST_SUPPORT_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'cast')

// Matches the CAST-wide `CAST_DB_PATH` convention used elsewhere in the ecosystem
// (e.g. scripts/make-banner.py, and the Python `os.environ.get('CAST_DB_PATH', ...)`
// pattern) — without this, CAST_DB_PATH looked like a general override but silently
// did nothing for the dashboard server.
export const CAST_DB = process.env.CAST_DB_PATH || path.join(CLAUDE_DIR, 'cast.db')
export const CAST_SCRIPTS_DIR = path.join(CLAUDE_DIR, 'scripts')
export const CAST_WEEKLY_REPORT_SCRIPT = path.join(CAST_SCRIPTS_DIR, 'cast-weekly-report.sh')

// CAST flagship repo root — the cwd anchor for `git worktree` introspection and the
// default parent of the `cast` CLI binary. Overridable for dashboards not colocated
// with the flagship checkout (or CI), so a request never runs against whatever repo
// happens to be the dashboard process's own cwd.
// CAST_REPO_PATH is a deprecated alias kept for compatibility (older docs/scripts
// may still set it) — CAST_REPO_DIR takes precedence when both are set.
export const CAST_REPO_DIR =
  process.env.CAST_REPO_DIR ||
  process.env.CAST_REPO_PATH ||
  path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team')

// The `cast` CLI binary invoked by POST /api/cast/exec. Defaults under CAST_REPO_DIR
// but independently overridable (e.g. a globally-installed `cast` on PATH).
export const CAST_BIN = process.env.CAST_BIN || path.join(CAST_REPO_DIR, 'bin', 'cast')

// Honors CAST_REPO_DIR like CAST_BIN above — previously hardcoded to the
// claude-agent-team path directly, so a dashboard run against a non-default
// CAST_REPO_DIR would silently invoke the wrong repo's backup script.
export const MEMORY_BACKUP_SCRIPT = path.join(CAST_REPO_DIR, 'scripts', 'cast-memory-backup.sh')

export const PORT = Number(process.env.PORT) || 3001
export const HOST = process.env.DASHBOARD_HOST || '127.0.0.1'

// Single source of truth for the allowed CORS origin — read once here so every
// place that sets Access-Control-Allow-Origin (the main middleware in index.ts
// and the SSE response head in watchers/sse.ts) agrees, instead of each
// re-deriving `process.env.CORS_ORIGIN ?? 'http://localhost:5173'` separately.
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
