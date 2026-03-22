import { useQuery } from '@tanstack/react-query'
import type { OutputFile } from '../types'

type OutputCategory = 'briefings' | 'meetings' | 'reports' | 'email-summaries'

async function fetchOutputs(category: OutputCategory): Promise<OutputFile[]> {
  const res = await fetch(`/api/outputs/${category}`)
  if (!res.ok) throw new Error(`Failed to fetch ${category}`)
  return res.json()
}

export const useOutputs = (category: OutputCategory) =>
  useQuery({
    queryKey: ['outputs', category],
    queryFn: () => fetchOutputs(category),
  })
