import { Router } from 'express'
import fs from 'fs'
import { SCRIPTS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(SCRIPTS_DIR)) {
      return res.json([])
    }
    const files = fs.readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.sh'))
    const result = files.map(f => {
      const fullPath = `${SCRIPTS_DIR}/${f}`
      const stat = fs.statSync(fullPath)
      return {
        name: f,
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      }
    })
    res.json(result)
  } catch {
    res.json([])
  }
})

router.get('/:name', (req, res) => {
  const filePath = safeResolve(SCRIPTS_DIR, req.params.name)
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' })
    return
  }
  if (!filePath.endsWith('.sh')) {
    res.status(400).json({ error: 'Only .sh files are allowed' })
    return
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Script not found' })
    return
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ name: req.params.name, body: content })
  } catch {
    res.status(500).json({ error: 'Failed to read script' })
  }
})

export { router as scriptsRouter }
