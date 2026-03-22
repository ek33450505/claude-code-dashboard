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
    // Unwrap envelope format: { $schema, $docs, bindings: [...] }
    const raw = (typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.bindings))
      ? data.bindings
      : data
    if (Array.isArray(raw)) {
      // Pre-grouped format: [{context, bindings: {key: command}}]
      if (raw.length > 0 && typeof (raw[0] as Record<string, unknown>).bindings === 'object') {
        return res.json(raw.map((entry: Record<string, unknown>) => ({
          context: entry.context,
          bindings: entry.bindings,
        })))
      }
      // Flat format: [{context, key, command}]
      const grouped: Record<string, Record<string, string>> = {}
      for (const entry of raw) {
        const ctx = (entry as Record<string, string>).context || 'Global'
        if (!grouped[ctx]) grouped[ctx] = {}
        const key = (entry as Record<string, string>).key
        const command = (entry as Record<string, string>).command
        if (key && command) grouped[ctx][key] = command
      }
      return res.json(Object.entries(grouped).map(([context, bindings]) => ({ context, bindings })))
    }
    res.json([])
  } catch {
    res.json([])
  }
})

export { router as keybindingsRouter }
