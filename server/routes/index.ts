import { Router } from 'express'
import { agentsRouter } from './agents.js'
import { sessionsRouter } from './sessions.js'
import { memoryRouter } from './memory.js'
import { plansRouter } from './plans.js'
import { configRouter } from './config.js'
import { outputsRouter } from './outputs.js'
import { rulesRouter } from './rules.js'
import { skillsRouter } from './skills.js'
import { commandsRouter } from './commands.js'
import { searchRouter } from './search.js'
import { analyticsRouter } from './analytics.js'
import { routingRouter } from './routing.js'
import { hooksRouter } from './hooks.js'
import { scriptsRouter } from './scripts.js'
import { pluginsRouter } from './plugins.js'
import { keybindingsRouter } from './keybindings.js'
import { launchRouter } from './launch.js'
import { tasksRouter } from './tasks.js'
import { debugRouter } from './debug.js'
import { permissionsRouter } from './permissions.js'
import { agentsLiveRouter } from './agentsLive.js'
import { controlRouter } from './control.js'
import { privacyRouter } from './privacy.js'
import { privacyAuditRouter } from './privacyAudit.js'
import { tokenSpendRouter } from './tokenSpend.js'
import { agentRunsRouter, activeAgentsRouter } from './agentRuns.js'
import { taskQueueRouter } from './taskQueue.js'
import { agentMemoriesDbRouter } from './agentMemoriesDb.js'
import { castdControlRouter } from './castdControl.js'
import { sqliteExplorerRouter } from './sqliteExplorer.js'
import { seedRouter } from './seed.js'
import { hookHealthRouter } from './hookHealth.js'
import { budgetStatusRouter } from './budgetStatus.js'
import { castExecRouter } from './castExec.js'
import { qualityGatesRouter, dispatchDecisionsRouter } from './qualityGates.js'

export const router = Router()

router.use('/agents/live', agentsLiveRouter)
router.use('/agents', agentsRouter)
router.use('/sessions', sessionsRouter)
router.use('/memory', memoryRouter)
router.use('/plans', plansRouter)
router.use('/config', configRouter)
router.use('/outputs', outputsRouter)
router.use('/rules', rulesRouter)
router.use('/skills', skillsRouter)
router.use('/commands', commandsRouter)
router.use('/search', searchRouter)
router.use('/analytics', analyticsRouter)
router.use('/routing', routingRouter)
router.use('/hooks/health', hookHealthRouter)
router.use('/hooks', hooksRouter)
router.use('/scripts', scriptsRouter)
router.use('/plugins', pluginsRouter)
router.use('/keybindings', keybindingsRouter)
router.use('/launch', launchRouter)
router.use('/tasks', tasksRouter)
router.use('/debug', debugRouter)
router.use('/permissions', permissionsRouter)
router.use('/control', controlRouter)
router.use('/privacy/audit', privacyAuditRouter)
router.use('/privacy', privacyRouter)
router.use('/cast/token-spend', tokenSpendRouter)
router.use('/cast/active-agents', activeAgentsRouter)
router.use('/cast/agent-runs', agentRunsRouter)
router.use('/cast/task-queue', taskQueueRouter)
router.use('/cast/memories', agentMemoriesDbRouter)
router.use('/castd', castdControlRouter)
router.use('/cast/explore', sqliteExplorerRouter)
router.use('/cast/seed', seedRouter)

router.use('/budget', budgetStatusRouter)
router.use('/cast', castExecRouter)

router.use('/quality-gates', qualityGatesRouter)
router.use('/dispatch-decisions', dispatchDecisionsRouter)

// Top-level health shortcut
router.get('/health', (req, res, next) => {
  req.url = '/health'
  configRouter(req, res, next)
})
