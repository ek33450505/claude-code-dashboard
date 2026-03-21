import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { loadPlans } from '../parsers/memory.js'
import { PLANS_DIR } from '../constants.js'

const router = Router()

router.get('/', (_req, res) => {
  const plans = loadPlans()
  res.json(plans)
})

router.get('/:filename', (req, res) => {
  const filePath = path.join(PLANS_DIR, req.params.filename)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Plan not found' })
    return
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  const stat = fs.statSync(filePath)

  const plans = loadPlans()
  const meta = plans.find(p => p.filename === req.params.filename)

  res.json({
    filename: req.params.filename,
    title: meta?.title || req.params.filename,
    body: content,
    modifiedAt: stat.mtime.toISOString(),
  })
})

export { router as plansRouter }
