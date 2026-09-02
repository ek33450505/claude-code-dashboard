import { Router } from 'express'
import { getCachedSessions } from '../parsers/sessions.js'
import { loadAgents } from '../parsers/agents.js'
import { loadPlans, loadAgentMemory, loadProjectMemory } from '../parsers/memory.js'
import { clampLimit } from '../utils/clampLimit.js'
import { maskProjectKey, redactPath } from '../utils/projectKey.js'

export const searchRouter = Router()

searchRouter.get('/', (req, res) => {
  const q = (req.query.q as string || '').toLowerCase()
  const limit = clampLimit(req.query.limit, 20, 100)

  const empty = { sessions: [], agents: [], plans: [], memories: [] }

  if (!q || q.length < 2) {
    res.json(empty)
    return
  }

  // Sessions: match on slug or project
  const allSessions = getCachedSessions()
  const matchedSessions: Array<{
    id: string
    project: string
    projectEncoded: string
    startedAt: string
    slug?: string
    matchReason: 'slug' | 'project' | 'content'
  }> = []

  for (const s of allSessions) {
    if (matchedSessions.length >= 5) break
    if (s.slug?.toLowerCase().includes(q)) {
      matchedSessions.push({
        id: s.id,
        project: s.project,
        // Masked at the response boundary — getCachedSessions() returns raw,
        // shared/cached values still used elsewhere for real fs I/O; s itself
        // is left untouched, only the pushed copy is masked. See maskProjectKey().
        projectEncoded: maskProjectKey(s.projectEncoded),
        startedAt: s.startedAt,
        slug: s.slug,
        matchReason: 'slug',
      })
    } else if (s.project.toLowerCase().includes(q)) {
      matchedSessions.push({
        id: s.id,
        project: s.project,
        projectEncoded: maskProjectKey(s.projectEncoded),
        startedAt: s.startedAt,
        slug: s.slug,
        matchReason: 'project',
      })
    }
  }

  // Agents: match on name or description
  const allAgents = loadAgents()
  const matchedAgents = allAgents
    .filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(a => ({
      name: a.name,
      description: a.description,
      model: a.model,
      color: a.color,
    }))

  // Plans: match on title or filename
  const allPlans = loadPlans()
  const matchedPlans = allPlans
    .filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.filename.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(p => ({
      filename: p.filename,
      title: p.title,
      date: p.date,
      preview: p.preview,
    }))

  // Memories: combine agent + project memory
  const allMemories = [...loadAgentMemory(), ...loadProjectMemory()]
  const matchedMemories = allMemories
    .filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(m => ({
      // m.agent is an agent name in most branches, but loadProjectMemory()'s legacy
      // ~/.claude/projects/<encoded>/memory branch sets it to the raw encoded
      // project-directory name itself (see server/parsers/memory.ts) — a
      // project-key-shaped string, not a filesystem path, so maskProjectKey (not
      // redactPath) is the right transform. It's a no-op on a plain agent name.
      agent: maskProjectKey(m.agent),
      name: m.name,
      description: m.description,
      type: m.type,
      // m.path already comes pre-relativized (or a non-fs 'cast-db:<id>' key) out of
      // loadAgentMemory()/loadProjectMemory() — see server/parsers/memory.ts. That
      // upstream relativizeHome() only strips a leading real-home prefix though; the
      // legacy branch's path still embeds the encoded project-directory segment
      // mid-string, so redactPath() here closes that remaining leak. It's idempotent
      // on the already-relativized/non-fs values from the other branches.
      path: redactPath(m.path) ?? m.path,
    }))

  res.json({
    sessions: matchedSessions,
    agents: matchedAgents,
    plans: matchedPlans,
    memories: matchedMemories,
  })
})
