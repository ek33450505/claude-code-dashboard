import { useQuery, type UseQueryResult } from '@tanstack/react-query'

/**
 * Query params serialisable into a URL's search string. Nullish values are
 * omitted from the URL rather than serialised as the literal string
 * "null"/"undefined".
 */
export type ResourceParams = Record<string, string | number | boolean | undefined | null>

export interface ResourceHookConfig<TResponse, TData = TResponse> {
  /**
   * API path, e.g. '/api/incidents'. Used both for the fetch and the error
   * message. May instead be a function of the hook's params that returns the
   * COMPLETE url including any query string — in that case the factory does
   * NOT auto-append params to the url (the function owns url construction
   * and encoding entirely; params still drive the queryKey and `enabled`).
   */
  path: string | ((params?: ResourceParams) => string)
  /** Base query key, e.g. ['incidents']. Params passed to the hook are appended automatically. */
  queryKey: unknown[]
  /** Transform the parsed JSON response before it's returned from the hook. Defaults to identity. */
  select?: (data: TResponse) => TData
  staleTime?: number
  refetchInterval?: number
  refetchIntervalInBackground?: boolean
  /** Passed through to useQuery. Omitted entirely when not set (preserves useQuery's own default). */
  enabled?: boolean | ((params?: ResourceParams) => boolean)
}

function buildUrl(path: string, params?: ResourceParams): string {
  if (!params) return path
  const url = new URL(path, window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value))
  }
  return url.pathname + url.search
}

function resolveUrl(path: string | ((params?: ResourceParams) => string), params?: ResourceParams): string {
  if (typeof path === 'function') return path(params)
  return buildUrl(path, params)
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
  const { path, queryKey, select, staleTime, refetchInterval, refetchIntervalInBackground, enabled } = config
  return function useResource(params?: ResourceParams): UseQueryResult<TData, Error> {
    const resolvedEnabled = typeof enabled === 'function' ? enabled(params) : enabled
    return useQuery<TResponse, Error, TData>({
      queryKey: params ? [...queryKey, params] : queryKey,
      queryFn: async () => {
        const url = resolveUrl(path, params)
        const res = await fetch(url)
        // String paths keep today's dialect exactly (raw config path, no
        // query string). Function paths use the resolved url since the
        // config value itself isn't a meaningful url.
        const errorPath = typeof path === 'function' ? url : path
        if (!res.ok) throw new Error(`API error ${res.status}: ${errorPath}`)
        return res.json() as Promise<TResponse>
      },
      select,
      staleTime,
      refetchInterval,
      refetchIntervalInBackground,
      ...(enabled !== undefined ? { enabled: resolvedEnabled } : {}),
    })
  }
}
