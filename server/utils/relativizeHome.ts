import os from 'os'

// Escape regex metacharacters in the home directory before building the
// match pattern below — `home` is a filesystem path, not a regex literal,
// and can contain characters like `.` or `+` on some systems.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Collapse every occurrence of the server's home directory in a path to a
 * `~`-prefixed marker, so API responses don't leak the server's username and
 * directory layout to the client. Only apply this to a path at its RETURN
 * site — never to a copy that is still used for filesystem access (`fs`
 * does not expand `~`).
 *
 * Home is masked both when it LEADS the path (`/Users/ed/x` -> `~/x`) and
 * when it appears EMBEDDED mid-string (`/private/tmp/x/Users/ed/y` ->
 * `/private/tmp/x/~/y`) — e.g. sandboxed/temp paths that echo the real
 * username without being descendants of the real home directory. A leading
 * match collapses to `~`; an embedded match collapses to `/~` so the result
 * stays a well-formed path instead of splicing `~` directly onto whatever
 * preceded it.
 */
export function relativizeHome(p: string | undefined): string | undefined {
  if (!p) return p
  // os.homedir() never returns a trailing slash on macOS/Linux, but strip one
  // defensively so a bare boundary check below can't fail even if that ever
  // changes — home + '/' must always be a real path-segment boundary.
  const home = os.homedir().replace(/\/+$/, '')
  if (p === home) return '~'
  // Require a '/' boundary (or end-of-string) after each match, not a bare
  // substring match: '/Users/edward' is a SIBLING of home '/Users/ed', not
  // a descendant of it, and must stay untouched — a bare replace of 'home'
  // would wrongly mangle it into '~ward'. This boundary rule applies at
  // every match position, leading or embedded.
  const pattern = new RegExp(`${escapeRegExp(home)}(?=/|$)`, 'g')
  return p.replace(pattern, (_match, offset: number) => (offset === 0 ? '~' : '/~'))
}
