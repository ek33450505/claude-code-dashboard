import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

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

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Layout>
        <ErrorBoundary>
        <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
          <Routes>
            {/* ── Core routes ── */}
            <Route path="/" element={<HomeView />} />
            <Route path="/activity" element={<LiveView />} />
            <Route path="/sessions" element={<SessionsView />} />
            <Route path="/sessions/:project/:sessionId" element={<SessionDetailView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/agents" element={<AgentsView />} />
            <Route path="/agents/:name" element={<AgentDetailView />} />
            <Route path="/knowledge" element={<KnowledgeView />} />
            <Route path="/knowledge/plans/:filename" element={<PlanDetailView />} />
            <Route path="/system" element={<SystemView />} />
            <Route path="/routing" element={<RoutingLogView />} />
            <Route path="/privacy" element={<PrivacyView />} />

            {/* ── Analytics drill-down ── */}
            <Route path="/analytics/agents/:agent" element={<AnalyticsAgentDetailView />} />

            {/* ── Flat routes ── */}
            <Route path="/token-spend" element={<TokenSpendView />} />
            <Route path="/hooks" element={<HookHealthView />} />
            <Route path="/memory" element={<MemoryBrowserView />} />
            <Route path="/db" element={<SqliteExplorerView />} />
            <Route path="/plans" element={<PlansView />} />

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
        </ErrorBoundary>
      </Layout>
    </MotionConfig>
  )
}
