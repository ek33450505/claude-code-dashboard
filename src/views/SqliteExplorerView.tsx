import { useState } from 'react'
import { Database, ChevronLeft, ChevronRight, Lock, Copy, Search } from 'lucide-react'
import { useSqliteTables, useSqliteTable } from '../api/useSqliteExplorer'

const PAGE_SIZE = 50

const LONG_COLS = new Set(['data', 'result', 'task_summary', 'prompt'])
const JSON_COLS = new Set(['data', 'result', 'prompt'])

function timeAgoFromIso(iso: string): string {
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return iso
  const ms = Date.now() - ts
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

function formatCostCol(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return value
  return `$${n.toFixed(4).replace(/\.?0+$/, '')}`
}

function ModelBadge({ model }: { model: string }) {
  const lower = model.toLowerCase()
  const label = lower.includes('opus') ? 'Opus'
    : lower.includes('haiku') ? 'Haiku'
    : lower.includes('sonnet') ? 'Sonnet'
    : model
  const color = lower.includes('opus')
    ? 'bg-purple-500/20 text-purple-300'
    : lower.includes('haiku')
    ? 'bg-blue-500/20 text-blue-300'
    : lower.includes('sonnet')
    ? 'bg-emerald-500/20 text-emerald-300'
    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function StatusBadge({ value }: { value: string }) {
  const color =
    value === 'DONE' ? 'bg-green-500/20 text-green-300'
    : value === 'DONE_WITH_CONCERNS' ? 'bg-amber-500/20 text-amber-300'
    : value === 'BLOCKED' || value === 'FAILED' ? 'bg-red-500/20 text-red-300'
    : value === 'RUNNING' ? 'bg-blue-500/20 text-blue-300'
    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {value}
    </span>
  )
}

function tryPrettyJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function renderCell(col: string, value: unknown, expanded: boolean, onToggle: () => void): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="opacity-30">NULL</span>
  }
  const str = String(value)

  // Timestamp columns
  if (col.endsWith('_at') || col === 'timestamp') {
    try {
      const rel = timeAgoFromIso(str)
      return <span title={str}>{rel}</span>
    } catch {
      return <span>{str}</span>
    }
  }

  // Status badge
  if (col === 'status') {
    return <StatusBadge value={str} />
  }

  // Cost columns
  if (col.includes('cost') || col.includes('usd')) {
    return <span>{formatCostCol(str)}</span>
  }

  // ID columns — monospace, truncate to 8
  if (col === 'id' || col.endsWith('_id')) {
    const truncated = str.length > 8 ? str.slice(0, 8) : str
    return <span className="font-mono" title={str.length > 8 ? str : undefined}>{truncated}</span>
  }

  // Model column
  if (col === 'model') {
    return <ModelBadge model={str} />
  }

  // JSON columns — pretty-print when expanded
  if (JSON_COLS.has(col) && str.trim().startsWith('{')) {
    const pretty = expanded ? tryPrettyJson(str) : null
    if (expanded) {
      return (
        <span>
          <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">{pretty}</pre>
          <button onClick={onToggle} className="text-[var(--accent)] hover:underline text-xs mt-1 block">
            collapse
          </button>
        </span>
      )
    }
    const preview = str.slice(0, 120)
    return (
      <span>
        {preview}…{' '}
        <button onClick={onToggle} className="text-[var(--accent)] hover:underline text-xs ml-1">
          expand
        </button>
      </span>
    )
  }

  // Long content columns or long values
  if (LONG_COLS.has(col) || str.length > 200) {
    if (expanded) {
      return (
        <span>
          {str}{' '}
          <button
            onClick={onToggle}
            className="text-[var(--accent)] hover:underline text-xs ml-1"
          >
            collapse
          </button>
        </span>
      )
    }
    const preview = str.slice(0, 120)
    return (
      <span>
        {preview}…{' '}
        <button
          onClick={onToggle}
          className="text-[var(--accent)] hover:underline text-xs ml-1"
        >
          expand
        </button>
      </span>
    )
  }

  return <span>{str}</span>
}

