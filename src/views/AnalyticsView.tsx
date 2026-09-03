import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAnalytics } from '../api/useAnalytics'
import Tabs from '../components/Tabs'
import SectionHeader from '../components/SectionHeader'
import { fadeUpItem } from '../lib/motion'

import QualityGatesPanel from '../components/analytics/QualityGatesPanel'
import MemoryAnalyticsPanel from '../components/analytics/MemoryAnalyticsPanel'
import ToolFailuresPanel from '../components/analytics/ToolFailuresPanel'
import CompactionTimeline from '../components/analytics/CompactionTimeline'
import TokenSpendInline from '../components/analytics/TokenSpendInline'
import CompactionTab from '../components/analytics/CompactionTab'
import AgentsTabPanel from '../components/analytics/AgentsTabPanel'
import RollupsTab from '../components/analytics/RollupsTab'

type AnalyticsTab = 'agents' | 'cost' | 'compaction' | 'rollups'

const ANALYTICS_TABS: { key: AnalyticsTab; label: string }[] = [
  { key: 'agents', label: 'Agents & Usage' },
  { key: 'cost', label: 'Cost & Tokens' },
  { key: 'compaction', label: 'Compaction' },
  { key: 'rollups', label: 'Cost Rollups' },
]

export default function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('agents')
  const { data, isLoading, error } = useAnalytics({ currentMonthOnly: true })

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div><h1 className="text-2xl font-bold">Analytics</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bento-card p-5 animate-pulse">
              <div className="h-8 w-20 bg-[var(--bg-tertiary)] rounded mb-2" />
              <div className="h-4 w-28 bg-[var(--bg-tertiary)] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--error)]/30 px-5 py-4 text-sm text-[var(--error)]">
          Failed to load analytics: {(error as Error).message}
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalTokens = data.totalInputTokens + data.totalOutputTokens

  return (
    <motion.div className="space-y-6" variants={fadeUpItem} initial="hidden" animate="show">
      <SectionHeader
        as="h1"
        kicker="cost & usage"
        title="Analytics"
        icon={<TrendingUp className="w-5 h-5" />}
        description={data.monthPrefix
          ? `Token usage and costs for ${data.monthPrefix} (current billing month)`
          : 'Token usage, costs, and tool breakdown across all sessions'}
      />

      {/* Tab bar + panels */}
      <Tabs
        tabs={ANALYTICS_TABS.map(t => ({ id: t.key, label: t.label }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as AnalyticsTab)}
        ariaLabel="Analytics views"
        idBase="analytics"
      >
      {/* Cost & Tokens tab */}
      {activeTab === 'cost' && <TokenSpendInline />}

      {/* Compaction tab */}
      {activeTab === 'compaction' && <CompactionTab />}

      {/* Cost Rollups tab */}
      {activeTab === 'rollups' && <RollupsTab />}

      {/* Agents & Usage tab */}
      {activeTab === 'agents' && <AgentsTabPanel data={data} totalTokens={totalTokens} />}
      </Tabs>

      {/* CAST Observability Panels — visible on both tabs */}
      <div className="space-y-6 mt-6">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">CAST Observability</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QualityGatesPanel />
          <ToolFailuresPanel />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MemoryAnalyticsPanel />
          <CompactionTimeline />
        </div>
      </div>
    </motion.div>
  )
}
