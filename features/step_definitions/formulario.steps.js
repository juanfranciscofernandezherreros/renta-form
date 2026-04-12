import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fill all mandatory fields and all yes/no questions with "no" and submit. */
async function submitMinimalForm(page) {
  // Scope to the main card form to avoid the footer contact form
  const form = page.locator('.card form')
  await form.locator('input[name="nombre"]').fill('Test')
  await form.locator('input[name="apellidos"]').fill('Usuario Demo')
  await form.locator('input[name="dniNie"]').fill('12345678A')
  await form.locator('input[name="email"]').fill('test@demo.es')
  await form.locator('input[name="telefono"]').fill('600000000')

  const yesNoNames = [
    'viviendaAlquiler',
    'viviendaPropiedad',
    'pisosAlquiladosTerceros',
    'segundaResidencia',
    'familiaNumerosa',
    'ayudasGobierno',
    'mayores65ACargo',
    'hijosMenores26',
    'ingresosJuego',
    'ingresosInversiones',
  ]
  for (const name of yesNoNames) {
    const radio = form.locator(`input[type="radio"][name="${name}"][value="no"]`)
    if (await radio.isVisible()) {
      await radio.check()
    }
  }

  await form.locator('button[type="submit"].btn-success').click()
  await page.waitForLoadState('networkidle')
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given('que estoy en la página principal del formulario', async function () {
  // Already on the main page after intranet access
  await expect(this.page.locator('h1')).toContainText('Cuestionario para Expediente Fiscal')
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('relleno el campo {string} con {string}', async function (fieldName, value) {
  // Scope to the main card form to avoid matching the footer contact form
  const input = this.page.locator(`.card form input[name="${fieldName}"]`)
  await input.fill(value)
})

When('respondo {string} a la pregunta {string}', async function (answer, questionName) {
  const radio = this.page.locator(`input[type="radio"][name="${questionName}"][value="${answer}"]`)
  await radio.waitFor({ state: 'visible' })
  await radio.check()
})

When('hago clic en el botón de enviar cuestionario', async function () {
  await this.page.locator('button[type="submit"].btn-success').click()
  await this.page.waitForLoadState('networkidle')
})

When('hago clic en el botón de limpiar', async function () {
  await this.page.locator('button.btn-secondary', { hasText: 'Limpiar' }).click()
})

When('acepto la confirmación', async function () {
  this.page.on('dialog', dialog => dialog.accept())
  // For browsers where dialog is already open, force accept via evaluate
  await this.page.evaluate(() => {
    window.confirm = () => true
  })
  // Click the button again after stubbing confirm
  const btn = this.page.locator('button.btn-secondary', { hasText: 'Limpiar' })
  if (await btn.isVisible()) {
    await btn.click()
  }
  await this.page.waitForTimeout(300)
})

When('envío el formulario con datos mínimos válidos', async function () {
  await submitMinimalForm(this.page)
})

When('hago clic en {string}', async function (buttonText) {
  // Accept any confirmation dialogs (e.g. the "Limpiar" confirmation)
  this.page.once('dialog', dialog => dialog.accept())
  await this.page.locator('button', { hasText: buttonText }).click()
  await this.page.waitForTimeout(500)
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('veo el panel de éxito con {string}', async function (text) {
  await expect(this.page.locator('.success-panel')).toContainText(text)
})

Then('veo un token de consulta', async function () {
  await expect(this.page.locator('.token-code')).toBeVisible()
  const tokenText = await this.page.locator('.token-code').textContent()
  expect(tokenText).toBeTruthy()
  // Store token for reuse in later steps
  this.lastToken = tokenText
})

Then('veo la pregunta condicional {string}', async function (questionName) {
  const radio = this.page.locator(`input[type="radio"][name="${questionName}"]`).first()
  await expect(radio).toBeVisible()
})

Then('no veo la pregunta condicional {string}', async function (questionName) {
  const radio = this.page.locator(`input[type="radio"][name="${questionName}"]`).first()
  await expect(radio).not.toBeVisible()
})

Then('el campo {string} está vacío', async function (fieldName) {
  const value = await this.page.locator(`.card form input[name="${fieldName}"]`).inputValue()
  expect(value).toBe('')
})

Then('veo el indicador de progreso con 5 pasos', async function () {
  const steps = this.page.locator('.progress-bar .step')
  await expect(steps).toHaveCount(5)
})

Then('veo el formulario vacío de nuevo', async function () {
  // After "Enviar otro cuestionario", React resets the form; wait for it to render
  await this.page.locator('.card form input[name="nombre"]').waitFor({ state: 'visible' })
  const value = await this.page.locator('.card form input[name="nombre"]').inputValue()
  expect(value).toBe('')
  await expect(this.page.locator('.card form')).toBeVisible()
})
