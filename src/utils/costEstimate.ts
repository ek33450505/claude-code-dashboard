// Model pricing per million tokens (USD)
// Source: Anthropic API pricing — update when rates change
export const MODEL_RATES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-sonnet-4-5-20250514':  { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4-6-20260320':  { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-3-5-20241022':   { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-haiku-4-5-20251001':   { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-opus-4-20250514':      { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-opus-4-6-20260320':    { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
}

// Fallback: match by model family prefix
const FAMILY_RATES: Record<string, keyof typeof MODEL_RATES> = {
  'claude-sonnet': 'claude-sonnet-4-5-20250514',
  'claude-haiku':  'claude-haiku-3-5-20241022',
  'claude-opus':   'claude-opus-4-20250514',
}

function getRates(model: string) {
  if (MODEL_RATES[model]) return MODEL_RATES[model]
  // Try family prefix match
  for (const [prefix, key] of Object.entries(FAMILY_RATES)) {
    if (model.startsWith(prefix)) return MODEL_RATES[key]
  }
  // Default to sonnet rates
  return MODEL_RATES['claude-sonnet-4-5-20250514']
}

// Returns estimated cost in USD
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  cacheCreation: number,
  cacheRead: number,
  model: string
): number {
  const rates = getRates(model)
  return (
    inputTokens * rates.input +
    outputTokens * rates.output +
    cacheCreation * rates.cacheWrite +
    cacheRead * rates.cacheRead
  ) / 1_000_000
}

// Format token count with K/M suffix
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`
  return String(count)
}

// Format USD cost
export function formatCost(usd: number): string {
  if (usd >= 100) return `$${usd.toFixed(0)}`
  if (usd >= 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4)}`
}
