import { Before, After, setWorldConstructor } from '@cucumber/cucumber'
import { World } from './world.js'
import fs from 'fs'

setWorldConstructor(World)

Before(async function () {
  fs.mkdirSync('screenshots', { recursive: true })
  await this.openBrowser()
})

After(async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    await this.screenshot(`failed_${scenario.pickle.name}`)
  }
  await this.closeBrowser()
})
