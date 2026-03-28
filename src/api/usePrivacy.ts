import { useQuery } from '@tanstack/react-query'

export interface PrivacyAuditEntry {
  timestamp?: string
  session_id?: string
  tool_name?: string
  is_cloud_bound?: boolean
  redacted?: boolean
  redacted_count?: number
  url?: string
  query?: string
  command_preview?: string
}

export interface PrivacyData {
  total_calls: number
  cloud_calls: number
  local_calls: number
  redacted_calls: number
  violations: number
  traffic_light: 'green' | 'yellow' | 'red'
  timeline: PrivacyAuditEntry[]
  top_tools: Array<{ tool: string; count: number }>
  last_updated: string
}

async function fetchPrivacy(): Promise<PrivacyData> {
  const res = await fetch('/api/privacy')
  if (!res.ok) throw new Error('Failed to fetch privacy data')
  return res.json()
}

export function usePrivacy() {
  const query = useQuery<PrivacyData>({
    queryKey: ['privacy'],
    queryFn: fetchPrivacy,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  })

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  }
}

// ---- /api/privacy/audit ----

export interface AuditRecentEntry {
  timestamp: string
  session_id: string
  tool: string
  destination: 'cloud' | 'local'
  redacted: boolean
}

export interface PrivacyAuditData {
  total_calls: number
  cloud_calls: number
  local_calls: number
  redaction_events: number
  recent: AuditRecentEntry[]
  cloud_pct: number
}

async function fetchPrivacyAudit(): Promise<PrivacyAuditData> {
  const res = await fetch('/api/privacy/audit')
  if (!res.ok) throw new Error('Failed to fetch privacy audit data')
  return res.json()
}

export function usePrivacyAudit() {
  const query = useQuery<PrivacyAuditData>({
    queryKey: ['privacy-audit'],
    queryFn: fetchPrivacyAudit,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  })

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  }
}
