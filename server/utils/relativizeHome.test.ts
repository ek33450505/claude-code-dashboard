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

  // MUTATION TEST (manually verified, not left in the tree): revert the boundary
  // check back to the bare `p.startsWith(home) ? '~' + p.slice(home.length) : p`.
  // With that corruption, 'leaves a sibling directory whose name merely starts
  // with home untouched' fails: relativizeHome('/Users/edward') returns '~ward'
  // instead of the expected '/Users/edward', and the deeper-sibling-path test
  // fails the same way ('~ward/secret' instead of '/Users/edward/secret').
})
