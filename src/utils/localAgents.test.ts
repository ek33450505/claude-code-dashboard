import { describe, it, expect } from 'vitest'
import { LOCAL_AGENTS } from './localAgents'

describe('LOCAL_AGENTS', () => {
  it('has exactly 30 agents', () => {
    expect(LOCAL_AGENTS).toHaveLength(30)
  })

  it('does not include "orchestrator"', () => {
    expect(LOCAL_AGENTS).not.toContain('orchestrator')
  })

  it('includes post-v3 agents: adr-writer, migration-reviewer, task-triage', () => {
    expect(LOCAL_AGENTS).toContain('adr-writer')
    expect(LOCAL_AGENTS).toContain('migration-reviewer')
    expect(LOCAL_AGENTS).toContain('task-triage')
  })

  it('is sorted alphabetically', () => {
    const sorted = [...LOCAL_AGENTS].sort()
    expect(LOCAL_AGENTS).toEqual(sorted)
  })
})
