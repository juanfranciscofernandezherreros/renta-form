'use strict'

// ---------------------------------------------------------------------------
//  Renta Form – Backend API server
//
//  Profiles (PROFILE env var):
//    mock  – in-memory data (default, no DB required)
//    db    – PostgreSQL via the pg driver
//
//  Usage:
//    PROFILE=mock node server.js      # or: npm run start:mock
//    PROFILE=db   node server.js      # or: npm run start:db
// ---------------------------------------------------------------------------

const express = require('express')
const cors = require('cors')
const config = require('./config')

console.log(`[server] Starting with profile: ${config.PROFILE}`)

// ── Service layer ──────────────────────────────────────────────────────────
const svc = config.isMock
  ? require('./services/mockService')
  : require('./services/dbService')

// ── Express app ────────────────────────────────────────────────────────────
const app = express()

app.use(
  cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', profile: config.PROFILE, time: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth')
const irpfRoutes = require('./routes/irpf')
const adminRoutes = require('./routes/admin')

app.use('/v1/auth', authRoutes(svc))
app.use('/v1/irpf', irpfRoutes(svc))
app.use('/v1/admin', adminRoutes(svc))

// ── 404 catch-all ────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ── Global error handler ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────
function startListening() {
  app.listen(config.PORT, () => {
    console.log(`[server] Listening on http://localhost:${config.PORT}  (profile: ${config.PROFILE})`)
  })
}

if (config.isDb) {
  const migrate = require('./db/migrate')
  migrate()
    .then(startListening)
    .catch((err) => {
      console.error('[migrate] Migration failed, aborting startup:', err)
      process.exit(1)
    })
} else {
  startListening()
}
