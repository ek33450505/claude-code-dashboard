import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
  size?: number
}

export default function CopyButton({ text, className = '', size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied
        ? <Check className="text-[var(--accent)]" style={{ width: size, height: size }} />
        : <Copy className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" style={{ width: size, height: size }} />
      }
    </button>
  )
}
