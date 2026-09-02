import { makeTableRouter } from '../utils/makeTableRouter.js'

// GET /api/eval-runs
// CAST v8 eval harness results (cast-eval-runner.py writer / `cast eval`).
export const evalRunsRouter = makeTableRouter({
  table: 'eval_runs',
  columns:
    'id, eval_id, agent, attempt, agent_run_id, status, grader_results, pass_at_k, k, duration_ms, started_at, ended_at, model, cost_tier',
  orderBy: 'started_at DESC',
  key: 'runs',
  tag: 'eval-runs',
  limit: { default: 200, max: 1000 },
})
