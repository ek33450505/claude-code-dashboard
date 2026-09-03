import { createResourceHook } from './createResourceHook'

export interface TokenSpendDaily {
  date: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface TokenSpendTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

export interface TokenSpendData {
  daily: TokenSpendDaily[]
  totals: TokenSpendTotals
}

export const useTokenSpend = createResourceHook<TokenSpendData>({
  path: '/api/cast/token-spend',
  queryKey: ['cast', 'token-spend'],
  staleTime: 60_000,
})
