import { useQuery, type UseQueryResult } from '@tanstack/react-query'

/**
 * Query params serialisable into a URL's search string. Nullish values are
 * omitted from the URL rather than serialised as the literal string
 * "null"/"undefined".
 */
export type ResourceParams = Record<string, string | number | boolean | undefined | null>

export interface ResourceHookConfig<TResponse, TData = TResponse> {
  /** API path, e.g. '/api/incidents'. Used both for the fetch and the error message. */
  path: string
  /** Base query key, e.g. ['incidents']. Params passed to the hook are appended automatically. */
  queryKey: unknown[]
  /** Transform the parsed JSON response before it's returned from the hook. Defaults to identity. */
  select?: (data: TResponse) => TData
  staleTime?: number
  refetchInterval?: number
  refetchIntervalInBackground?: boolean
}

function buildUrl(path: string, params?: ResourceParams): string {
  if (!params) return path
  const url = new URL(path, window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value))
  }
  return url.pathname + url.search
}

/**
 * Factory for simple single-endpoint GET query hooks.
 *
 * Replaces three inconsistent hand-rolled error dialects that had
 * accumulated across src/api/* (`API error ${status}`, `API error ${status}:
 * ${url}`, and bespoke strings like `Failed to fetch quality gate stats`)
 * with one dialect, and gives every hook one place to set
 * query-key/staleTime/refetchInterval policy.
 */
export function createResourceHook<TResponse, TData = TResponse>(
  config: ResourceHookConfig<TResponse, TData>
) {
  const { path, queryKey, select, staleTime, refetchInterval, refetchIntervalInBackground } = config
  return function useResource(params?: ResourceParams): UseQueryResult<TData, Error> {
    return useQuery<TResponse, Error, TData>({
      queryKey: params ? [...queryKey, params] : queryKey,
      queryFn: async () => {
        const url = buildUrl(path, params)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
        return res.json() as Promise<TResponse>
      },
      select,
      staleTime,
      refetchInterval,
      refetchIntervalInBackground,
    })
  }
}
