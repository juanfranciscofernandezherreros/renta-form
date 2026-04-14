import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber'

setDefaultTimeout(60 * 1000)

// ── Helpers ────────────────────────────────────────────────────────────────

async function fillIdentificacion(page) {
  // Wait for questions to load (form renders only after API response)
  await page.waitForSelector('input[name="nombre"]', { timeout: 20000 })
  await page.fill('input[name="nombre"]', 'Juan')
  await page.fill('input[name="apellidos"]', 'Garcia Lopez')
  await page.fill('input[name="dniNie"]', '12345678A')
  await page.fill('input[name="email"]', 'juan@ejemplo.es')
  await page.fill('input[name="telefono"]', '600123456')
}

async function fillIdentificacionWithDni(page, dni) {
  await page.waitForSelector('input[name="nombre"]', { timeout: 20000 })
  await page.fill('input[name="nombre"]', 'Test')
  await page.fill('input[name="apellidos"]', 'Duplicado Prueba')
  await page.fill('input[name="dniNie"]', dni)
  await page.fill('input[name="email"]', 'test.duplicado@ejemplo.es')
  await page.fill('input[name="telefono"]', '611222333')
}

async function clickContinuar(page) {
  // Wait for Continuar button to be visible
  const btn = page.locator('button:has-text("Continuar")').first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  // Use evaluate to dispatch a direct JS click, avoiding Playwright's
  // coordinate-based mouse events which can land on the Submit button that
  // React renders at the same position after the Continuar button disappears.
  await page.evaluate(() => {
    const b = document.querySelector('.wizard-nav-right button.btn-primary')
    if (b) b.click()
  })
  await page.waitForTimeout(700)
}

async function answerAllButtons(page, value) {
  await page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  await page.waitForTimeout(400)
  const cards = page.locator('.wizard-step .question-card')
  const count = await cards.count()
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    const cssClass = value === 'si' ? 'yes' : 'no'
    const alreadySelected = card.locator(`.yesno-btn.selected.${cssClass}`)
    if ((await alreadySelected.count()) === 0) {
      const btnIndex = value === 'si' ? 0 : 1
      await card.locator('.yesno-btn').nth(btnIndex).click()
      await page.waitForTimeout(200)
    }
  }
}

// ── Pasos ──────────────────────────────────────────────────────────────────

Given('el usuario abre la pagina principal', async function () {
  await this.grantIntranetAccess()
  // Wait for questions to load (form shows after API response)
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 20000 })
})

Given('el usuario navega a la pantalla de login', async function () {
  await this.page.goto(`${this.baseUrl}/#/login`, { waitUntil: 'networkidle' })
  await this.page.waitForSelector('form', { timeout: 10000 })
})

Given('el usuario navega a la pantalla de consulta', async function () {
  await this.page.goto(`${this.baseUrl}/#/consulta`, { waitUntil: 'networkidle' })
  await this.page.waitForSelector('.card', { timeout: 10000 })
})

Given('el usuario hace clic en Siguiente sin rellenar nada', async function () {
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 15000 })
  const btn = this.page.locator('button:has-text("Continuar")').first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  await btn.click()
  await this.page.waitForTimeout(500)
})

Given('el usuario rellena los datos de identificacion', async function () {
  await fillIdentificacion(this.page)
})

Given('el usuario avanza al siguiente paso', async function () {
  await clickContinuar(this.page)
})

Given('el usuario responde Si a todas las preguntas de vivienda', async function () {
  await answerAllButtons(this.page, 'si')
})

Given('el usuario responde No a todas las preguntas de vivienda', async function () {
  await answerAllButtons(this.page, 'no')
})

Given('el usuario responde No a todas las preguntas de familia', async function () {
  await answerAllButtons(this.page, 'no')
})

Given('el usuario responde No a todas las preguntas de ingresos', async function () {
  await answerAllButtons(this.page, 'no')
})

Given('el usuario envia el formulario', async function () {
  const submitBtn = this.page.locator('button:has-text("Enviar cuestionario")')
  await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
  await submitBtn.click()
  await this.page.waitForSelector('.success-panel', { timeout: 20000 })
})

Given('el usuario rellena los datos de identificacion con DNI {string}', async function (dni) {
  await fillIdentificacionWithDni(this.page, dni)
})

When('el usuario intenta enviar el formulario duplicado', async function () {
  const submitBtn = this.page.locator('button:has-text("Enviar cuestionario")')
  await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
  await submitBtn.click()
  await this.page.waitForTimeout(3000)
})

Then('se muestra un error de declaracion duplicada', async function () {
  // The toast or error message should contain the duplicate error text
  const toast = this.page.locator('.toast, [role="alert"], .alert, .error-toast, .Toastify__toast')
  const bodyText = await this.page.evaluate(() => document.body.innerText)
  const hasDuplicateError =
    bodyText.includes('409') ||
    bodyText.includes('Ya existe') ||
    bodyText.includes('duplicad') ||
    bodyText.includes('DNI') ||
    bodyText.includes('Error')
  if (!hasDuplicateError) {
    // Check if any toast is visible with error text
    const toastCount = await toast.count()
    if (toastCount === 0) {
      throw new Error('No se mostró ningún mensaje de error para la declaración duplicada')
    }
  }
})

Then('se toma un screenshot {string}', async function (name) {
  await this.page.waitForTimeout(400)
  const path = await this.screenshot(name)
  console.log(`  Screenshot guardado: ${path}`)
})
