import { BeforeAll, AfterAll, Before, After } from '@cucumber/cucumber'
import { request as playwrightRequest } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend')
export const TEST_PORT = parseInt(process.env.TEST_PORT || '3099', 10)

let serverProcess = null

/** Poll /health until the test server responds or timeout. */
async function waitForServer(port, maxMs = 15000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
          res.resume()
          resolve()
        })
        req.on('error', reject)
        req.setTimeout(800, () => { req.destroy(); reject(new Error('timeout')) })
      })
      return
    } catch {
      await new Promise(r => setTimeout(r, 400))
    }
  }
  throw new Error(`Test server on port ${port} did not start within ${maxMs}ms`)
}

// Start the test server once before all scenarios.
BeforeAll(async function () {
  if (serverProcess) return

  serverProcess = spawn('node', ['test-server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, TEST_PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout.on('data', d => process.stdout.write(`[api-server] ${d}`))
  serverProcess.stderr.on('data', d => process.stderr.write(`[api-server] ${d}`))

  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[api-server] exited with code ${code}`)
    }
    serverProcess = null
  })

  await waitForServer(TEST_PORT)
})

AfterAll(async function () {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    await new Promise(r => setTimeout(r, 500))
    serverProcess = null
  }
})

// Per-scenario setup for @api tests.
Before({ tags: '@api' }, async function () {
  this.apiBaseUrl = `http://localhost:${TEST_PORT}`
  this.apiContext = await playwrightRequest.newContext({ baseURL: this.apiBaseUrl })
  this.savedValues = {}
  this.lastApiResponse = null
  // Reset server state so every scenario starts clean.
  await this.apiContext.post('/test/reset')
})

After({ tags: '@api' }, async function () {
  if (this.apiContext) {
    await this.apiContext.dispose()
    this.apiContext = null
  }
})
