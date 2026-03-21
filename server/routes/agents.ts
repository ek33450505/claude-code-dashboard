import { Router } from 'express'
import fs from 'fs'
import matter from 'gray-matter'
import { loadAgents, writeAgent, createAgent } from '../parsers/agents.js'

const router = Router()

router.get('/', (_req, res) => {
  const agents = loadAgents()
  res.json(agents)
})

router.get('/:name', (req, res) => {
  const agents = loadAgents()
  const agent = agents.find(a => a.name === req.params.name)
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' })
    return
  }

  const raw = fs.readFileSync(agent.filePath, 'utf-8')
  const { content } = matter(raw)
  res.json({ ...agent, body: content })
})

router.put('/:name', (req, res) => {
  try {
    const updated = writeAgent(req.params.name, req.body)
    res.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update agent'
    res.status(400).json({ error: message })
  }
})

router.post('/', (req, res) => {
  try {
    const { name, ...frontmatter } = req.body
    if (!name) {
      res.status(400).json({ error: 'Agent name is required' })
      return
    }
    const created = createAgent(name, frontmatter)
    res.status(201).json(created)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create agent'
    res.status(400).json({ error: message })
  }
})

export { router as agentsRouter }
