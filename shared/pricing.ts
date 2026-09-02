/**
 * Model pricing — the single rate table for the whole dashboard (server AND client).
 *
 * Source of truth: Anthropic's published pricing, mirrored by the CAST flagship at
 * `~/.claude/config/model-pricing.json` (repo: `claude-agent-team/config/model-pricing.json`).
 * `shared/pricing.test.ts` asserts this table matches that file entry-for-entry, so drift
 * fails the suite instead of silently mispricing the record.
 *
 * Cache rates are DERIVED, never hand-entered — this mirrors the flagship's own formula in
 * `scripts/cast_subagent_stop.py`, so both sides of the boundary compute cost identically:
 *   5-minute cache write = 1.25x base input
 *   cache read (hit)     = 0.10x base input   (see CACHE_READ_MULTIPLIER_OVERRIDES)
 * Hand-entering these is what produced the pre-v2.8 table, where `claude-opus-4-8` was
 * recorded at $15/$75 against a real rate of $5/$25 — a 3x overstatement.
 *
 * ── ONE COST SOURCE PER SURFACE (D3) ────────────────────────────────────────────
 * There are two legitimate pricing pipelines in this codebase, for two different
 * questions. Never mix them in a single field or a single sum — that makes the same
 * number mean different things per row.
 *
 *   1. `agent_runs.cost_usd` (written by CAST's own `cast_subagent_stop.py`) — the
 *      AGENT-SCOPED source. This is what `bin/cast cost` and `just -g cost` read.
 *      Use for anything scoped to agent runs: budget status, executive summary,
 *      per-agent analytics profiles, agent run lists/stats.
 *      Live surfaces: server/routes/budgetStatus.ts, server/routes/executiveSummary.ts,
 *      server/routes/analytics.ts (per-agent profile), server/routes/agentRuns.ts.
 *
 *   2. JSONL via this file's `estimateCost` — WHOLE-SESSION totals, including
 *      non-agent turns (the main-loop conversation). Use only for whole-session
 *      figures, never for anything scoped to individual agent runs.
 *      Live surfaces: server/routes/analytics.ts (estimatedCostUSD), sessions.ts,
 *      server/utils/jsonlTokenTotals.ts.
 *
 * A new route needs a cost figure: decide which question it answers (agent-scoped or
 * whole-session) and use only that source. Do not add a helper that reads `cost_usd`
 * and JSONL cost into the same response field.
 */

/** USD per million tokens, base rates. Keys are exact `agent_runs.model` values. */
export const MODEL_RATES: Record<string, { input: number; output: number }> = {
  // Current lineup
  'claude-fable-5-1':          { input: 10.0, output: 50.0 },
  'claude-fable-5':            { input: 10.0, output: 50.0 },
  'claude-opus-5':             { input: 5.0,  output: 25.0 },
  'claude-sonnet-5':           { input: 2.0,  output: 10.0 },
  'claude-haiku-4-5':          { input: 1.0,  output: 5.0 },
  'claude-haiku-4-5-20251001': { input: 1.0,  output: 5.0 },
  // Legacy, still present in the record
  'claude-opus-4-8':           { input: 5.0,  output: 25.0 },
  'claude-opus-4-7':           { input: 5.0,  output: 25.0 },
  'claude-opus-4-6':           { input: 5.0,  output: 25.0 },
  'claude-opus-4-5':           { input: 5.0,  output: 25.0 },
  'claude-sonnet-4-6':         { input: 3.0,  output: 15.0 },
  'claude-sonnet-4-5':         { input: 3.0,  output: 15.0 },
  // Retired
  'claude-opus-4-1':           { input: 15.0, output: 75.0 },
  'claude-haiku-3-5-20241022': { input: 0.8,  output: 4.0 },
}

/** Cache-write multiplier on base input (5-minute cache). Uniform across models. */
export const CACHE_WRITE_MULTIPLIER = 1.25

/** Default cache-read (hit) multiplier on base input. */
export const CACHE_READ_MULTIPLIER = 0.1

/**
 * Models that price cache reads off the default 0.1x.
 * Claude Fable 5.1 / Mythos 5.1 read at 0.025x — applying 0.1x overstates them 4x.
 */
export const CACHE_READ_MULTIPLIER_OVERRIDES: Record<string, number> = {
  'claude-fable-5-1': 0.025,
  'claude-mythos-5-1': 0.025,
}

/**
 * Fallback when a model id is absent from MODEL_RATES.
 *
 * Matches the flagship's `_default` entry. Deliberately NOT a family-prefix guess: the old
 * `startsWith('claude-opus')` fallback is what priced `claude-opus-5` at the retired Opus 4
 * rate. An unknown model should be visibly approximate, not confidently wrong — call
 * `isKnownModel()` when the caller needs to say so in the UI.
 */
export const DEFAULT_RATES = { input: 3.0, output: 15.0 }

/** True when `model` has an explicit rate entry (i.e. its cost is exact, not approximated). */
export function isKnownModel(model: string | null | undefined): boolean {
  return !!model && Object.prototype.hasOwnProperty.call(MODEL_RATES, model)
}

/** Base rates for `model`, falling back to DEFAULT_RATES for unknown ids. */
export function getRates(model: string | null | undefined): { input: number; output: number } {
  return (model && MODEL_RATES[model]) || DEFAULT_RATES
}

/** Cache-read multiplier for `model`. */
export function cacheReadMultiplier(model: string | null | undefined): number {
  if (!model) return CACHE_READ_MULTIPLIER
  return CACHE_READ_MULTIPLIER_OVERRIDES[model] ?? CACHE_READ_MULTIPLIER
}

/**
 * Estimated cost in USD.
 *
 * Identical formula to the flagship's `cast_subagent_stop.py`, so a dashboard estimate and a
 * recorded `agent_runs.cost_usd` are comparable rather than two different numbers.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  cacheCreation: number,
  cacheRead: number,
  model: string | null | undefined,
): number {
  const rates = getRates(model)
  return (
    inputTokens * rates.input +
    outputTokens * rates.output +
    cacheCreation * rates.input * CACHE_WRITE_MULTIPLIER +
    cacheRead * rates.input * cacheReadMultiplier(model)
  ) / 1_000_000
}
