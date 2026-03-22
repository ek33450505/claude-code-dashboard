/**
 * PixelSprite — renders a 2D color grid as a pixelated 8-bit character.
 * Each cell in the grid is a hex color string or '' for transparent.
 */

interface PixelSpriteProps {
  grid: string[][]
  scale?: number
  className?: string
}

export function PixelSprite({ grid, scale = 3, className }: PixelSpriteProps) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

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
      {grid.flat().map((color, i) => (
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
