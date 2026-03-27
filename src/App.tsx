import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
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
const AgentRunsView = lazy(() => import('./views/AgentRunsView'))
const TaskQueueView = lazy(() => import('./views/TaskQueueView'))
const MemoryBrowserView = lazy(() => import('./views/MemoryBrowserView'))
const CastdControlView = lazy(() => import('./views/CastdControlView'))
const SqliteExplorerView = lazy(() => import('./views/SqliteExplorerView'))

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Layout>
        <ErrorBoundary>
        <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
          <Routes>
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
            <Route path="/local-os/token-spend" element={<TokenSpendView />} />
            <Route path="/local-os/agent-runs" element={<AgentRunsView />} />
            <Route path="/local-os/task-queue" element={<TaskQueueView />} />
            <Route path="/local-os/memory-browser" element={<MemoryBrowserView />} />
            <Route path="/local-os/castd" element={<CastdControlView />} />
            <Route path="/local-os/sqlite-explorer" element={<SqliteExplorerView />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </Layout>
    </MotionConfig>
  )
}