export default function SqliteExplorerView() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [copiedRow, setCopiedRow] = useState<number | null>(null)
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set())

  const { data: tablesData, isLoading: tablesLoading } = useSqliteTables()
  const { data: tableData, isLoading: tableLoading } = useSqliteTable(selectedTable, { limit: PAGE_SIZE, offset })

  // Normalize: handle both old string[] and new {name, rowCount}[] API shapes
  const rawTables = (tablesData?.tables ?? []).map(t =>
    typeof t === 'string' ? { name: t, rowCount: -1 } : t
  )
  // Sort: non-empty tables first (by rowCount desc), then empty ones
  const tables = [...rawTables].sort((a, b) => {
    if (a.rowCount > 0 && b.rowCount === 0) return -1
    if (a.rowCount === 0 && b.rowCount > 0) return 1
    return b.rowCount - a.rowCount
  })

  const allColumns = tableData?.columns ?? []
  const nullColumns = new Set(tableData?.nullColumns ?? [])
  // Filter out all-NULL columns
  const columns = allColumns.filter(col => !nullColumns.has(col))

  const rows = tableData?.rows ?? []
  const total = tableData?.total ?? 0
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filteredRows = search.trim()
    ? rows.filter(row =>
        columns.some(col => {
          const v = row[col]
          return v !== null && v !== undefined && String(v).toLowerCase().includes(search.toLowerCase())
        })
      )
    : rows

  function selectTable(t: string) {
    setSelectedTable(t)
    setOffset(0)
    setSearch('')
    setExpandedCells(new Set())
  }

  function toggleCell(rowIdx: number, col: string) {
    const key = `${rowIdx}:${col}`
    setExpandedCells(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function copyRow(row: Record<string, unknown>, idx: number) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2))
      setCopiedRow(idx)
      setTimeout(() => setCopiedRow(null), 1500)
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">DB Explorer</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Read-only view of cast.db</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-xs text-[var(--text-muted)]">
          <Lock className="w-3 h-3" />
          Read-only
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Table sidebar */}
        <div className="w-44 shrink-0 bento-card p-3 overflow-y-auto">
          <div className="text-xs font-semibold text-[var(--text-muted)] px-2 mb-2">TABLES</div>
          {tablesLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-7 rounded bg-[var(--bg-secondary)] animate-pulse" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] px-2">No tables found</div>
          ) : (
            tables.map(t => (
              <button
                key={t.name}
                onClick={() => selectTable(t.name)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedTable === t.name
                    ? 'bg-[var(--accent)] text-[#070A0F]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
                } ${t.rowCount === 0 ? 'opacity-40' : ''}`}
              >
                <span className="truncate block">{t.name}</span>
                <span className={`text-[10px] font-normal ${selectedTable === t.name ? 'text-[#070A0F]/60' : 'text-[var(--text-muted)]'}`}>
                  {t.rowCount >= 0 ? `${t.rowCount.toLocaleString()} rows` : ''}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Table content */}
        <div className="flex-1 bento-card overflow-hidden flex flex-col">
          {!selectedTable ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
              <div className="text-center">
                <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <div className="font-medium">Select a table</div>
                <div className="text-sm mt-1">Click a table name from the sidebar</div>
              </div>
            </div>
          ) : tableLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-[var(--text-muted)]">Loading...</div>
            </div>
          ) : (
            <>
              {/* Table header info */}
              <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-[var(--text-primary)] shrink-0">
                  {selectedTable}
                  <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">{total} rows</span>
                </div>
                {/* Column search */}
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search rows..."
                      className="w-full pl-7 pr-3 py-1 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  {search.trim() && (
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {filteredRows.length} of {rows.length} rows
                    </span>
                  )}
                </div>
                {/* Pagination */}
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] shrink-0">
                  <span>
                    {total === 0 ? '0' : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`} of {total}
                  </span>
                  <button
                    onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="p-1 rounded hover:bg-[var(--accent-subtle)] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>{currentPage}/{totalPages}</span>
                  <button
                    onClick={() => setOffset(o => o + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= total}
                    className="p-1 rounded hover:bg-[var(--accent-subtle)] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Data table */}
              <div className="flex-1 overflow-auto">
                {total === 0 ? (
                  <div className="flex-1 flex items-center justify-center h-full">
                    <div className="text-center text-[var(--text-muted)]">
                      <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <div className="text-sm font-medium">No data in {selectedTable}</div>
                      <div className="text-xs mt-1 opacity-60">This table is empty</div>
                    </div>
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                    No rows match your search
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-secondary)]">
                      <tr className="border-b border-[var(--glass-border)]">
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, i) => (
                        <tr
                          key={i}
                          className="relative border-b border-[var(--glass-border)] hover:bg-[var(--accent-subtle)] transition-colors group"
                        >
                          {columns.map(col => (
                            <td
                              key={col}
                              className="px-3 py-1.5 text-[var(--text-secondary)] max-w-[240px]"
                            >
                              {renderCell(col, row[col], expandedCells.has(`${i}:${col}`), () => toggleCell(i, col))}
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => copyRow(row, i)}
                              title="Copy row as JSON"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--accent-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              {copiedRow === i ? (
                                <span className="text-[10px] text-green-400">Copied</span>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
