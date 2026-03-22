import { useRef, type ReactNode } from 'react'
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from 'framer-motion'

interface MovingBorderProps {
  children: ReactNode
  duration?: number
  className?: string
  containerClassName?: string
  borderRadius?: string
}

export function MovingBorder({
  children,
  duration = 2000,
  className = '',
  containerClassName = '',
  borderRadius = '16px',
}: MovingBorderProps) {
  const pathRef = useRef<SVGRectElement>(null)
  const progress = useMotionValue<number>(0)

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength?.()
    if (length) {
      const pxPerMs = length / duration
      progress.set((time * pxPerMs) % length)
    }
  })

  const x = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val)?.x ?? 0)
  const y = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val)?.y ?? 0)
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <div className={`relative overflow-hidden p-[1px] ${containerClassName}`} style={{ borderRadius }}>
      <div className="absolute inset-0" style={{ borderRadius }}>
        <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%">
          <rect fill="none" width="100%" height="100%" rx={borderRadius} ry={borderRadius} ref={pathRef as React.Ref<SVGRectElement>} />
        </svg>
        <motion.div
          style={{ position: 'absolute', top: 0, left: 0, width: '80px', height: '80px', transform }}
          className="bg-[radial-gradient(circle_at_center,rgba(0,255,194,0.6)_0,transparent_60%)]"
        />
      </div>
      <div className={`relative ${className}`} style={{ borderRadius }}>
        {children}
      </div>
    </div>
  )
}
