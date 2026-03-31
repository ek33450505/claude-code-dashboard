import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Check, FileText } from 'lucide-react'

interface RuleListItem {
  filename: string
  name?: string
}

interface RuleDetail {
  filename: string
  body: string
}

async function fetchRulesList(): Promise<RuleListItem[]> {
  const res = await fetch('/api/rules')
  if (!res.ok) throw new Error('Failed to fetch rules')
  return res.json()
}

async function fetchRule(filename: string): Promise<RuleDetail> {
  const res = await fetch(`/api/rules/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error('Failed to fetch rule')
  return res.json()
}

export default function RulesView() {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [editBody, setEditBody] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle')

  const listQuery = useQuery({
    queryKey: ['rules'],
    queryFn: fetchRulesList,
    staleTime: 30_000,
  })

  const detailQuery = useQuery({
    queryKey: ['rules', selectedFile],
    queryFn: () => fetchRule(selectedFile!),
    enabled: !!selectedFile,
    staleTime: 10_000,
  })

  function handleSelectFile(filename: string) {
    if (filename === selectedFile) return
    setSelectedFile(filename)
    setSaveStatus('idle')
    // Pre-fill edit body when detail loads
    setEditBody('')
  }

  // Sync editBody when detail loads for selected file
  const detailBody = detailQuery.data?.body ?? ''
  const currentBody = editBody !== '' || detailQuery.isFetching ? editBody : detailBody

  function handleBodyChange(val: string) {
    setEditBody(val)
    setSaveStatus('idle')
  }

  async function handleSave() {
    if (!selectedFile) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch(`/api/rules/${encodeURIComponent(selectedFile)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: currentBody }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveStatus('ok')
      queryClient.invalidateQueries({ queryKey: ['rules', selectedFile] })
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const rules = listQuery.data ?? []

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
          Rules
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          View and edit rule files from ~/.claude/rules/
        </p>
      </div>

      {listQuery.isLoading && (
        <div className="grid grid-cols-4 gap-4 h-[60vh]">
          <div className="bento-card animate-pulse" />
          <div className="col-span-3 bento-card animate-pulse" />
        </div>
      )}

      {listQuery.error && (
        <div className="bento-card p-6 text-[var(--error)] text-sm">
          Failed to load rules. Make sure the dashboard server is running.
        </div>
      )}

      {!listQuery.isLoading && !listQuery.error && rules.length === 0 && (
        <div className="bento-card p-10 text-center text-[var(--text-muted)]">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No rule files found</div>
          <div className="text-sm mt-1">Add .md files to ~/.claude/rules/ to see them here.</div>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.error && rules.length > 0 && (
        <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
          {/* Left panel — file list */}
          <div className="w-52 shrink-0 bento-card overflow-y-auto">
            <div className="px-3 py-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Files ({rules.length})
              </span>
            </div>
            <ul role="listbox" aria-label="Rule files">
              {rules.map((rule) => (
                <li key={rule.filename}>
                  <button
                    role="option"
                    aria-selected={selectedFile === rule.filename}
                    onClick={() => handleSelectFile(rule.filename)}
                    className={`w-full text-left px-3 py-2.5 text-xs font-mono truncate transition-colors border-b border-[var(--border)] last:border-0 ${
                      selectedFile === rule.filename
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={rule.filename}
                  >
                    {rule.name ?? rule.filename}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Right panel — editor */}
          <div className="flex-1 bento-card flex flex-col overflow-hidden">
            {!selectedFile ? (
              <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                <div className="text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">Select a file to edit</div>
                </div>
              </div>
            ) : (
              <>
                {/* Editor toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] shrink-0">
                  <span className="text-xs font-mono text-[var(--text-muted)]">{selectedFile}</span>
                  <div className="flex items-center gap-2">
                    {saveStatus === 'ok' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        Saved
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-xs text-rose-400">Save failed</span>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving || detailQuery.isLoading}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--accent)] text-[#070A0F] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                      aria-label={`Save ${selectedFile}`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Textarea */}
                {detailQuery.isLoading ? (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
                    Loading...
                  </div>
                ) : (
                  <textarea
                    value={editBody !== '' ? editBody : detailBody}
                    onChange={e => handleBodyChange(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full resize-none font-mono text-xs text-[var(--text-primary)] bg-transparent p-4 focus:outline-none leading-relaxed"
                    aria-label={`Edit ${selectedFile}`}
                    placeholder="File content..."
                    onFocus={() => {
                      // Ensure editBody is seeded from detail when first focused
                      if (editBody === '' && detailBody) setEditBody(detailBody)
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
