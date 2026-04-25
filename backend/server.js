'use strict'

// ---------------------------------------------------------------------------
//  Renta Form – Backend API server (PostgreSQL)
// ---------------------------------------------------------------------------

const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const config = require('./config')

// ── Service layer ──────────────────────────────────────────────────────────
const svc = require('./services/dbService')

// ── Express app ────────────────────────────────────────────────────────────
const app = express()

// Trust Heroku's load balancer / reverse proxy so that rate limiters and
// IP-detection middleware (express-rate-limit) work correctly.
app.set('trust proxy', 1)

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
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth')
const irpfRoutes = require('./routes/irpf')
const adminRoutes = require('./routes/admin')

app.use('/v1/auth', authRoutes(svc))
app.use('/v1/irpf', irpfRoutes(svc))
app.use('/v1/admin', adminRoutes(svc))

// ── Public alias: GET /v1/preguntas → same catalog as GET /v1/irpf/preguntas ─
app.get('/v1/preguntas', async (_req, res) => {
  const result = await svc.getPreguntas()
  if (result.error) {
    return res.status(result.status || 503).json({ error: result.error.message })
  }
  res.json(result.data)
})

// ── 404 catch-all / SPA fallback ─────────────────────────────────────────
const DIST_DIR = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST_DIR)) {
  // Serve the built React app and let the client-side router handle paths.
  app.use(express.static(DIST_DIR))
  app.get('*', (req, res) => {
    // Return JSON 404 for unmatched API paths; serve the SPA for everything else.
    if (req.path.startsWith('/v1/')) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.sendFile('index.html', { root: DIST_DIR })
  })
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
}

// ── Global error handler ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────
function startListening() {
  app.listen(config.PORT, () => {
    console.log(`[server] Listening on http://localhost:${config.PORT}`)
  })
}

const migrate = require('./db/migrate')
migrate()
  .then(startListening)
  .catch((err) => {
    console.error('[migrate] Migration failed, aborting startup:', err)
    process.exit(1)
  })
