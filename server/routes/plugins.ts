import { Router } from 'express'
import fs from 'fs'
import { SETTINGS_GLOBAL_FILE } from '../constants.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(SETTINGS_GLOBAL_FILE)) {
      return res.json([])
    }
    const settings = JSON.parse(fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8'))
    const enabledPlugins = settings.enabledPlugins as Record<string, boolean> | undefined
    if (!enabledPlugins) {
      return res.json([])
    }
    const result = Object.entries(enabledPlugins).map(([key, enabled]) => {
      const parts = key.split(':')
      const provider = parts.length > 1 ? parts[0] : ''
      const name = parts.length > 1 ? parts.slice(1).join(':') : key
      return { name, provider, enabled }
    })
    res.json(result)
  } catch {
    res.json([])
  }
})

export { router as pluginsRouter }
