import { useState } from 'react'
import { X, Plus, Save, XCircle } from 'lucide-react'
import type { AgentDefinition } from '../types'

interface AgentEditFormProps {
  agent?: AgentDefinition
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving?: boolean
  isCreate?: boolean
}

const MODEL_OPTIONS = ['sonnet', 'haiku', 'opus']
const MEMORY_OPTIONS = ['none', 'local']
const COLOR_OPTIONS = [
  'blue', 'red', 'green', 'cyan', 'yellow', 'magenta', 'orange', 'indigo',
  'emerald', 'amber', 'teal', 'lime', 'coral', 'sky', 'silver', 'gold',
  'rose', 'pink', 'bronze', 'navy', 'purple', 'violet',
]

function TagInput({ value, onChange, placeholder }: { value: string[], onChange: (v: string[]) => void, placeholder?: string }) {
  const [input, setInput] = useState('')

  function addTag() {
    const tag = input.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)] border border-[var(--border)]">
            <span className="font-mono">{tag}</span>
            <button onClick={() => onChange(value.filter(t => t !== tag))} className="text-[var(--text-muted)] hover:text-[var(--error)]">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button onClick={addTag} className="px-3 py-2 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] text-sm hover:bg-[var(--accent)]/20 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function AgentEditForm({ agent, onSave, onCancel, saving, isCreate }: AgentEditFormProps) {
  const [name, setName] = useState(agent?.name || '')
  const [model, setModel] = useState(agent?.model || 'sonnet')
  const [color, setColor] = useState(agent?.color || 'blue')
  const [description, setDescription] = useState(agent?.description || '')
  const [tools, setTools] = useState<string[]>(agent?.tools || ['Read', 'Glob', 'Grep'])
  const [disallowedTools, setDisallowedTools] = useState<string[]>(agent?.disallowedTools || [])
  const [maxTurns, setMaxTurns] = useState(agent?.maxTurns ?? 10)
  const [memory, setMemory] = useState(agent?.memory || 'none')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: Record<string, unknown> = { model, color, description, tools, disallowedTools, maxTurns, memory }
    if (isCreate) data.name = name
    onSave(data)
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors'
  const labelClass = 'block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isCreate && (
        <div>
          <label className={labelClass}>Agent Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="my-agent"
            pattern="[a-zA-Z0-9_-]+"
            required
            className={inputClass}
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">Letters, numbers, hyphens, and underscores only.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Model</label>
          <select value={model} onChange={e => setModel(e.target.value)} className={inputClass}>
            {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Color</label>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <select value={color} onChange={e => setColor(e.target.value)} className={inputClass}>
              {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
          placeholder="What does this agent do?"
        />
      </div>

      <div>
        <label className={labelClass}>Tools (allowed)</label>
        <TagInput value={tools} onChange={setTools} placeholder="Add tool name..." />
      </div>

      <div>
        <label className={labelClass}>Disallowed Tools</label>
        <TagInput value={disallowedTools} onChange={setDisallowedTools} placeholder="Add disallowed tool..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Max Turns</label>
          <input type="number" min={1} max={100} value={maxTurns} onChange={e => setMaxTurns(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Memory</label>
          <select value={memory} onChange={e => setMemory(e.target.value)} className={inputClass}>
            {MEMORY_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : isCreate ? 'Create Agent' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium text-sm border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </form>
  )
}
