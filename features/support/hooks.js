import { Before, After, setWorldConstructor } from '@cucumber/cucumber'
import { World } from './world.js'
import fs from 'fs'

setWorldConstructor(World)

// Scenarios tagged with @api are pure HTTP backend tests and don't need a
// browser. We skip the (slow) Playwright launch for them and avoid creating
// the screenshots directory unnecessarily.
function isApiOnly(scenario) {
  const tags = scenario?.pickle?.tags ?? []
  return tags.some((t) => t.name === '@api')
}

Before(async function (scenario) {
  if (isApiOnly(scenario)) return
  fs.mkdirSync('screenshots', { recursive: true })
  await this.openBrowser()
})

After(async function (scenario) {
  if (isApiOnly(scenario)) return
  if (scenario.result?.status === 'FAILED') {
    await this.screenshot(`failed_${scenario.pickle.name}`)
  }
  await this.closeBrowser()
})
