import { Router } from 'express'
import http from 'http'

export const ollamaHealthRouter = Router()

ollamaHealthRouter.get('/', async (_req, res) => {
  try {
    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get('http://localhost:11434/api/tags', { timeout: 2000 }, r => {
        let body = ''
        r.on('data', d => (body += d))
        r.on('end', () => resolve(body))
      })
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('timeout'))
      })
    })
    const json = JSON.parse(data)
    const models: string[] = (json.models ?? []).map((m: { name: string }) => m.name)
    res.json({ connected: true, models })
  } catch {
    res.json({ connected: false, models: [] })
  }
})
