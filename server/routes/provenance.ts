import { makeTableRouter } from '../utils/makeTableRouter.js'

interface ProvenanceChainRow {
  seq: number; session_id: string; prev_hash: string | null; session_digest: string;
  chain_hash: string; created_at: string; receipt_json: string | null
}

// GET /api/cast/provenance-chain
export const provenanceChainRouter = makeTableRouter({
  table: 'provenance_chain',
  columns: 'seq, session_id, prev_hash, session_digest, chain_hash, created_at, receipt_json',
  orderBy: 'seq DESC',
  key: 'chain',
  tag: 'provenance-chain',
  limit: { default: 100, max: 500 },
  // receipt_json is null for any row written before migration 035 — that is the
  // NORMAL, EXPECTED state for those rows, not evidence of tampering or a broken
  // chain. There is no hash-chain-mismatch detection here; verified vs unverifiable
  // based solely on receipt_json presence is the whole of this computation.
  mapRow: (r: ProvenanceChainRow) => ({
    ...r,
    verification_state: r.receipt_json === null ? 'unverifiable' : 'verified',
  }),
})

// GET /api/cast/commit-provenance
export const commitProvenanceRouter = makeTableRouter({
  table: 'commit_provenance',
  columns: 'sha, session_id, agent, branch, repo, recorded_at',
  orderBy: 'recorded_at DESC',
  key: 'commits',
  tag: 'commit-provenance',
  limit: { default: 100, max: 500 },
})

// GET /api/cast/attestations
export const attestationsRouter = makeTableRouter({
  table: 'attestations',
  columns: 'id, agent_key, false_done, payload, created_at',
  orderBy: 'created_at DESC',
  key: 'attestations',
  tag: 'attestations',
  limit: { default: 100, max: 500 },
})
