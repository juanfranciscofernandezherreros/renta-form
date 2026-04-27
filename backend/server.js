'use strict'

// ---------------------------------------------------------------------------
//  Renta Form – Backend API server (PostgreSQL)
// ---------------------------------------------------------------------------

const fs = require('fs')
const path = require('path')
const express = require('express')
const config = require('./config')

// ── Service layer ──────────────────────────────────────────────────────────
const svc = require('./services/dbService')

// ── Express app ────────────────────────────────────────────────────────────
const app = express()

// Trust Heroku's load balancer / reverse proxy so that rate limiters and
// IP-detection middleware (express-rate-limit) work correctly.
app.set('trust proxy', 1)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Request logger (info-level on every endpoint) ─────────────────────────
// Logs method, URL, query, sanitized body on entry, and status + duration
// on completion. Sensitive fields (passwords, tokens) are masked.
const SENSITIVE_KEYS = new Set([
  'password', 'oldpassword', 'newpassword', 'passwordhash', 'password_hash',
  'token', 'authorization', 'secret', 'apikey', 'api_key',
])

function sanitize(value) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '***' : sanitize(v)
    }
    return out
  }
  return value
}

app.use((req, res, next) => {
  const start = Date.now()
  const { method, originalUrl, query, body } = req
  const safeQuery = query && Object.keys(query).length ? sanitize(query) : undefined
  const safeBody = body && typeof body === 'object' && Object.keys(body).length
    ? sanitize(body)
    : undefined
  console.info(
    `[req] ${method} ${originalUrl}` +
      (safeQuery ? ` query=${JSON.stringify(safeQuery)}` : '') +
      (safeBody ? ` body=${JSON.stringify(safeBody)}` : '')
  )
  res.on('finish', () => {
    const ms = Date.now() - start
    console.info(`[res] ${method} ${originalUrl} -> ${res.statusCode} (${ms}ms)`)
  })
  next()
})

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth')
const irpfRoutes = require('./routes/irpf')
const adminRoutes = require('./routes/admin')
const publicRoutes = require('./routes/public')

app.use('/v1/auth', authRoutes(svc))
app.use('/v1/irpf', irpfRoutes(svc))
app.use('/v1/admin', adminRoutes(svc))
app.use('/v1/public', publicRoutes(svc))

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

// Retry the migration up to MAX_RETRIES times with exponential back-off.
// On Heroku the database container sometimes isn't fully ready when the dyno
// first starts, causing a transient ECONNREFUSED that resolves within seconds.
const MAX_RETRIES = 5
const RETRY_BASE_MS = 2000

async function migrateWithRetry(attempt = 1) {
  try {
    await migrate()
  } catch (err) {
    const msg = err.message || err.code || String(err)
    if (attempt >= MAX_RETRIES) {
      console.error(`[migrate] Migration failed after ${MAX_RETRIES} attempts, aborting startup:`, err)
      process.exit(1)
    }
    const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
    console.warn(`[migrate] Attempt ${attempt} failed (${msg}). Retrying in ${delay}ms…`)
    await new Promise((resolve) => setTimeout(resolve, delay))
    return migrateWithRetry(attempt + 1)
  }
}

migrateWithRetry().then(startListening)
