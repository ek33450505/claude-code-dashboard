/**
 * S6 follow-up — path relativization for the remaining parser-level leak sites
 * named in the finding: loadCommands()/loadRules() (server/parsers/commands.ts,
 * rules.ts) and loadAgentMemory()/loadPlans()/loadOutputs()
 * (server/parsers/memory.ts). Each of these returns a `path`/`filePath` field
 * that is the ONLY thing the client ever sees for that value — none of their
 * consuming routes reuse the parser's returned field for a subsequent fs call
 * (readCommand/readRule/plans.ts's GET /:filename all re-resolve their own
 * absolute path from a request param via safeResolve) — so it's safe to
 * relativize inside the parser itself, unlike agents.ts's loadAgents().
 *
 * `os.homedir()` is spied to point at a throwaway temp directory (never the
 * real $HOME) so relativizeHome()'s `p.startsWith(home)` check has something
 * real to match against, and every fixture file lives under that same temp
 * root — no real filesystem outside it is touched or read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// These directory paths must be fixed BEFORE `../constants.js` is mocked and
// server/parsers/memory.ts is imported below: memory.ts computes its
// `OUTPUT_DIRS = { briefings: BRIEFINGS_DIR, ... }` map ONCE at module-load
// time, so a `let` reassigned only in beforeEach (as memory-routes.test.ts
// does for AGENT_MEMORY_DIR et al.) would be captured as `undefined` — the
// import below runs before any beforeEach ever fires. Test isolation between
// `it` blocks is instead handled by wiping and recreating this same tmpDir's
// contents in beforeEach/afterEach.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-relativize-'))
const commandsDir = path.join(tmpDir, 'commands')
const rulesDir = path.join(tmpDir, 'rules')
const skillsDir = path.join(tmpDir, 'skills')
const agentMemoryDir = path.join(tmpDir, 'agent-memory-local')
const plansDir = path.join(tmpDir, 'plans')
const briefingsDir = path.join(tmpDir, 'briefings')
const projectsDir = path.join(tmpDir, 'projects')

vi.mock('../constants.js', () => ({
  COMMANDS_DIR: commandsDir,
  RULES_DIR: rulesDir,
  SKILLS_DIR: skillsDir,
  AGENT_MEMORY_DIR: agentMemoryDir,
  PLANS_DIR: plansDir,
  BRIEFINGS_DIR: briefingsDir,
  PROJECTS_DIR: projectsDir,
  MEETINGS_DIR: '/nonexistent-meetings-dir',
  REPORTS_DIR: '/nonexistent-reports-dir',
  CAST_DB: '/nonexistent-cast-db',
}))

const { loadCommands } = await import('./commands.js')
const { loadRules } = await import('./rules.js')
const { loadSkills } = await import('./skills.js')
const { loadAgentMemory, loadProjectMemory, loadPlans, loadOutputs } = await import('./memory.js')

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

beforeEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  // relativizeHome() calls os.homedir() internally — point it at tmpDir so a
  // tmpDir-rooted fixture path is recognized as "home-rooted" without ever
  // touching the real $HOME.
  vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('loadCommands — S6 path relativization', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(commandsDir, 'deploy.md'), 'Use the `devops` agent for this.')

    const result = loadCommands()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'commands', 'deploy.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(filePath)!` in commands.ts back to `path: filePath`.
    // With that corruption, result[0].path comes back as the raw absolute
    // tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadRules — S6 path relativization', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(rulesDir, 'shell.md'), '# Shell conventions')

    const result = loadRules()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'rules', 'shell.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(filePath)!` in rules.ts back to `path: filePath`.
    // With that corruption, result[0].path comes back as the raw absolute
    // tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadSkills — S6 path relativization', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(
      path.join(skillsDir, 'ship', 'SKILL.md'),
      '---\nname: ship\ndescription: ship a feature\n---\n# ship'
    )

    const result = loadSkills()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'skills', 'ship', 'SKILL.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(skillMd)!` in skills.ts back to `path: skillMd`.
    // With that corruption, result[0].path comes back as the raw absolute
    // tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadAgentMemory — S6 path relativization', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(agentMemoryDir, 'code-reviewer', 'feedback.md'), 'Review notes.')

    const result = loadAgentMemory()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'agent-memory-local', 'code-reviewer', 'feedback.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(filePath)!` in loadAgentMemory() back to
    // `path: filePath`. With that corruption, result[0].path comes back as the
    // raw absolute tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadProjectMemory — S6 path relativization (agent-memory-local source)', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(agentMemoryDir, 'planner', 'my-app.md'), 'Project-specific context.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'agent-memory-local', 'planner', 'my-app.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert the
    // `path: relativizeHome(filePath)!` in loadProjectMemory()'s agent-memory-local
    // block back to `path: filePath`. With that corruption, result[0].path comes
    // back as the raw absolute tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadProjectMemory — S6 path relativization (legacy projects/<proj>/memory source)', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(projectsDir, 'my-proj', 'memory', 'context.md'), 'Legacy project context.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'projects', 'my-proj', 'memory', 'context.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert the
    // `path: relativizeHome(filePath)!` in loadProjectMemory()'s legacy-memory
    // block back to `path: filePath`. With that corruption, result[0].path comes
    // back as the raw absolute tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadPlans — S6 path relativization', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(plansDir, 'my-plan.md'), '# My Plan\nSome content.')

    const result = loadPlans()
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'plans', 'my-plan.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(filePath)!` in loadPlans() back to `path: filePath`.
    // With that corruption, result[0].path comes back as the raw absolute
    // tmpDir-rooted path and both assertions above fail.
  })
})

describe('loadOutputs — S6 path relativization', () => {
  it('returns a ~-prefixed path with no tmpDir (fake-home) leak', () => {
    writeFile(path.join(briefingsDir, '2026-08-01.md'), 'Morning briefing.')

    const result = loadOutputs('briefings')
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(path.join('~', 'briefings', '2026-08-01.md'))
    expect(result[0].path).not.toContain(tmpDir)

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `path: relativizeHome(filePath)!` in loadOutputs() back to `path: filePath`.
    // With that corruption, result[0].path comes back as the raw absolute
    // tmpDir-rooted path and both assertions above fail.
  })
})
