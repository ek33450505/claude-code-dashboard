import { Router } from 'express'
import fs from 'fs'
import { DEBUG_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(DEBUG_DIR)) {
      return res.json([])
    }
    const files = fs.readdirSync(DEBUG_DIR).filter(f => f.endsWith('.txt'))
    const result = files.map(f => {
      const fullPath = `${DEBUG_DIR}/${f}`
      const stat = fs.statSync(fullPath)
      return {
        id: f,
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

router.get('/:id', (req, res) => {
  const filePath = safeResolve(DEBUG_DIR, req.params.id)
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' })
    return
  }
  if (!filePath.endsWith('.txt')) {
    res.status(400).json({ error: 'Only .txt files are allowed' })
    return
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Debug log not found' })
    return
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const totalLines = lines.length
    const truncated = totalLines > 500
    const body = truncated ? lines.slice(-500).join('\n') : content
    res.json({
      id: req.params.id,
      body,
      lineCount: totalLines,
      truncated,
    })
  } catch {
    res.status(500).json({ error: 'Failed to read debug log' })
  }
})

export { router as debugRouter }
