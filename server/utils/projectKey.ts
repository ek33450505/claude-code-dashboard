import fs from 'fs'
import os from 'os'
import { PROJECTS_DIR } from '../constants.js'
import { relativizeHome } from './relativizeHome.js'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The `~/.claude/projects/<encoded>` directory-name encoding is the absolute
// path with every `/` swapped for `-` (see server/parsers/projectPath.ts's
// decodeProjectPath, which reverses it). So the encoded form of the server's
// own home directory is just that same swap applied to os.homedir().
function encodedHome(): string {
  return os.homedir().replace(/\/+$/, '').replaceAll('/', '-')
}

/**
 * Mask every occurrence of the encoded home directory inside `s` with `~`, so
 * `projectEncoded` values (and any other string built from them) don't leak
 * the server's username. Unlike relativizeHome() — which only ever strips a
 * LEADING `$HOME` prefix off a real filesystem path — the encoded home can
 * appear both at the START and in the MIDDLE of a projectEncoded string (e.g.
 * `-private-tmp-claude-501--Users-me-...-scratchpad`), so this replaces ALL
 * occurrences, not just a prefix.
 *
 * Boundary rule (the encoded analogue of relativizeHome's `/` check): only
 * substitute where the encoded home is followed by `-` or end-of-string.
 * Without it, home `-Users-ed` would wrongly mangle the sibling
 * `-Users-edward-Projects` into `~ward-Projects` — same failure mode
 * relativizeHome's comment documents for the unencoded form.
 */
export function maskProjectKey(s: string): string {
  const home = encodedHome()
  if (!home) return s
  const pattern = new RegExp(`${escapeRegExp(home)}(?=-|$)`, 'g')
  return s.replace(pattern, '~')
}

/**
 * The standard redaction for any filesystem path returned to a client.
 *
 * A path can leak the username twice over: as a real home prefix
 * (/Users/alice/...) and inside Claude Code's encoded project-directory names
 * (-Users-alice-Projects-...), which appear in the BODY of otherwise-relativized
 * paths like ~/.claude/projects/-Users-alice-Projects-x/<id>.jsonl. Applying only
 * one of the two leaves the path half-redacted, which is how this shipped —
 * relativizeHome() alone strips the leading prefix but leaves the encoded
 * segment mid-string untouched; maskProjectKey() alone never looks at a raw,
 * unencoded leading prefix. Composing both closes both leak shapes at once.
 *
 * Use this at every response/broadcast boundary that returns a path. Never apply
 * it to a value still used for filesystem access — `fs` does not expand `~`.
 *
 * null/undefined/empty pass through unchanged, matching relativizeHome()'s own
 * falsy-passthrough behavior.
 */
export function redactPath(p: string | null | undefined): string | null | undefined {
  if (p == null || p === '') return p
  return maskProjectKey(relativizeHome(p) ?? p)
}

/**
 * Resolve a client-supplied project key back to the real, raw directory name
 * under PROJECTS_DIR. Does NOT attempt a blind string reversal of
 * maskProjectKey (masking is lossy — you can't tell `~` apart from a literal
 * `~` some other way without a lookup). Instead resolves by exact lookup
 * against the real directory listing: an entry matches if its raw name
 * equals `key`, OR if `maskProjectKey(rawName)` equals `key`. Accepting both
 * is deliberate for backward compatibility — an existing bookmark/URL/search
 * result carrying a pre-masking raw key still resolves.
 *
 * Fails closed: returns null for an unknown key (including any path-traversal
 * attempt, since it never leaves the lookup — a value like `../../etc` simply
 * won't match any directory entry) and for a missing/unreadable PROJECTS_DIR.
 */
export function resolveProjectKey(key: string): string | null {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === key || maskProjectKey(entry.name) === key) {
      return entry.name
    }
  }
  return null
}
