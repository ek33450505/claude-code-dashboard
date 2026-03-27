import { useState } from 'react'
import { Database, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useSqliteTables, useSqliteTable } from '../api/useSqliteExplorer'

const PAGE_SIZE = 50

function truncateCell(value: unknown, maxLen = 120): { display: string; full: string } {
  const full = value === null || value === undefined ? 'NULL' : String(value)
  const display = full.length > maxLen ? `${full.slice(0, maxLen)}…` : full
  return { display, full }
}

export default function SqliteExplorerView() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  const { data: tablesData, isLoading: tablesLoading } = useSqliteTables()
  const { data: tableData, isLoading: tableLoading } = useSqliteTable(selectedTable, { limit: PAGE_SIZE, offset })

  const tables = tablesData?.tables ?? []
  const columns = tableData?.columns ?? []
  const rows = tableData?.rows ?? []
  const total = tableData?.total ?? 0
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function selectTable(t: string) {
    setSelectedTable(t)
    setOffset(0)
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
                key={t}
                onClick={() => selectTable(t)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedTable === t
                    ? 'bg-[var(--accent)] text-[#070A0F]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t}
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
              <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectedTable}
                  <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">{total} rows</span>
                </div>
                {/* Pagination */}
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>
                    {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
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
                {rows.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-sm">Table is empty</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-secondary)]">
                      <tr className="border-b border-[var(--glass-border)]">
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--glass-border)] hover:bg-[var(--accent-subtle)] transition-colors">
                          {columns.map(col => {
                            const { display, full } = truncateCell(row[col])
                            return (
                              <td
                                key={col}
                                className="px-3 py-1.5 text-[var(--text-secondary)] font-mono max-w-[240px]"
                                title={full !== display ? full : undefined}
                              >
                                <span className={full === 'NULL' ? 'opacity-30' : ''}>{display}</span>
                              </td>
                            )
                          })}
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
