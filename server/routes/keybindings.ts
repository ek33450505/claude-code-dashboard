import { Router } from 'express'
import fs from 'fs'
import { KEYBINDINGS_FILE } from '../constants.js'

const router = Router()

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(KEYBINDINGS_FILE)) {
      return res.json([])
    }
    const data = JSON.parse(fs.readFileSync(KEYBINDINGS_FILE, 'utf-8'))
    // Group bindings by context
    if (Array.isArray(data)) {
      const grouped: Record<string, Record<string, string>> = {}
      for (const entry of data) {
        const ctx = (entry as Record<string, string>).context || 'Global'
        if (!grouped[ctx]) grouped[ctx] = {}
        const key = (entry as Record<string, string>).key
        const command = (entry as Record<string, string>).command
        if (key && command) grouped[ctx][key] = command
      }
      const result = Object.entries(grouped).map(([context, bindings]) => ({
        context,
        bindings,
      }))
      return res.json(result)
    }
    // If already grouped by context
    if (typeof data === 'object') {
      const result = Object.entries(data).map(([context, bindings]) => ({
        context,
        bindings: bindings as Record<string, string>,
      }))
      return res.json(result)
    }
    res.json([])
  } catch {
    res.json([])
  }
})

export { router as keybindingsRouter }
