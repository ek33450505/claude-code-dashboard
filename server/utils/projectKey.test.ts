import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// PROJECTS_DIR is fixed BEFORE `../constants.js` is mocked and projectKey.ts is
// imported below (mirrors server/parsers/pathRelativize.test.ts) — a real tmp
// directory tree stands in for `~/.claude/projects` so tests never depend on,
// or touch, the developer's real home directory or real project list.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-key-'))
const projectsDir = path.join(tmpDir, 'projects')

vi.mock('../constants.js', () => ({
  PROJECTS_DIR: projectsDir,
}))

const { maskProjectKey, resolveProjectKey } = await import('./projectKey.js')

// Fixed fake home injected via os.homedir() spy — never the real one, same
// rationale as relativizeHome.test.ts's FAKE_HOME.
const FAKE_HOME = '/Users/me'
// Encoded form of FAKE_HOME per the ~/.claude/projects/<encoded> convention
// (absolute path with every `/` swapped for `-`).
const ENCODED_HOME = '-Users-me'

function mkProjectDir(name: string) {
  fs.mkdirSync(path.join(projectsDir, name), { recursive: true })
}

beforeEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(projectsDir, { recursive: true })
  vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('maskProjectKey', () => {
  it('masks a leading encoded home to ~', () => {
    expect(maskProjectKey(`${ENCODED_HOME}-Projects-x`)).toBe('~-Projects-x')
  })

  it('masks an encoded home appearing mid-string', () => {
    // Real shape from a scratchpad path nested under /private/tmp: the encoded
    // home shows up embedded partway through the directory name, not at the
    // very start of the string.
    const input = `-private-tmp-claude-501-${ENCODED_HOME}-Projects-personal-claude-agent-team-scratchpad`
    const expected = `-private-tmp-claude-501-~-Projects-personal-claude-agent-team-scratchpad`
    expect(maskProjectKey(input)).toBe(expected)
  })

  it('masks multiple occurrences in one string', () => {
    const input = `${ENCODED_HOME}-a-${ENCODED_HOME}-b`
    expect(maskProjectKey(input)).toBe('~-a-~-b')
  })

  it('leaves a sibling directory whose name merely starts with the encoded home untouched (boundary case)', () => {
    // '-Users-meextra-Projects' is a SIBLING of '-Users-me', not a descendant —
    // without the (?=-|$) lookahead boundary this would wrongly mask into
    // '~extra-Projects'. This is the load-bearing test for the boundary rule.
    expect(maskProjectKey('-Users-meextra-Projects')).toBe('-Users-meextra-Projects')
  })

  it('masks an exact match of the encoded home alone', () => {
    expect(maskProjectKey(ENCODED_HOME)).toBe('~')
  })

  it('returns a string with no encoded home unchanged', () => {
    expect(maskProjectKey('-Users-someoneelse-Projects-x')).toBe('-Users-someoneelse-Projects-x')
  })

  // MUTATION TEST (manually verified, not left in the tree): remove the
  // `(?=-|$)` lookahead from the regex in projectKey.ts (i.e. match the bare
  // encoded home with no boundary check). With that corruption, the boundary
  // test above fails: maskProjectKey('-Users-meextra-Projects') returns
  // '~extra-Projects' instead of the unchanged input.
})

describe('resolveProjectKey', () => {
  it('round-trips a leading-encoded-home style directory name', () => {
    const raw = `${ENCODED_HOME}-Projects-personal-claude-code-dashboard`
    mkProjectDir(raw)
    expect(resolveProjectKey(maskProjectKey(raw))).toBe(raw)
  })

  it('round-trips a mid-string-encoded-home style directory name', () => {
    const raw = `-private-tmp-claude-501-${ENCODED_HOME}-Projects-personal-claude-agent-team-scratchpad`
    mkProjectDir(raw)
    expect(resolveProjectKey(maskProjectKey(raw))).toBe(raw)
  })

  it('accepts a raw (unmasked) key unchanged for backward compatibility', () => {
    const raw = `${ENCODED_HOME}-Projects-personal-claude-code-dashboard`
    mkProjectDir(raw)
    // A pre-existing bookmark/URL carrying the old, un-masked key must still
    // resolve — accepting both raw and masked keys is deliberate.
    expect(resolveProjectKey(raw)).toBe(raw)
  })

  it('returns null for an unknown key', () => {
    mkProjectDir(`${ENCODED_HOME}-Projects-x`)
    expect(resolveProjectKey('~-Projects-does-not-exist')).toBeNull()
  })

  it('returns null for a path-traversal attempt, never escaping PROJECTS_DIR', () => {
    mkProjectDir(`${ENCODED_HOME}-Projects-x`)
    expect(resolveProjectKey('../../etc')).toBeNull()
    expect(resolveProjectKey('../../etc/passwd')).toBeNull()
  })

  it('returns null when PROJECTS_DIR does not exist', () => {
    fs.rmSync(projectsDir, { recursive: true, force: true })
    expect(resolveProjectKey(ENCODED_HOME)).toBeNull()
  })

  it('ignores non-directory entries under PROJECTS_DIR', () => {
    fs.writeFileSync(path.join(projectsDir, `${ENCODED_HOME}-stray-file`), 'not a project dir')
    expect(resolveProjectKey(`${ENCODED_HOME}-stray-file`)).toBeNull()
  })
})
