import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { usePrivacy } from '../api/usePrivacy'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

const TRAFFIC_LIGHT_COLORS: Record<string, string> = {
  green: '#00C950',
  yellow: '#FFC300',
  red: '#FF3B3B',
}

const TRAFFIC_LIGHT_LABELS: Record<string, string> = {
  green: 'All local',
  yellow: 'Cloud (no violations)',
  red: 'Violations detected',
}

export default function PrivacyPanel() {
  const { data, loading, error } = usePrivacy()

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader light={null} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-[var(--text-muted)]">Loading privacy data...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader light={null} />
        <div className="flex-1 flex items-center justify-center p-4">
          <span className="text-xs text-[var(--text-muted)] text-center">
            No audit data yet. Enable the PreToolUse audit hook to start recording.
          </span>
        </div>
      </div>
    )
  }

  const pieData = [
    { name: 'Local', value: data.local_calls },
    { name: 'Cloud', value: data.cloud_calls },
  ]

  const PIE_COLORS = ['#00C950', '#FFC300']

  return (
    <div className="flex flex-col h-full">
      <PanelHeader light={data.traffic_light} />

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-1 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <StatCard label="Total" value={data.total_calls} />
        <StatCard label="Cloud" value={data.cloud_calls} />
        <StatCard label="Local" value={data.local_calls} />
        <StatCard label="Redacted" value={data.redacted_calls} />
        <StatCard
          label="Violations"
          value={data.violations}
          highlight={data.violations > 0 ? 'red' : undefined}
        />
      </div>

      {/* Pie chart + timeline */}
      <div className="flex flex-1 min-h-0">
        {/* Pie chart */}
        {data.total_calls > 0 && (
          <div className="w-28 shrink-0 flex flex-col items-center justify-center py-2">
            <ResponsiveContainer width="100%" height={80}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={36}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    fontSize: 10,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <span className="text-[8px] text-[var(--text-muted)] mt-1">Local/Cloud</span>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          <div
            className="px-3 py-1 text-[7px] text-[var(--text-muted)] uppercase tracking-wider shrink-0"
            style={{ ...PIXEL_FONT, borderBottom: '1px solid var(--border)' }}
          >
            Last 10 Calls
          </div>
          {data.timeline.length === 0 ? (
            <p className="text-xs text-center text-[var(--text-muted)] py-4 px-2">
              No audit entries yet
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.timeline.slice(0, 10).map((entry, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span
                    className="text-[9px] shrink-0 px-1 rounded"
                    style={{
                      background: entry.is_cloud_bound ? 'rgba(255,195,0,0.15)' : 'rgba(0,201,80,0.1)',
                      color: entry.is_cloud_bound ? '#FFC300' : '#00C950',
                    }}
                  >
                    {entry.is_cloud_bound ? 'cloud' : 'local'}
                  </span>
                  <span className="text-[10px] text-[var(--text-primary)] truncate flex-1">
                    {entry.tool_name ?? 'unknown'}
                  </span>
                  {entry.redacted && (
                    <span className="text-[9px] text-[var(--accent)] shrink-0">redacted</span>
                  )}
                  <span className="text-[9px] text-[var(--text-muted)] shrink-0 tabular-nums">
                    {(entry.timestamp ?? '').slice(11, 19)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function PanelHeader({ light }: { light: 'green' | 'yellow' | 'red' | null }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span style={{ ...PIXEL_FONT, fontSize: 9, color: '#00FFC2' }}>PRIVACY</span>
      {light !== null && (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: TRAFFIC_LIGHT_COLORS[light] ?? '#888', boxShadow: `0 0 6px ${TRAFFIC_LIGHT_COLORS[light] ?? '#888'}` }}
          />
          <span className="text-[9px] text-[var(--text-muted)]">{TRAFFIC_LIGHT_LABELS[light]}</span>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: string
}) {
  return (
    <div className="flex flex-col items-center py-1">
      <span
        className="text-sm font-bold tabular-nums"
        style={{ color: highlight === 'red' && value > 0 ? '#FF3B3B' : 'var(--text-primary)' }}
      >
        {value}
      </span>
      <span className="text-[8px] text-[var(--text-muted)] text-center leading-tight mt-0.5">
        {label}
      </span>
    </div>
  )
}
