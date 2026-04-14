import { chromium } from 'playwright'

export class World {
  constructor() {
    this.browser = null
    this.context = null
    this.page = null
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5173'
  }

  async openBrowser() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
    })
    this.page = await this.context.newPage()
  }

  async closeBrowser() {
    await this.browser?.close()
  }

  async screenshot(name) {
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const path = `screenshots/${safeName}.png`
    await this.page.screenshot({ path, fullPage: true })
    return path
  }

  /** Navigate to the main page and wait for it to be ready. */
  async grantIntranetAccess() {
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' })
  }
}
