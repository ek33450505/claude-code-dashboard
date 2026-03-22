import { useQuery } from '@tanstack/react-query'

export function usePermissions() {
  return useQuery<{ allow: string[]; deny: string[]; sandbox: object | null }>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await fetch('/api/permissions')
      if (!res.ok) throw new Error('Failed to fetch permissions')
      return res.json()
    },
    staleTime: 60_000,
  })
}
