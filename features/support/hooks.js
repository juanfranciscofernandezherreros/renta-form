import { Before, After, setWorldConstructor } from '@cucumber/cucumber'
import { World } from './world.js'
import fs from 'fs'

setWorldConstructor(World)

Before({ tags: 'not @api' }, async function () {
  fs.mkdirSync('screenshots', { recursive: true })
  await this.openBrowser()
})

After({ tags: 'not @api' }, async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    await this.screenshot(`failed_${scenario.pickle.name}`)
  }
  await this.closeBrowser()
})
