/**
 * CAST v10 Unit 6, finding #3 — extractCastAgentName() used to do a full
 * fs.readFileSync() on every call. readAgentMeta() calls it whenever a
 * session's identity hasn't resolved to a concrete agentType yet, and
 * readAgentMetaCached() (the caller one level up) only writes to ITS cache
 * `if (meta.agentType)` — so for any generic/non-CAST session (whose first
 * line never matches the CAST-identity regex), that outer cache never fills
 * and this full-file read repeated on every append/idle-tick/change event
 * for the lifetime of the session file.
 *
 * The fix gives extractCastAgentName its own permanent per-file memoization
 * cache (castAgentNameCache in sse.ts), separate from agentMetaCache, safe to
 * cache negatives in because it only ever reads the FIRST LINE of an
 * append-only JSONL log — immutable once written.
 *
 * extractCastAgentName is exported from sse.ts for direct testing, same
 * pattern as readTail/readLastLine in sseReadTail.test.ts. Uses os.tmpdir()
 * (system temp), never $HOME — same convention as sseReadTail.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { extractCastAgentName } from '../watchers/sse.js'

let tmpDir: string | null = null
function writeTemp(content: string): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sse-castname-'))
  const fp = path.join(tmpDir, 'session.jsonl')
  fs.writeFileSync(fp, content)
  return fp
}

afterEach(() => {
  vi.restoreAllMocks()
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

describe('extractCastAgentName — per-file memoization', () => {
  it('caches a non-matching first line: reads the file once, never re-reads for the same path', () => {
    const line = JSON.stringify({
      message: { role: 'user', content: 'hello there, this is not an identity line' },
    })
    const fp = writeTemp(line + '\n')
    const spy = vi.spyOn(fs, 'readFileSync')

    expect(extractCastAgentName(fp)).toBeUndefined()
    expect(spy).toHaveBeenCalledTimes(1)

    // Second call for the same path must NOT re-read the file, and must still
    // return the correct (undefined) result from cache.
    expect(extractCastAgentName(fp)).toBeUndefined()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('caches a matching first line: reads the file once, never re-reads for the same path', () => {
    const line = JSON.stringify({
      message: { role: 'user', content: 'You are the commit agent.' },
    })
    const fp = writeTemp(line + '\n')
    const spy = vi.spyOn(fs, 'readFileSync')

    expect(extractCastAgentName(fp)).toBe('commit')
    expect(spy).toHaveBeenCalledTimes(1)

    expect(extractCastAgentName(fp)).toBe('commit')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not cache on a read error (file missing) — retries on next call', () => {
    const missingPath = path.join(os.tmpdir(), 'sse-castname-does-not-exist', 'nope.jsonl')
    const spy = vi.spyOn(fs, 'readFileSync')

    expect(extractCastAgentName(missingPath)).toBeUndefined()
    expect(extractCastAgentName(missingPath)).toBeUndefined()
    // Both calls attempted a real read (each threw) — neither was served from
    // cache, because a read error must never be memoized (chokidar's 'add' can
    // fire before content is flushed; a later call needs to be able to retry).
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('caches distinct results independently per file path', () => {
    // Self-contained: allocates and cleans up its own two temp dirs rather than
    // relying on the shared `tmpDir`/afterEach helper (which tracks only one dir).
    const firstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sse-castname-'))
    const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sse-castname-'))
    const matchFp = path.join(firstDir, 'session.jsonl')
    const noMatchFp = path.join(secondDir, 'session.jsonl')
    fs.writeFileSync(matchFp, JSON.stringify({ message: { role: 'user', content: 'You are a code-writer agent.' } }) + '\n')
    fs.writeFileSync(noMatchFp, JSON.stringify({ message: { role: 'user', content: 'plain question' } }) + '\n')

    try {
      expect(extractCastAgentName(matchFp)).toBe('code-writer')
      expect(extractCastAgentName(noMatchFp)).toBeUndefined()
      // Re-check both — each must return its own cached value, not bleed into the other.
      expect(extractCastAgentName(matchFp)).toBe('code-writer')
      expect(extractCastAgentName(noMatchFp)).toBeUndefined()
    } finally {
      fs.rmSync(firstDir, { recursive: true, force: true })
      fs.rmSync(secondDir, { recursive: true, force: true })
    }
  })
})
