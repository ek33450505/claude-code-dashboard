import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useDbChangeInvalidation } from './api/useDbChangeInvalidation'

const HomeView = lazy(() => import('./views/HomeView'))
const LiveView = lazy(() => import('./views/LiveView'))
const SessionsView = lazy(() => import('./views/SessionsView'))
const SessionDetailView = lazy(() => import('./views/SessionDetailView'))
const AnalyticsView = lazy(() => import('./views/AnalyticsView'))
const AgentsView = lazy(() => import('./views/AgentsView'))
const AgentDetailView = lazy(() => import('./views/AgentDetailView'))
const KnowledgeView = lazy(() => import('./views/KnowledgeView'))
const PlanDetailView = lazy(() => import('./views/PlanDetailView'))
const SystemView = lazy(() => import('./views/SystemView'))
const RoutingLogView = lazy(() => import('./views/RoutingLogView'))
const PrivacyView = lazy(() => import('./views/PrivacyView'))
const TokenSpendView = lazy(() => import('./views/TokenSpendView'))
const MemoryBrowserView = lazy(() => import('./views/MemoryBrowserView'))
const SqliteExplorerView = lazy(() => import('./views/SqliteExplorerView'))
const HookHealthView = lazy(() => import('./views/HookHealthView'))
const AnalyticsAgentDetailView = lazy(() => import('./views/AnalyticsAgentDetailView'))
const PlansView = lazy(() => import('./views/PlansView'))
const RulesView = lazy(() => import('./views/RulesView'))

export default function App() {
  useDbChangeInvalidation()

  return (
    <MotionConfig reducedMotion="user">
      <Layout>
        <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
          <Routes>
            {/* ── Core routes ── */}
            <Route path="/" element={<ErrorBoundary><HomeView /></ErrorBoundary>} />
            <Route path="/activity" element={<ErrorBoundary><LiveView /></ErrorBoundary>} />
            <Route path="/sessions" element={<ErrorBoundary><SessionsView /></ErrorBoundary>} />
            <Route path="/sessions/:project/:sessionId" element={<ErrorBoundary><SessionDetailView /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary><AnalyticsView /></ErrorBoundary>} />
            <Route path="/agents" element={<ErrorBoundary><AgentsView /></ErrorBoundary>} />
            <Route path="/agents/:name" element={<ErrorBoundary><AgentDetailView /></ErrorBoundary>} />
            <Route path="/knowledge" element={<ErrorBoundary><KnowledgeView /></ErrorBoundary>} />
            <Route path="/knowledge/plans/:filename" element={<ErrorBoundary><PlanDetailView /></ErrorBoundary>} />
            <Route path="/system" element={<ErrorBoundary><SystemView /></ErrorBoundary>} />
            <Route path="/dispatch-log" element={<ErrorBoundary><RoutingLogView /></ErrorBoundary>} />
            <Route path="/routing" element={<Navigate to="/dispatch-log" replace />} />
            <Route path="/privacy" element={<ErrorBoundary><PrivacyView /></ErrorBoundary>} />

            {/* ── Analytics drill-down ── */}
            <Route path="/analytics/agents/:agent" element={<ErrorBoundary><AnalyticsAgentDetailView /></ErrorBoundary>} />

            {/* ── Flat routes ── */}
            <Route path="/token-spend" element={<ErrorBoundary><TokenSpendView /></ErrorBoundary>} />
            <Route path="/hooks" element={<ErrorBoundary><HookHealthView /></ErrorBoundary>} />
            <Route path="/memory" element={<ErrorBoundary><MemoryBrowserView /></ErrorBoundary>} />
            <Route path="/db" element={<ErrorBoundary><SqliteExplorerView /></ErrorBoundary>} />
            <Route path="/plans" element={<ErrorBoundary><PlansView /></ErrorBoundary>} />
            <Route path="/rules" element={<ErrorBoundary><RulesView /></ErrorBoundary>} />

            {/* ── Redirect aliases — Phase 9: consolidation redirects ── */}
            {/* Phase 9.75b: AgentRunsView, TaskQueueView, CastdControlView were deleted — */}
            {/* they were unreachable stubs; functionality lives in LiveView and SystemView */}
            <Route path="/castd" element={<Navigate to="/system" replace />} />
            <Route path="/agent-runs" element={<Navigate to="/activity" replace />} />
            <Route path="/task-queue" element={<Navigate to="/activity" replace />} />

            {/* ── Redirect aliases — backwards compatibility for old /local-os/ bookmarks ── */}
            <Route path="/local-os/token-spend" element={<Navigate to="/token-spend" replace />} />
            <Route path="/local-os/agent-runs" element={<Navigate to="/activity" replace />} />
            <Route path="/local-os/task-queue" element={<Navigate to="/activity" replace />} />
            <Route path="/local-os/memory-browser" element={<Navigate to="/memory" replace />} />
            <Route path="/local-os/castd" element={<Navigate to="/system" replace />} />
            <Route path="/local-os/sqlite-explorer" element={<Navigate to="/db" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </MotionConfig>
  )
}
