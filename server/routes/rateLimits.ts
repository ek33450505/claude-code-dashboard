import { makeTableRouter } from '../utils/makeTableRouter.js'

// GET /api/rate-limits
// CAST v8 Anthropic rate-limit snapshots (cast-rate-check.py writer). Empty until used.
export const rateLimitsRouter = makeTableRouter({
  table: 'rate_limit_snapshots',
  columns: 'ts, tpm_limit, tpm_used, rpm_limit, rpm_used',
  orderBy: 'ts DESC',
  key: 'snapshots',
  tag: 'rate-limits',
  limit: { default: 100, max: 500 },
  respond: (rows) => ({ latest: rows[0] ?? null, snapshots: rows }),
})
