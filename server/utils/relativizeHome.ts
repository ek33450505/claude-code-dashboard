import os from 'os'

/**
 * Collapse an absolute path under the server's home directory to a `~`-prefixed
 * one, so API responses don't leak the server's username and directory layout
 * to the client. Only apply this to a path at its RETURN site — never to a copy
 * that is still used for filesystem access (`fs` does not expand `~`).
 */
export function relativizeHome(p: string | undefined): string | undefined {
  if (!p) return p
  // os.homedir() never returns a trailing slash on macOS/Linux, but strip one
  // defensively so a bare `startsWith(home)` below can't happen even if that
  // ever changes — home + '/' must always be a real path-segment boundary.
  const home = os.homedir().replace(/\/+$/, '')
  if (p === home) return '~'
  // Require a '/' boundary, not a bare prefix match: '/Users/edward' is a
  // SIBLING of home '/Users/ed', not a descendant of it, and must stay
  // untouched — a bare `p.startsWith(home)` would mangle it into '~ward'.
  if (p.startsWith(home + '/')) return '~' + p.slice(home.length)
  return p
}
