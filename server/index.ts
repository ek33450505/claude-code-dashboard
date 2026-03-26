import http from 'http'
import express from 'express'
import fs from 'fs'
import { PORT, DASHBOARD_COMMANDS_DIR } from './constants.js'
import { router } from './routes/index.js'
import { attachSSE } from './watchers/sse.js'
import { attachTerminalWS } from './terminal/wsHandler.js'

// Ensure dashboard commands directory exists before watchers start
fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })

const app = express()
app.use(express.json())

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})
app.options('{*path}', (_req, res) => res.sendStatus(204))

app.use('/api', router)
attachSSE(app)

const httpServer = http.createServer(app)
attachTerminalWS(httpServer)
httpServer.listen(PORT, () => console.log(`Claude Dashboard server on :${PORT}`))
