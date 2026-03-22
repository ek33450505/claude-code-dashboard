import { useRef, useState, type ReactNode, type MouseEvent } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  spotlightColor?: string
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(0, 255, 194, 0.08)',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos(null)}
      className={`relative overflow-hidden ${className}`}
      style={{
        '--spotlight-x': pos ? `${pos.x}px` : '50%',
        '--spotlight-y': pos ? `${pos.y}px` : '50%',
        '--spotlight-color': spotlightColor,
      } as React.CSSProperties}
    >
      {pos && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(300px circle at var(--spotlight-x) var(--spotlight-y), var(--spotlight-color), transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  )
}
