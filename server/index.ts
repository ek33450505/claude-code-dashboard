import express from 'express'
import { PORT } from './constants.js'
import { router } from './routes/index.js'
import { attachSSE } from './watchers/sse.js'

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

app.listen(PORT, () => console.log(`Claude Dashboard server on :${PORT}`))
