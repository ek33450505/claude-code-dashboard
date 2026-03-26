import { useQuery } from '@tanstack/react-query'
import type { KeybindingContext } from '../types'
import { apiFetch } from './apiFetch'

export function useKeybindings() {
  return useQuery<KeybindingContext[]>({
    queryKey: ['keybindings'],
    queryFn: () => apiFetch<KeybindingContext[]>('/api/keybindings'),
    staleTime: 60_000,
  })
}
