export interface ParsedWorkLog {
  items: string[]
  filesRead: string[]
  filesChanged: string[]
  codeReviewerResult?: string
  testWriterResult?: string
  decisions: string[]
}

/**
 * Parse a "## Work Log" section out of an assistant message string.
 * Returns null if the section is not present.
 */
export function parseWorkLog(content: string): ParsedWorkLog | null {
  // Find the start of the Work Log section
  const sectionMatch = content.match(/^##\s+Work Log\s*$/im)
  if (!sectionMatch || sectionMatch.index === undefined) return null

  const start = sectionMatch.index + sectionMatch[0].length

  // Find where the section ends: next "##" heading or "Status:" line
  const rest = content.slice(start)
  const endMatch = rest.match(/^(?:##\s|\bStatus\s*:)/im)
  const sectionText = endMatch ? rest.slice(0, endMatch.index) : rest

  const lines = sectionText.split('\n').map(l => l.trim()).filter(Boolean)

  const result: ParsedWorkLog = {
    items: [],
    filesRead: [],
    filesChanged: [],
    decisions: [],
  }

  for (const line of lines) {
    // Strip leading bullet markers (-, *, •)
    const text = line.replace(/^[-*•]\s*/, '').trim()
    if (!text) continue

    result.items.push(text)

    const lower = text.toLowerCase()

    if (lower.startsWith('read:') || lower.startsWith('reads:')) {
      result.filesRead.push(text.replace(/^reads?:\s*/i, '').trim())
    } else if (
      lower.startsWith('wrote:') ||
      lower.startsWith('write:') ||
      lower.startsWith('wrote/edited:') ||
      lower.startsWith('edited:') ||
      lower.startsWith('created:') ||
      lower.startsWith('modified:')
    ) {
      result.filesChanged.push(text.replace(/^(?:wrote\/edited|wrote|write|edited|created|modified):\s*/i, '').trim())
    } else if (lower.startsWith('code-reviewer result:') || lower.startsWith('code-reviewer:')) {
      result.codeReviewerResult = text.replace(/^code-reviewer(?: result)?:\s*/i, '').trim()
    } else if (lower.startsWith('test-writer result:') || lower.startsWith('test-writer:')) {
      result.testWriterResult = text.replace(/^test-writer(?: result)?:\s*/i, '').trim()
    } else if (lower.startsWith('decision:') || lower.startsWith('decisions:')) {
      result.decisions.push(text.replace(/^decisions?:\s*/i, '').trim())
    }
  }

  return result
}
