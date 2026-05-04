import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useDbChangeInvalidation } from './api/useDbChangeInvalidation'

const HomeView = lazy(() => import('./views/HomeView'))
const SessionsView = lazy(() => import('./views/SessionsView'))
const SessionDetailView = lazy(() => import('./views/SessionDetailView'))
const AnalyticsView = lazy(() => import('./views/AnalyticsView'))
const AnalyticsAgentDetailView = lazy(() => import('./views/AnalyticsAgentDetailView'))
const SystemView = lazy(() => import('./views/SystemView'))
const DocsView = lazy(() => import('./views/DocsView'))
const AgentsView = lazy(() => import('./views/AgentsView'))
const SwarmView = lazy(() => import('./views/SwarmView'))
const WorkLogView = lazy(() => import('./views/WorkLogView'))

export default function App() {
  useDbChangeInvalidation()

  return (
    <MotionConfig reducedMotion="user">
      <Layout>
        <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
          <Routes>
            {/* ── Core routes (4 pages + 2 detail routes) ── */}
            <Route path="/" element={<ErrorBoundary><HomeView /></ErrorBoundary>} />
            <Route path="/sessions" element={<ErrorBoundary><SessionsView /></ErrorBoundary>} />
            <Route path="/sessions/:project/:sessionId" element={<ErrorBoundary><SessionDetailView /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary><AnalyticsView /></ErrorBoundary>} />
            <Route path="/analytics/agents/:agent" element={<ErrorBoundary><AnalyticsAgentDetailView /></ErrorBoundary>} />
            <Route path="/system" element={<ErrorBoundary><SystemView /></ErrorBoundary>} />
            <Route path="/docs" element={<ErrorBoundary><DocsView /></ErrorBoundary>} />
            <Route path="/agents" element={<ErrorBoundary><AgentsView /></ErrorBoundary>} />
            <Route path="/swarm" element={<ErrorBoundary><SwarmView /></ErrorBoundary>} />
            <Route path="/work-log" element={<ErrorBoundary><WorkLogView /></ErrorBoundary>} />

            {/* ── Consolidation redirects — old pages redirect to new parents ── */}
            <Route path="/commands" element={<Navigate to="/docs" replace />} />

            <Route path="/activity" element={<Navigate to="/sessions" replace />} />
            <Route path="/dispatch-log" element={<Navigate to="/sessions" replace />} />
            <Route path="/routing" element={<Navigate to="/sessions" replace />} />
            <Route path="/agent-runs" element={<Navigate to="/sessions" replace />} />
            <Route path="/task-queue" element={<Navigate to="/sessions" replace />} />

            <Route path="/token-spend" element={<Navigate to="/analytics" replace />} />
            <Route path="/quality-gates" element={<Navigate to="/analytics" replace />} />

            <Route path="/hooks" element={<Navigate to="/system" replace />} />
            <Route path="/privacy" element={<Navigate to="/system" replace />} />
            <Route path="/db" element={<Navigate to="/system" replace />} />
            <Route path="/castd" element={<Navigate to="/system" replace />} />
            <Route path="/rules" element={<Navigate to="/system" replace />} />
            <Route path="/knowledge" element={<Navigate to="/system" replace />} />
            <Route path="/knowledge/*" element={<Navigate to="/system" replace />} />
            <Route path="/agents/*" element={<Navigate to="/agents" replace />} />
            <Route path="/memory" element={<Navigate to="/system" replace />} />
            <Route path="/plans" element={<Navigate to="/system" replace />} />

            {/* ── Backwards compatibility for old /local-os/ bookmarks ── */}
            <Route path="/local-os/token-spend" element={<Navigate to="/analytics" replace />} />
            <Route path="/local-os/agent-runs" element={<Navigate to="/sessions" replace />} />
            <Route path="/local-os/task-queue" element={<Navigate to="/sessions" replace />} />
            <Route path="/local-os/memory-browser" element={<Navigate to="/system" replace />} />
            <Route path="/local-os/castd" element={<Navigate to="/system" replace />} />
            <Route path="/local-os/sqlite-explorer" element={<Navigate to="/system" replace />} />

            {/* ── 404 catch-all ── */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center p-8">
                <span className="text-5xl font-bold text-[var(--text-muted)]">404</span>
                <p className="text-[var(--text-secondary)]">Page not found</p>
                <Link to="/" className="text-sm text-[var(--accent)] hover:underline">Back to Home</Link>
              </div>
            } />
          </Routes>
        </Suspense>
      </Layout>
    </MotionConfig>
  )
}
