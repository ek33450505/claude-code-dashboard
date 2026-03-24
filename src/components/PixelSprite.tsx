/**
 * PixelSprite — renders a 2D color grid as a pixelated 8-bit character.
 * Each cell in the grid is a hex color string or '' for transparent.
 *
 * Supports optional multi-frame animation via the `frames` prop.
 * When `frames` is not provided, renders `grid` statically (backward compatible).
 */
import { useState, useEffect } from 'react'

export type AnimationState = 'idle' | 'working' | 'reacting'

interface PixelSpriteProps {
  grid: string[][]
  frames?: Partial<Record<AnimationState, string[][][]>>
  animationState?: AnimationState
  animationSpeed?: number   // ms per frame, default 400
  scale?: number
  className?: string
}

export function PixelSprite({
  grid,
  frames,
  animationState = 'idle',
  animationSpeed = 400,
  scale = 3,
  className,
}: PixelSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0)
  const [currentState, setCurrentState] = useState<AnimationState>(animationState)

  const stateFrames = frames?.[currentState]
  const hasFrames = stateFrames && stateFrames.length > 1

  useEffect(() => {
    const sf = frames?.[currentState]
    if (!sf || sf.length <= 1) return
    const id = setInterval(() => {
      setFrameIndex(i => (i + 1) % sf.length)
    }, animationSpeed)
    return () => clearInterval(id)
  }, [frames, currentState, animationSpeed])

  // Handle 'reacting': play once then return to idle
  useEffect(() => {
    setFrameIndex(0)
    setCurrentState(animationState)

    if (animationState !== 'reacting') return
    const reactFrames = frames?.reacting
    if (!reactFrames) return
    const totalDuration = reactFrames.length * animationSpeed
    const timer = setTimeout(() => setCurrentState('idle'), totalDuration)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- state-change driven; frames/speed are stable per mount
  }, [animationState])

  const activeGrid = stateFrames?.[frameIndex] ?? grid
  const rows = activeGrid.length
  const cols = activeGrid[0]?.length ?? 0

  if (rows === 0 || cols === 0) return null

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${scale}px)`,
        width: cols * scale,
        height: rows * scale,
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    >
      {activeGrid.flat().map((color, i) => (
        <div
          key={i}
          style={{
            width: scale,
            height: scale,
            backgroundColor: color || 'transparent',
          }}
        />
      ))}
    </div>
  )
}
