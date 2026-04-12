import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')

let devServer = null

/**
 * Start the Vite dev server once before all scenarios and kill it after.
 * We wait until the server prints its "Local:" message before proceeding.
 */
BeforeAll({ timeout: 60000 }, async () => {
  await new Promise((res, rej) => {
    devServer = spawn('npm', ['run', 'dev', '--', '--port', '5173', '--strictPort'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const onData = (data) => {
      const text = data.toString()
      if (text.includes('localhost:5173') || text.includes('Local:')) {
        res()
      }
    }

    devServer.stdout.on('data', onData)
    devServer.stderr.on('data', onData)
    devServer.on('error', rej)

    // Fallback: give the server 15 seconds even without the expected message
    setTimeout(res, 15000)
  })
})

AfterAll(async () => {
  if (devServer) {
    devServer.kill('SIGTERM')
    devServer = null
  }
})

/** Open a browser page before each scenario */
Before(async function () {
  await this.openBrowser()
})

/** Close the browser page after each scenario */
After(async function () {
  await this.closeBrowser()
})
