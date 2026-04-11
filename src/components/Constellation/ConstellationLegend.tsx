// Top-right legend overlay for the Agent Constellation

interface LegendSwatchProps {
  color: string
  label: string
  variant?: 'filled' | 'outline' | 'dim'
}

function Swatch({ color, label, variant = 'filled' }: LegendSwatchProps) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="10" height="10" viewBox="0 0 10 10">
        {variant === 'outline' ? (
          <circle cx="5" cy="5" r="4" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={0.7} />
        ) : (
          <circle
            cx="5"
            cy="5"
            r="4"
            fill={color}
            fillOpacity={variant === 'dim' ? 0.3 : 0.85}
          />
        )}
      </svg>
      <span className="text-[10px] text-white/60 leading-none">{label}</span>
    </div>
  )
}

export function ConstellationLegend() {
  return (
    <div
      className="absolute top-3 right-3 pointer-events-none"
      style={{
        background: 'rgba(10,14,26,0.75)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '8px 10px',
        backdropFilter: 'blur(8px)',
        minWidth: 110,
      }}
    >
      {/* Status */}
      <div className="text-[9px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Status</div>
      <div className="flex flex-col gap-1 mb-2.5">
        <Swatch color="#22d3ee" label="Active" />
        <Swatch color="#22d3ee" label="Recent" variant="dim" />
        <Swatch color="#4b5563" label="Idle" />
        <Swatch color="#374151" label="Dormant" variant="dim" />
      </div>

      {/* Model */}
      <div className="text-[9px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Model</div>
      <div className="flex flex-col gap-1 mb-2.5">
        <Swatch color="#22d3ee" label="Sonnet" />
        <Swatch color="#2dd4bf" label="Haiku" />
        <Swatch color="#a78bfa" label="Opus" />
      </div>

      {/* Task */}
      <div className="text-[9px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Task</div>
      <div className="flex flex-col gap-1">
        <Swatch color="rgba(255,255,255,0.4)" label="Pending" variant="outline" />
        <Swatch color="#22d3ee" label="Active" />
        <Swatch color="#4ade80" label="Done" />
        <Swatch color="#f87171" label="Failed" />
      </div>
    </div>
  )
}
