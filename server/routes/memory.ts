import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { AGENT_MEMORY_DIR } from '../constants.js'
import { loadAgentMemory, loadProjectMemory } from '../parsers/memory.js'

const router = Router()

router.get('/agent', (_req, res) => {
  const memory = loadAgentMemory()
  res.json(memory)
})

router.get('/agent/:agentName', (req, res) => {
  const memory = loadAgentMemory().filter(m => m.agent === req.params.agentName)
  res.json(memory)
})

router.get('/project', (_req, res) => {
  const memory = loadProjectMemory()
  res.json(memory)
})

// PUT /api/memory/agent/:agentName/:filename — overwrite a memory file body
router.put('/agent/:agentName/:filename', (req, res) => {
  try {
    const { agentName, filename } = req.params
    const { body } = req.body as { body?: string }
    if (typeof body !== 'string') return res.status(400).json({ error: 'body required' })
    const memDir = path.join(AGENT_MEMORY_DIR, agentName)
    const filePath = path.join(memDir, filename)
    // Security: prevent path traversal
    if (!filePath.startsWith(memDir + path.sep) && filePath !== memDir) {
      return res.status(403).json({ error: 'Invalid path' })
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
    fs.writeFileSync(filePath, body, 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    console.error('Memory write error:', err)
    res.status(500).json({ error: 'Failed to write memory file' })
  }
})

// DELETE /api/memory/agent/:agentName/:filename — delete a memory file
router.delete('/agent/:agentName/:filename', (req, res) => {
  try {
    const { agentName, filename } = req.params
    const memDir = path.join(AGENT_MEMORY_DIR, agentName)
    const filePath = path.join(memDir, filename)
    if (!filePath.startsWith(memDir + path.sep) && filePath !== memDir) {
      return res.status(403).json({ error: 'Invalid path' })
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
    fs.unlinkSync(filePath)
    res.json({ ok: true })
  } catch (err) {
    console.error('Memory delete error:', err)
    res.status(500).json({ error: 'Failed to delete memory file' })
  }
})

export { router as memoryRouter }
