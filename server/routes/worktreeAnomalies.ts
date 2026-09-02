import { makeTableRouter } from '../utils/makeTableRouter.js'
import { relativizeHome } from '../utils/relativizeHome.js'

interface WorktreeAnomalyRow {
  id: number; agent_id: string | null; worktree_path: string | null
  detected_at: string; repo_root: string | null; state: string | null; reason: string | null
}

// GET /api/worktree-anomalies
// CAST v8 git-worktree anomaly detections (cast-subagent-worktree-check.sh writer).
export const worktreeAnomaliesRouter = makeTableRouter({
  table: 'worktree_anomalies',
  columns: 'id, agent_id, worktree_path, detected_at, repo_root, state, reason',
  orderBy: 'detected_at DESC',
  key: 'anomalies',
  tag: 'worktree-anomalies',
  limit: { default: 200, max: 1000 },
  includeTotal: true,
  // worktree_path/repo_root are DB columns written by the flagship's worktree
  // checker — absolute paths under $HOME, not derived from os.homedir() here.
  // Relativize on the way out (this GET is public/unauthenticated); nothing
  // downstream reuses these fields for I/O — they only ever flow to res.json.
  mapRow: (r: WorktreeAnomalyRow) => ({
    ...r,
    worktree_path: relativizeHome(r.worktree_path ?? undefined) ?? null,
    repo_root: relativizeHome(r.repo_root ?? undefined) ?? null,
  }),
})
