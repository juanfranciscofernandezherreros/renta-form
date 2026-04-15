import { Given, When, Then } from '@cucumber/cucumber'

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Answer the single question card currently visible on screen.
 * @param {import('playwright').Page} page
 * @param {'si'|'no'} value
 */
async function answerCurrentQuestion(page, value) {
  await page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  await page.waitForTimeout(200)
  const card = page.locator('.wizard-step .question-card').first()
  const btnIndex = value === 'si' ? 0 : 1
  await card.locator('.yesno-btn').nth(btnIndex).click()
  await page.waitForTimeout(700) // Wait for auto-advance animation
}

// ── Preguntas condicionales ────────────────────────────────────────────────

Then('el usuario ve la primera pregunta del formulario', async function () {
  await this.page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  const cards = this.page.locator('.wizard-step .question-card')
  const count = await cards.count()
  if (count < 1) throw new Error('No se encontró ninguna question-card visible')
})

When('el usuario responde No a la pregunta actual', async function () {
  await answerCurrentQuestion(this.page, 'no')
})

When('el usuario responde Si a la pregunta actual', async function () {
  await answerCurrentQuestion(this.page, 'si')
})

Then('la pregunta condicional sobre alquiler no es visible', async function () {
  // After answering 'no' to viviendaAlquiler, the alquilerMenos35 question should be skipped.
  // The wizard should have moved to the next non-conditional question (viviendaPropiedad).
  // We verify the current question card does NOT contain the phrase about rental percentage.
  await this.page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  const text = await this.page.locator('.wizard-step .question-card').first().innerText()
  const isRentalPercentage =
    text.includes('35 %') ||
    text.includes('35%') ||
    text.includes('alquiler') && text.includes('inferior')
  if (isRentalPercentage) {
    throw new Error(`La pregunta condicional de alquiler apareció cuando no debería: "${text}"`)
  }
})

Then('la pregunta condicional sobre alquiler es visible', async function () {
  // After answering 'si' to viviendaAlquiler, the next question should be alquilerMenos35.
  await this.page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  const text = await this.page.locator('.wizard-step .question-card').first().innerText()
  const isRentalPercentage =
    text.includes('35') ||
    (text.toLowerCase().includes('alquiler') && text.toLowerCase().includes('inferior'))
  if (!isRentalPercentage) {
    throw new Error(`La pregunta condicional de alquiler no apareció. Texto actual: "${text}"`)
  }
})

Then('el formulario se ha enviado correctamente', async function () {
  await this.page.waitForSelector('.success-panel', { timeout: 20000 })
  const visible = await this.page.locator('.success-panel').isVisible()
  if (!visible) throw new Error('El panel de éxito no es visible tras el envío')
})

// ── Barra de progreso ──────────────────────────────────────────────────────

Then('la barra de progreso es visible', async function () {
  await this.page.waitForSelector('.quiz-progress-header', { timeout: 10000 })
  const visible = await this.page.locator('.quiz-progress-header').isVisible()
  if (!visible) throw new Error('La barra de progreso no es visible')
})

Then('el contador de pasos avanza', async function () {
  await this.page.waitForSelector('.quiz-counter', { timeout: 10000 })
  const counterText = await this.page.locator('.quiz-counter').first().innerText()
  // Counter shows "2 / N" (step 2 = first question) after advancing from ID step
  const stepNum = parseInt(counterText.split('/')[0].trim(), 10)
  if (stepNum < 2) {
    throw new Error(`El contador no avanzó (valor: "${counterText}")`)
  }
})

// ── Validación de preguntas ────────────────────────────────────────────────

When('el usuario intenta avanzar sin responder la pregunta actual', async function () {
  await this.page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  // Click Continuar without answering the current question
  await this.page.evaluate(() => {
    const b = document.querySelector('.wizard-nav-right button.btn-primary')
    if (b) b.click()
  })
  await this.page.waitForTimeout(700)
})

Then('se muestra un error de pregunta sin responder', async function () {
  // The form should show an error message or shake animation when trying to advance
  // without answering the current question
  const hasError = await this.page.evaluate(() => {
    const errBanner = document.querySelector('.form-error-banner')
    const shaking = document.querySelector('.wizard-step.shake')
    return !!(errBanner || shaking)
  })
  if (!hasError) {
    throw new Error('No se mostró ningún indicador de error al intentar avanzar sin responder')
  }
})

// ── Admin: tabla de preguntas ──────────────────────────────────────────────

Given('el administrador accede al panel de administracion', async function () {
  await this.page.goto(`${this.baseUrl}/#/admin`, { waitUntil: 'networkidle' })
  // Login as admin
  const loginForm = this.page.locator('form')
  if (await loginForm.isVisible()) {
    await this.page.fill('input[name="dniNie"], input[type="text"]', 'ADMIN')
    await this.page.fill('input[name="password"], input[type="password"]', 'admin1234')
    await this.page.click('button[type="submit"]')
    await this.page.waitForSelector('.admin-tabs, .admin-panel, [class*="admin"]', { timeout: 10000 })
  }
})

When('el administrador navega a la pestaña de preguntas del formulario', async function () {
  // Click the tab for preguntas del formulario
  const tab = this.page.locator('button:has-text("Preguntas"), [role="tab"]:has-text("Preguntas")')
  if (await tab.count() > 0) {
    await tab.first().click()
    await this.page.waitForTimeout(500)
  }
  await this.page.waitForSelector('.preguntas-table, table', { timeout: 10000 })
})

Then('la tabla muestra las preguntas con columna Campo', async function () {
  await this.page.waitForSelector('table', { timeout: 10000 })
  const headers = await this.page.locator('table th').allInnerTexts()
  const hasCampoColumn = headers.some(h => h.toLowerCase().includes('campo'))
  if (!hasCampoColumn) {
    throw new Error(`La columna "Campo" no aparece en la tabla. Cabeceras encontradas: ${headers.join(', ')}`)
  }
})

When('el administrador edita la primera pregunta con texto {string}', async function (newText) {
  // Click the first Edit button in the table
  const editBtn = this.page.locator('table tbody tr button:has-text("Editar")').first()
  await editBtn.waitFor({ state: 'visible', timeout: 10000 })
  await editBtn.click()

  // Fill in the new text in the modal textarea
  const textarea = this.page.locator('.admin-modal textarea[name="texto"]')
  await textarea.waitFor({ state: 'visible', timeout: 5000 })
  await textarea.fill(newText)

  // Save
  await this.page.locator('.admin-modal .btn-primary').click()
  await this.page.waitForTimeout(1000)
})

Then('la pregunta muestra el texto actualizado', async function () {
  await this.page.waitForSelector('.preguntas-table, table', { timeout: 5000 })
  // The table should now contain the updated text
  const tableText = await this.page.locator('table').innerText()
  if (!tableText.includes('Texto de prueba editado')) {
    throw new Error('El texto actualizado no apareció en la tabla')
  }
})
