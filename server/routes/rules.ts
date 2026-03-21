import { Router } from 'express'
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

export { router as rulesRouter }
