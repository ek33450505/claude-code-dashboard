import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface GridSquare { id: number; row: number; col: number }

interface AnimatedGridPatternProps {
  numSquares?: number
  maxOpacity?: number
  duration?: number
  repeatDelay?: number
  className?: string
}

export function AnimatedGridPattern({
  numSquares = 30,
  maxOpacity = 0.5,
  duration = 3,
  repeatDelay = 0.5,
  className,
}: AnimatedGridPatternProps) {
  const id = useId()
  const containerRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [squares, setSquares] = useState<GridSquare[]>([])
  const CELL = 40

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!dimensions.width) return
    const cols = Math.ceil(dimensions.width / CELL)
    const rows = Math.ceil(dimensions.height / CELL)
    const all: GridSquare[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        all.push({ id: r * cols + c, row: r, col: c })
      }
    }
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, numSquares)
    setSquares(shuffled)
  }, [dimensions, numSquares])

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
    >
      <defs>
        <pattern id={`grid-${id}`} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(0,255,194,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#grid-${id})`} />
      {squares.map(sq => (
        <motion.rect
          key={sq.id}
          x={sq.col * CELL}
          y={sq.row * CELL}
          width={CELL - 1}
          height={CELL - 1}
          fill="rgba(0,255,194,0.08)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, maxOpacity, 0] }}
          transition={{
            duration,
            repeat: Infinity,
            repeatDelay,
            delay: Math.random() * duration,
            ease: 'easeInOut',
          }}
        />
      ))}
    </svg>
  )
}
