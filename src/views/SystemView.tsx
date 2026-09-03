import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Clock, GitBranch, DollarSign,
  ShieldCheck, Server
} from 'lucide-react'
import { useState } from 'react'
import { useSystemHealth } from '../api/useSystem'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import Tabs from '../components/Tabs'
import SectionHeader from '../components/SectionHeader'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUpItem } from '../lib/motion'
import AgentsTab from '../components/system/AgentsTab'
import RulesTab from '../components/system/RulesTab'
import SkillsTab from '../components/system/SkillsTab'
import MemoryTab from '../components/system/MemoryTab'
import PlansTab from '../components/system/PlansTab'
import CronTab from '../components/system/CronTab'
import ChainMapTab from '../components/system/ChainMapTab'
import PoliciesTab from '../components/system/PoliciesTab'
import PricingTab from '../components/system/PricingTab'
import ControlSurface from '../components/system/ControlSurface'
import HealthSignalsSection from '../components/system/HealthSignalsSection'
import CostSummaryCard from '../components/system/CostSummaryCard'
import IntegrityTab from '../components/system/IntegrityTab'

// ── Tab types ──────────────────────────────────────────────────────────────

type SystemTab = 'agents' | 'rules' | 'skills' | 'memory' | 'plans' | 'cron' | 'chains' | 'policies' | 'pricing' | 'integrity'

const SYSTEM_TABS: { key: SystemTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'agents',    label: 'Agents',    icon: Users },
  { key: 'rules',     label: 'Rules',     icon: Shield },
  { key: 'skills',    label: 'Skills',    icon: Zap },
  { key: 'memory',    label: 'Memory',    icon: Brain },
  { key: 'plans',     label: 'Plans',     icon: FileText },
  { key: 'cron',      label: 'Cron',      icon: Clock },
  { key: 'chains',    label: 'Chain Map', icon: GitBranch },
  { key: 'policies',  label: 'Policies',  icon: Shield },
  { key: 'pricing',   label: 'Pricing',   icon: DollarSign },
  { key: 'integrity', label: 'Integrity', icon: ShieldCheck },
]

// ── Main SystemView ────────────────────────────────────────────────────────

export default function SystemView() {
  const [activeTab, setActiveTab] = useState<SystemTab>('agents')
  const { data: health, isLoading } = useSystemHealth()

  const statCards = health
    ? [
        { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" /> },
        { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" /> },
        { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" /> },
        { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" />, to: '/sessions' },
      ]
    : []

  return (
    <div>
      <SectionHeader
        as="h1"
        kicker="control plane"
        title="System"
        icon={<Server className="w-5 h-5" />}
        description="CAST internals — agents, rules, skills, memory, DB, and control surface."
      />

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {statCards.map(stat => (
            <motion.div key={stat.label} variants={fadeUpItem} className="h-full">
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Cost Summary card — preferred cost source (see TODO in CostSummaryCard component) */}
      <div className="mb-6">
        <CostSummaryCard />
      </div>

      {/* Tab bar */}
      <Tabs
        tabs={SYSTEM_TABS.map(t => ({ id: t.key, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as SystemTab)}
        ariaLabel="System sections"
        idBase="system"
        className="mb-6"
        panelClassName="min-h-[400px]"
      >
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'cron' && <CronTab />}
        {activeTab === 'chains' && <ChainMapTab />}
        {activeTab === 'policies' && <PoliciesTab />}
        {activeTab === 'pricing' && <PricingTab />}
        {activeTab === 'integrity' && <IntegrityTab />}
      </Tabs>

      {/* Health Signals — agent truncations */}
      <HealthSignalsSection />

      {/* Control surface — gated behind CAST_DASHBOARD_CONTROL */}
      <ControlSurface />
    </div>
  )
}
