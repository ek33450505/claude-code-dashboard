import { describe, it, expect, vi, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import { relativizeHome } from './relativizeHome.js'

// Fixed fake home injected via os.homedir() spy — never the real one. Without
// this, the sibling-path cases below are unprovable on a machine whose real
// username happens not to collide with the fixture, and every other case
// would pass or fail depending on whose machine runs the suite.
const FAKE_HOME = '/Users/ed'

describe('relativizeHome', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('collapses a path under the home directory to a ~-prefixed one', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('/Users/ed/Projects/x')).toBe('~/Projects/x')
  })

  it('collapses an exact home-directory match to ~ (no trailing content)', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('/Users/ed')).toBe('~')
  })

  it('leaves a sibling directory whose name merely starts with home untouched', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    // '/Users/edward' is a SIBLING of '/Users/ed', not a descendant — a bare
    // startsWith(home) would wrongly mangle this into '~ward'.
    expect(relativizeHome('/Users/edward')).toBe('/Users/edward')
  })

  it('leaves a deeper path under a sibling directory untouched', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('/Users/edward/secret')).toBe('/Users/edward/secret')
  })

  it('leaves a path outside the home directory untouched', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('/var/log/syslog')).toBe('/var/log/syslog')
  })

  it('is idempotent — an already-~-prefixed input passes through unchanged', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('~/already')).toBe('~/already')
  })

  it('passes through a non-absolute (relative) input unchanged', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('relative/path.md')).toBe('relative/path.md')
  })

  it('handles a trailing slash on os.homedir() as a defensive case', () => {
    // os.homedir() never actually returns a trailing slash on macOS/Linux —
    // this guards against it anyway, since checking `home + '/'` would
    // otherwise become `home + '//'` and fail to match.
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/ed/')
    expect(relativizeHome('/Users/ed/Projects')).toBe('~/Projects')
  })

  it('passes through undefined', () => {
    expect(relativizeHome(undefined)).toBeUndefined()
  })

  it('passes through an empty string', () => {
    expect(relativizeHome('')).toBe('')
  })

  it('collapses a real os.homedir()-rooted path (no spy — sanity check against the real value)', () => {
    const home = os.homedir()
    const abs = path.join(home, '.claude', 'agents', 'code-writer.md')
    expect(relativizeHome(abs)).toBe(path.join('~', '.claude', 'agents', 'code-writer.md'))
  })

  it('masks an embedded (non-leading) occurrence of home mid-path', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    // Sandboxed/temp paths can echo the real username without being
    // descendants of the real home directory — e.g. '/private/tmp/claude-501/Users/edkubiak/...'.
    expect(relativizeHome('/private/tmp/x/Users/ed/Projects/y')).toBe('/private/tmp/x/~/Projects/y')
  })

  it('masks multiple embedded occurrences of home in one path', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('/tmp/a/Users/ed/b/Users/ed/c')).toBe('/tmp/a/~/b/~/c')
  })

  it('leaves a sibling directory embedded mid-path untouched (boundary preserved for embedded case too)', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    // Load-bearing: an embedded 'Users/ed' immediately followed by more
    // characters (not '/' or end-of-string) is a sibling, not home, and must
    // not be masked — same boundary rule as the leading case.
    expect(relativizeHome('/private/tmp/x/Users/edextra/y')).toBe('/private/tmp/x/Users/edextra/y')
  })

  it('masks both a leading and an embedded occurrence in the same path', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    expect(relativizeHome('/Users/ed/Projects/Users/ed/nested')).toBe('~/Projects/~/nested')
  })

  // MUTATION TEST (manually verified, not left in the tree): remove the
  // `(?=/|$)` boundary lookahead from the pattern in relativizeHome.ts so it
  // becomes `new RegExp(escapeRegExp(home), 'g')`. With that corruption, both
  // 'leaves a sibling directory whose name merely starts with home untouched'
  // and 'leaves a sibling directory embedded mid-path untouched' FAIL:
  // relativizeHome('/Users/edward') returns '~ward' instead of the expected
  // '/Users/edward', and relativizeHome('/private/tmp/x/Users/edextra/y')
  // returns '/private/tmp/x/~extra/y' instead of the unchanged input.
  // Restoring the lookahead makes both pass again.
})
