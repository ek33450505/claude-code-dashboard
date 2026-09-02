import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getCastDb } from './castDb.js'
import { relativizeHome } from '../utils/relativizeHome.js'

export const systemIntegrityRouter = Router()

// CAST v8 Pillar 2 data lives OUTSIDE the ~/.claude blast radius.
const CAST_SUPPORT_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'cast')

// GET /api/system/integrity
// Litestream replication status + dated-snapshot freshness — the v8 "cast integrity" read surface.
systemIntegrityRouter.get('/', (_req, res) => {
  // Litestream replication (from cast.db internal tables)
  let litestream: { active: boolean; seq: number | null } = { active: false, seq: null }
  try {
    const db = getCastDb()
    if (db) {
      const tableCheck = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_litestream_seq'"
      ).get()
      if (tableCheck) {
        const row = db.prepare('SELECT MAX(seq) AS seq FROM _litestream_seq').get() as { seq: number | null }
        litestream = { active: true, seq: row?.seq ?? null }
      }
    }
  } catch (err) {
    console.error('[integrity] litestream check:', err)
  }

  // Dated DB snapshots (filesystem). backupsDir stays absolute throughout this block
  // (fs.existsSync/readdirSync/statSync) — relativize only in the returned `snapshots`.
  const backupsDir = path.join(CAST_SUPPORT_DIR, 'db-backups')
  let snapshots: { dir: string; lastBackupAt: string | null; count: number } = {
    dir: relativizeHome(backupsDir)!,
    lastBackupAt: null,
    count: 0,
  }
  try {
    if (fs.existsSync(backupsDir)) {
      const entries = fs.readdirSync(backupsDir).filter(f => !f.startsWith('.'))
      let newest = 0
      for (const e of entries) {
        const m = fs.statSync(path.join(backupsDir, e)).mtimeMs
        if (m > newest) newest = m
      }
      snapshots = {
        dir: relativizeHome(backupsDir)!,
        lastBackupAt: newest ? new Date(newest).toISOString() : null,
        count: entries.length,
      }
    }
  } catch (err) {
    console.error('[integrity] snapshot check:', err)
  }

  return res.json({ litestream, snapshots })
})
