import { Router } from 'express'
import fs from 'fs'
import { SETTINGS_FILE } from '../constants.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return res.json({ allow: [], deny: [], sandbox: null })
    }
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    const permissions = settings.permissions as Record<string, unknown> | undefined
    const allow = (permissions?.allow as string[]) || []
    const deny = (permissions?.deny as string[]) || []
    const sandbox = (settings.sandbox as object) || null
    res.json({ allow, deny, sandbox })
  } catch {
    res.json({ allow: [], deny: [], sandbox: null })
  }
})

export { router as permissionsRouter }
