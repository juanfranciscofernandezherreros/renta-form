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

  /** Grant intranet access via sessionStorage (avoids filling the gate form each time). */
  async grantIntranetAccess() {
    await this.page.goto(this.baseUrl)
    await this.page.evaluate(() => {
      sessionStorage.setItem('renta_form_intranet', 'true')
    })
    await this.page.reload({ waitUntil: 'networkidle' })
  }
}
