/**
 * The cast.db contract the dashboard depends on — tables, columns, producer status, and
 * timestamp encoding, as DATA rather than as SQL scattered across 48 route files.
 *
 * GENERATED-THEN-CURATED against the live database and the flagship's
 * `~/.claude/cast/producer-contract.json` on 2026-09-01. `shared/castSchema.test.ts` asserts
 * every table and column below still exists, so a flagship migration that drops something
 * fails the suite instead of turning a panel silently empty.
 *
 * That failure mode is not hypothetical. Before this file existed the dashboard shipped
 * routes against four tables the flagship had retired (see RETIRED_TABLES) and three columns
 * migration 028 dropped. Every one of those queries throws at prepare, every route catches
 * and returns `[]`, and every test passed — so the panels rendered an empty state that is
 * indistinguishable from "nothing happened".
 *
 * Schema is owned by the flagship's `cast-db-init.sh`. The dashboard NEVER creates or alters it.
 */

/**
 * Timestamp encodings present in cast.db. See `shared/time.ts` for the parser.
 *   A  ISO-8601 UTC, seconds        `2026-09-01T23:42:23Z`
 *   B  ISO-8601, sub-second/offset  `2026-09-01T18:22:25.804740+00:00`
 *   C  SQLite space format (UTC)    `2026-09-01 23:45:30`
 *   D  Unix epoch SECONDS (integer) `1783100402`
 */
export type TimestampFormat = 'A' | 'B' | 'C' | 'D'

/**
 * Producer status, mirrored from the flagship's producer-contract.json.
 *   live                 a writer runs on the stated cadence
 *   dormant              writer exists but is gated off — ZERO ROWS IS CORRECT, badge it
 *   dead_writer_retired  writer removed; historical rows remain valid
 *   external             written by something outside the flagship repo
 */
export type ProducerStatus = 'live' | 'dormant' | 'dead_writer_retired' | 'external'

export interface TableContract {
  /** Columns the dashboard reads. Asserted to exist by castSchema.test.ts. */
  columns: readonly string[]
  /** Producer status — drives the "dormant"/"no longer updated" badges. */
  status: ProducerStatus
  /** The table's primary time column, and how it is encoded. */
  timeColumn: string | null
  timeFormat: TimestampFormat | null
}

