import { useQuery } from '@tanstack/react-query'
import { createResourceHook } from './createResourceHook'

export interface SqliteTableMeta {
  name: string
  rowCount: number
}

export interface SqliteTablesData {
  tables: SqliteTableMeta[]
}

export interface SqliteTableData {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  nullColumns: string[]
}

async function fetchSqliteTables(): Promise<SqliteTablesData> {
  const res = await fetch('/api/cast/explore/tables')
  if (!res.ok) throw new Error('Failed to fetch tables')
  return res.json()
}

export const useSqliteTables = () =>
  useQuery({
    queryKey: ['cast', 'explore', 'tables'],
    queryFn: fetchSqliteTables,
    staleTime: 10_000,
  })

export const useSqliteTable = createResourceHook<SqliteTableData>({
  path: (params) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const qs = searchParams.toString()
    return `/api/cast/explore/${params?.table}${qs ? `?${searchParams}` : ''}`
  },
  queryKey: ['cast', 'explore', 'table'],
  enabled: (params) => !!params?.table,
  staleTime: 30_000,
})
