import { chromium } from 'playwright'
import { setWorldConstructor, World } from '@cucumber/cucumber'

const BASE_URL = 'http://localhost:5173'

class CustomWorld extends World {
  constructor(options) {
    super(options)
    this.baseUrl = BASE_URL
    this.browser = null
    this.context = null
    this.page = null
  }

  async openBrowser() {
    this.browser = await chromium.launch({ headless: true })
    this.context = await this.browser.newContext()
    this.page = await this.context.newPage()
  }

  async closeBrowser() {
    if (this.page) await this.page.close()
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
  }

  /**
   * Navigates to the app and enters the intranet access code so every test
   * starts from an authenticated-intranet state.
   */
  async enterIntranet(code = 'intranet2025') {
    await this.page.goto(this.baseUrl)
    // If the intranet gate is visible, fill in the code
    const input = this.page.locator('input[type="password"]').first()
    if (await input.isVisible()) {
      await input.fill(code)
      await this.page.locator('button[type="submit"]').click()
      await this.page.waitForLoadState('networkidle')
    }
  }
}

setWorldConstructor(CustomWorld)
export { BASE_URL }
