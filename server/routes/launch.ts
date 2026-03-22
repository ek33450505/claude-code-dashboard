import { Router } from 'express'
import fs from 'fs'
import { LAUNCH_FILE } from '../constants.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(LAUNCH_FILE)) {
      return res.json({ configurations: [] })
    }
    const data = JSON.parse(fs.readFileSync(LAUNCH_FILE, 'utf-8'))
    res.json(data)
  } catch {
    res.json({ configurations: [] })
  }
})

export { router as launchRouter }
