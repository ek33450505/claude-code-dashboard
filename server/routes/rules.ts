import { Router } from 'express'
import fs from 'fs'
import { RULES_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'
import { loadRules, readRule } from '../parsers/rules.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(loadRules())
})

router.get('/:filename', (req, res) => {
  const content = readRule(req.params.filename)
  if (!content) {
    res.status(404).json({ error: 'Rule not found' })
    return
  }
  res.json({ filename: req.params.filename, body: content })
})

// PUT /api/rules/:filename — overwrite a rule file
router.put('/:filename', (req, res) => {
  try {
    const { body } = req.body as { body?: string }
    if (typeof body !== 'string') return res.status(400).json({ error: 'body required' })
    // Same guard as readRule() (server/parsers/rules.ts) — was previously a
    // hand-rolled path.join + startsWith check here while the GET route already
    // went through safeResolve; this brings the write path in line with it.
    const filePath = safeResolve(RULES_DIR, req.params.filename)
    if (!filePath) {
      return res.status(403).json({ error: 'Invalid path' })
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
    fs.writeFileSync(filePath, body, 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    console.error('Rules write error:', err)
    res.status(500).json({ error: 'Failed to write rule file' })
  }
})

export { router as rulesRouter }
