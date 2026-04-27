#!/usr/bin/env node
'use strict'

// ---------------------------------------------------------------------------
//  scripts/run-backend-tests.cjs
//
//  Orchestrates the backend Cucumber API suite with line-coverage:
//    1. Starts the backend under c8 on port 3001.
//    2. Waits for /health to become available.
//    3. Runs `cucumber-js --tags @api`.
//    4. Sends SIGTERM so the backend exits cleanly and c8 can produce its
//       text + lcov report.
//    5. Propagates the c8 exit code so a failed --check-coverage threshold
//       (default: lines >= 90, override with COVERAGE_THRESHOLD; set =0 to
//       skip the check) makes the script fail too.
//
//  Requires Node >= 20 (for global fetch) and a running PostgreSQL with
//  the schema/seeds already applied (see `npm run db:setup` in backend/).
// ---------------------------------------------------------------------------

const { spawn } = require('node:child_process')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..')
const BACKEND_PORT = process.env.PORT || '3001'
const HEALTH_URL = `http://localhost:${BACKEND_PORT}/health`
const THRESHOLD = process.env.COVERAGE_THRESHOLD === undefined
  ? 90
  : Number(process.env.COVERAGE_THRESHOLD)

function waitForHealth(timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(HEALTH_URL)
        if (r.ok) return resolve()
      } catch { /* ignored */ }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Backend no respondió a ${HEALTH_URL} en ${timeoutMs}ms`))
      }
      setTimeout(tick, 500)
    }
    tick()
  })
}

function spawnPromise(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('exit', (code, signal) => resolve({ code, signal, child }))
  })
}

async function main() {
  // 1) Start backend under c8 (c8 manages its own coverage tmp dir).
  // We deliberately set DNI_ENCRYPTION_KEY so that the dni-encryption
  // branches in backend/utils/dniEncryption.js are exercised end-to-end
  // by the test suite; otherwise those code paths would be dead code at
  // test time (the no-key fallback is used).
  const env = {
    ...process.env,
    AUTH_SECRET: process.env.AUTH_SECRET || 'test_secret',
    DNI_ENCRYPTION_KEY: process.env.DNI_ENCRYPTION_KEY
      || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    PORT: BACKEND_PORT,
  }
  console.log('[run-backend-tests] starting backend under c8…')
  const c8Reporters = THRESHOLD > 0
    ? ['--reporter=text', '--reporter=text-summary', '--reporter=lcov',
       '--check-coverage', `--lines=${THRESHOLD}`]
    : ['--reporter=text', '--reporter=text-summary', '--reporter=lcov']
  const backend = spawn(
    path.join(REPO_ROOT, 'node_modules', '.bin', 'c8'),
    [
      ...c8Reporters,
      '--include=backend/**',
      '--exclude=backend/db/**',
      '--exclude=backend/data/**',
      '--exclude=backend/node_modules/**',
      // mailer.js depends on a real SMTP service (nodemailer transport).
      // Without working SMTP credentials its delivery branches are not
      // reachable from black-box HTTP tests, so we exclude it from the
      // coverage thresholding.
      '--exclude=backend/services/mailer.js',
      'node', 'backend/server.js',
    ],
    {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    }
  )

  let cleanedUp = false
  let backendExitInfo = { code: null, signal: null }
  const backendExited = new Promise((resolve) => {
    backend.once('exit', (code, signal) => {
      backendExitInfo = { code, signal }
      resolve()
    })
  })
  const stopBackend = async () => {
    if (cleanedUp) return backendExited
    cleanedUp = true
    // SIGTERM lets Node flush the V8 coverage profile to disk and lets c8
    // produce its report. Force-kill after a grace period if needed.
    backend.kill('SIGTERM')
    const killer = setTimeout(() => { try { backend.kill('SIGKILL') } catch { /* */ } }, 8000)
    killer.unref()
    return backendExited
  }
  process.on('SIGINT', () => stopBackend().then(() => process.exit(130)))
  process.on('SIGTERM', () => stopBackend().then(() => process.exit(143)))

  try {
    await waitForHealth()
  } catch (err) {
    console.error('[run-backend-tests] error de arranque:', err.message)
    await stopBackend()
    process.exit(1)
  }

  // 2) Run cucumber tagged @api.
  const cuc = await spawnPromise(
    process.execPath,
    [
      path.join('node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js'),
      '--tags', '@api',
    ],
    { cwd: REPO_ROOT, env: process.env }
  )

  // 3) Stop backend → c8 generates its report and applies the threshold check.
  await stopBackend()

  if (cuc.code !== 0) {
    console.error(`[run-backend-tests] cucumber-js falló con código ${cuc.code}`)
    process.exit(cuc.code || 1)
  }

  // 4) Propagate c8's own exit code (non-zero when --check-coverage fails).
  if (backendExitInfo.code !== null && backendExitInfo.code !== 0) {
    console.error(`[run-backend-tests] c8 falló con código ${backendExitInfo.code} (¿umbral de cobertura no alcanzado?)`)
    process.exit(backendExitInfo.code)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[run-backend-tests] error inesperado:', err)
  process.exit(1)
})
