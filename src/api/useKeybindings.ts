import { useQuery } from '@tanstack/react-query'
import type { KeybindingContext } from '../types'

export function useKeybindings() {
  return useQuery<KeybindingContext[]>({
    queryKey: ['keybindings'],
    queryFn: async () => {
      const res = await fetch('/api/keybindings')
      if (!res.ok) throw new Error('Failed to fetch keybindings')
      return res.json()
    },
    staleTime: 60_000,
  })
}
