import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
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
const AnalyticsAgentDetailView = lazy(() => import('./views/AnalyticsAgentDetailView'))
const PlansView = lazy(() => import('./views/PlansView'))

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

            {/* ── Analytics drill-down ── */}
            <Route path="/analytics/agents/:agent" element={<ErrorBoundary><AnalyticsAgentDetailView /></ErrorBoundary>} />

            {/* ── Knowledge sub-routes ── */}
            <Route path="/plans" element={<ErrorBoundary><PlansView /></ErrorBoundary>} />

            {/* ── Consolidation redirects — all removed flat pages redirect to parent ── */}
            <Route path="/token-spend" element={<Navigate to="/analytics" replace />} />
            <Route path="/quality-gates" element={<Navigate to="/analytics" replace />} />
            <Route path="/dispatch-log" element={<Navigate to="/activity" replace />} />
            <Route path="/routing" element={<Navigate to="/activity" replace />} />
            <Route path="/agent-runs" element={<Navigate to="/activity" replace />} />
            <Route path="/task-queue" element={<Navigate to="/activity" replace />} />
            <Route path="/hooks" element={<Navigate to="/system" replace />} />
            <Route path="/privacy" element={<Navigate to="/system" replace />} />
            <Route path="/db" element={<Navigate to="/system" replace />} />
            <Route path="/castd" element={<Navigate to="/system" replace />} />
            <Route path="/rules" element={<Navigate to="/knowledge" replace />} />
            <Route path="/memory" element={<Navigate to="/agents" replace />} />

            {/* ── Backwards compatibility for old /local-os/ bookmarks ── */}
            <Route path="/local-os/token-spend" element={<Navigate to="/analytics" replace />} />
            <Route path="/local-os/agent-runs" element={<Navigate to="/activity" replace />} />
            <Route path="/local-os/task-queue" element={<Navigate to="/activity" replace />} />
            <Route path="/local-os/memory-browser" element={<Navigate to="/agents" replace />} />
            <Route path="/local-os/castd" element={<Navigate to="/system" replace />} />
            <Route path="/local-os/sqlite-explorer" element={<Navigate to="/system" replace />} />

            {/* ── 404 catch-all ── */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center p-8">
                <span className="text-5xl font-bold text-[var(--text-muted)]">404</span>
                <p className="text-[var(--text-secondary)]">Page not found</p>
                <Link to="/" className="text-sm text-[var(--accent)] hover:underline">← Back to Home</Link>
              </div>
            } />
          </Routes>
        </Suspense>
      </Layout>
    </MotionConfig>
  )
}
