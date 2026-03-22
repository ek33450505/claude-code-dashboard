import { Router } from 'express'
import fs from 'fs'
import { TASKS_DIR } from '../constants.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(TASKS_DIR)) {
      return res.json([])
    }
    const dirs = fs.readdirSync(TASKS_DIR).filter(d => {
      try {
        return fs.statSync(`${TASKS_DIR}/${d}`).isDirectory()
      } catch {
        return false
      }
    })
    const result = dirs.map(d => {
      const dirPath = `${TASKS_DIR}/${d}`
      const stat = fs.statSync(dirPath)
      const contents = fs.readdirSync(dirPath)
      return {
        id: d,
        hasConfig: contents.includes('config.json'),
        hasLock: contents.some(f => f.endsWith('.lock')),
        modifiedAt: stat.mtime.toISOString(),
      }
    })
    res.json(result)
  } catch {
    res.json([])
  }
})

export { router as tasksRouter }