export const CAST_SCHEMA: Record<string, TableContract> = {
  ack_events: {
    columns: ['id', 'variable', 'value', 'has_reason', 'script', 'git_sha', 'session_id', 'repo', 'created_at'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'C',
  },
  agent_hallucinations: {
    columns: ['id', 'session_id', 'agent_name', 'claim_type', 'claimed_value', 'actual_value', 'verified', 'timestamp'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'B',
  },
  agent_memories: {
    columns: ['id', 'agent', 'project', 'type', 'name', 'description', 'content', 'created_at', 'updated_at', 'confidence', 'importance', 'decay_rate', 'valid_from', 'valid_to', 'embedding', 'last_validated_at', 'retrieval_count'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'B',
  },
  agent_protocol_violations: {
    columns: ['id', 'session_id', 'agent_type', 'agent_id', 'violation', 'pattern', 'timestamp', 'raw_excerpt'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'A',
  },
  agent_runs: {
    columns: ['id', 'session_id', 'agent', 'model', 'started_at', 'ended_at', 'status', 'input_tokens', 'output_tokens', 'cost_usd', 'agent_id', 'response', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'duration_ms', 'tool_uses', 'abandoned_at', 'branch', 'files', 'file_class', 'spawn_depth', 'parent_agent_id'],
    status: 'live', timeColumn: 'started_at', timeFormat: 'A',
  },
  // `day` is a bare 'YYYY-MM-DD' calendar key, not one of the four timestamped
  // encodings this contract otherwise tracks (all four require a time-of-day
  // component — see shared/time.ts's format table). contract.test.ts requires
  // timeFormat to be A/B/C/D whenever timeColumn is set, so declaring either
  // here would be a false claim about the encoding; routes/rollups.ts compares
  // `day` directly against `date('now', ...)` in SQL instead of via parseTimestamp.
  agent_runs_daily: {
    columns: ['day', 'agent', 'model', 'status', 'runs', 'cost_usd', 'input_tokens', 'output_tokens', 'duration_ms', 'rolled_up_at'],
    status: 'live', timeColumn: null, timeFormat: null,
  },
  agent_truncations: {
    columns: ['id', 'session_id', 'agent_type', 'agent_id', 'last_line', 'timestamp', 'char_count', 'partial_work_log'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'A',
  },
  archived_memories: {
    columns: ['id', 'agent', 'project', 'type', 'name', 'description', 'content', 'created_at', 'updated_at', 'confidence', 'importance', 'decay_rate', 'valid_from', 'valid_to', 'embedding', 'last_validated_at', 'retrieval_count', 'archived_at'],
    status: 'dormant', timeColumn: 'archived_at', timeFormat: 'B',
  },
  attestations: {
    columns: ['id', 'agent_key', 'false_done', 'payload', 'created_at'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'A',
  },
  budgets: {
    columns: ['id', 'scope', 'scope_key', 'period', 'limit_usd', 'alert_at_pct', 'created_at'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'B',
  },
  commit_provenance: {
    columns: ['sha', 'session_id', 'agent', 'branch', 'repo', 'recorded_at'],
    status: 'live', timeColumn: 'recorded_at', timeFormat: 'A',
  },
  compaction_events: {
    columns: ['id', 'session_id', 'timestamp', 'trigger', 'compaction_tier', 'transcript_path'],
    status: 'dead_writer_retired', timeColumn: 'timestamp', timeFormat: 'A',
  },
  completeness_events: {
    columns: ['id', 'agent', 'truncated_at', 'snippet', 'severity', 'created_at'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'C',
  },
  dispatch_decisions: {
    columns: ['id', 'session_id', 'prompt_snippet', 'chosen_agent', 'model', 'created_at', 'outcome', 'dispatch_name'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'C',
  },
  dispatch_events: {
    columns: ['id', 'agent', 'task_name', 'triggered_at', 'status', 'report_path'],
    status: 'live', timeColumn: 'triggered_at', timeFormat: 'C',
  },
  eval_runs: {
    columns: ['id', 'eval_id', 'agent', 'attempt', 'agent_run_id', 'status', 'grader_results', 'pass_at_k', 'k', 'duration_ms', 'started_at', 'ended_at', 'model', 'cost_tier'],
    status: 'live', timeColumn: 'started_at', timeFormat: 'B',
  },
  hook_failures: {
    columns: ['id', 'hook_name', 'exit_code', 'stderr', 'session_id', 'timestamp'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'B',
  },
  incidents: {
    columns: ['id', 'occurred_at', 'problem_summary', 'fix_summary', 'related_files', 'related_commit', 'resolution_status', 'surfaced_by'],
    status: 'live', timeColumn: 'occurred_at', timeFormat: 'A',
  },
  injection_log: {
    columns: ['id', 'session_id', 'prompt_hash', 'fact_id', 'score', 'score_breakdown', 'injected_at'],
    status: 'live', timeColumn: 'injected_at', timeFormat: 'A',
  },
  // See the agent_runs_daily comment above — `day` is a bare calendar key, not one
  // of the four timestamped encodings.
  mcp_calls_daily: {
    columns: ['day', 'mcp_server', 'mcp_tool', 'outcome', 'is_cloud_bound', 'calls', 'result_bytes', 'rolled_up_at'],
    status: 'live', timeColumn: null, timeFormat: null,
  },
  memory_consolidation_runs: {
    columns: ['id', 'run_id', 'project_id', 'status', 'instructions', 'input_fingerprint', 'output_path', 'error', 'started_at', 'completed_at', 'memory_files_read', 'transcripts_scanned', 'candidates_written', 'created_at'],
    status: 'dormant', timeColumn: 'created_at', timeFormat: 'C',
  },
  pane_bindings: {
    columns: ['pane_id', 'session_id', 'started_at', 'ended_at', 'project_path'],
    status: 'live', timeColumn: 'started_at', timeFormat: 'D',
  },
  plan_sessions: {
    columns: ['id', 'session_id', 'plan_file', 'started_at'],
    status: 'live', timeColumn: 'started_at', timeFormat: 'A',
  },
  provenance_chain: {
    columns: ['seq', 'session_id', 'prev_hash', 'session_digest', 'chain_hash', 'created_at', 'receipt_json'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'C',
  },
  quality_gates: {
    columns: ['id', 'session_id', 'agent_name', 'timestamp', 'status_line', 'contract_passed', 'retry_count', 'gate_type', 'created_at'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'A',
  },
  rate_limit_snapshots: {
    columns: ['ts', 'tpm_limit', 'tpm_used', 'rpm_limit', 'rpm_used', 'raw_json'],
    status: 'dormant', timeColumn: 'ts', timeFormat: 'D',
  },
  routines: {
    columns: ['id', 'name', 'trigger_type', 'trigger_value', 'agent_to_dispatch', 'prompt_template', 'output_dir', 'enabled', 'last_run_at', 'last_run_status', 'last_run_output_path', 'created_at'],
    status: 'dormant', timeColumn: 'created_at', timeFormat: 'A',
  },
  routing_events: {
    columns: ['id', 'session_id', 'timestamp', 'prompt_preview', 'action', 'matched_route', 'pattern', 'confidence', 'project', 'event_type', 'data'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'A',
  },
  sessions: {
    columns: ['id', 'project', 'project_root', 'started_at', 'ended_at', 'status', 'deleted_at'],
    status: 'live', timeColumn: 'started_at', timeFormat: 'A',
  },
  stop_failure_events: {
    columns: ['id', 'timestamp', 'event_id', 'agent_name', 'session_id', 'error_message', 'source', 'created_at'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'A',
  },
  task_queue: {
    columns: ['id', 'agent', 'task', 'priority', 'status', 'created_at', 'retry_count', 'max_retries', 'project', 'project_root'],
    status: 'live', timeColumn: 'created_at', timeFormat: 'C',
  },
  tool_call_failures: {
    columns: ['id', 'timestamp', 'session_id', 'tool_name', 'error', 'project', 'data'],
    status: 'live', timeColumn: 'timestamp', timeFormat: 'A',
  },
  worktree_anomalies: {
    columns: ['id', 'agent_id', 'worktree_path', 'detected_at', 'repo_root', 'state', 'reason'],
    status: 'live', timeColumn: 'detected_at', timeFormat: 'A',
  },
}

/**
 * Tables the flagship RETIRED — they do not exist on any live cast.db. Never query them.
 * Listed so the deletion of a route is traceable to a reason, and so `castSchema.test.ts`
 * can assert they are still absent rather than quietly reappearing.
 */
export const RETIRED_TABLES: Record<string, string> = {
  parry_guard_events: 'never existed on a live DB; docs/observability/OBSERVABILITY.md documented it in error until 2026-09-01',
  code_ref_checks: 'retired v9 Phase C U7b',
  stream_events: 'retired v9 Phase C U7a (migration 025)',
  teammate_messages: 'retired v9 Phase C U7a (migration 025)',
  unstaged_warnings: 'dropped by migration 028',
}

/**
 * Columns dropped by flagship migrations that dashboard code still referenced as of v2.7.0.
 * Each of these throws at `db.prepare()`, which the surrounding route swallows into an empty
 * response. Kept as data so the test can prove they are gone and so the fix is traceable.
 */
export const RETIRED_COLUMNS: Record<string, string> = {
  'agent_truncations.has_status': 'dropped by migration 028',
  'agent_truncations.has_json': 'dropped by migration 028',
  'task_queue.scheduled_for': 'dropped by migration 028',
  'task_queue.result_summary': 'dropped from canonical task_queue',
  'sessions.total_input_tokens': 'dropped by migration 022, re-dropped by 026',
  'sessions.total_output_tokens': 'dropped by migration 022, re-dropped by 026',
  'sessions.total_cost_usd': 'dropped by migration 022, re-dropped by 026',
  'sessions.model': 'dropped by migration 022, re-dropped by 026',
  'agent_runs.prompt': 'dropped by migration 022 — source via JOIN sessions',
  'agent_runs.project': 'dropped by migration 022 — source via JOIN sessions',
}

/** Every table name the dashboard is allowed to query. */
export const KNOWN_TABLES = Object.keys(CAST_SCHEMA)

/** True when `table` is safe to query on a current cast.db. */
export function isQueryableTable(table: string): boolean {
  return Object.prototype.hasOwnProperty.call(CAST_SCHEMA, table)
}
