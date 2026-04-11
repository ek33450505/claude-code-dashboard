import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { TeammateRun } from '../../types'

interface TokenChartProps {
  teammates: TeammateRun[]
}

const ACCENT = 'var(--accent)'
const ACCENT_DIM = 'rgba(0,255,194,0.4)'

export function TokenChart({ teammates }: TokenChartProps) {
  const data = teammates
    .map(t => ({
      role:   t.agent_role,
      tokens: t.tokens_in + t.tokens_out,
    }))
    .filter(d => d.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-[var(--text-muted)]">
        No token data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(60, data.length * 32)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
        />
        <YAxis
          type="category"
          dataKey="role"
          width={100}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--glass-border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
          formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
        />
        <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? ACCENT : ACCENT_DIM} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
