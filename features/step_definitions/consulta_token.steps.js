import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper: submit a form and capture the generated token
// ---------------------------------------------------------------------------
async function submitAndGetToken(page) {
  // Scope to the main card form to avoid the footer contact form
  const form = page.locator('.card form')
  await form.locator('input[name="nombre"]').fill('Token')
  await form.locator('input[name="apellidos"]').fill('Consulta Test')
  await form.locator('input[name="dniNie"]').fill('87654321B')
  await form.locator('input[name="email"]').fill('token@consulta.es')
  await form.locator('input[name="telefono"]').fill('611000001')

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
    if (await radio.isVisible()) await radio.check()
  }

  await form.locator('button.btn-success').click()
  await page.waitForLoadState('networkidle')

  // Grab the token shown in the success panel
  await page.locator('.token-code').waitFor({ state: 'visible' })
  return (await page.locator('.token-code').textContent()).trim()
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given('que he enviado un formulario y tengo un token de acceso', async function () {
  // Must already be past the intranet gate
  this.consultaToken = await submitAndGetToken(this.page)
})

Given('que estoy en la página de consulta de token', async function () {
  await this.page.evaluate(() => { window.location.hash = '#/consulta' })
  await this.page.waitForLoadState('networkidle')
  await this.page.locator('input[type="text"]').first().waitFor({ state: 'visible' })
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('navego a la página de consulta de token', async function () {
  await this.page.evaluate(() => { window.location.hash = '#/consulta' })
  await this.page.waitForLoadState('networkidle')
})

When('introduzco el token en el campo de búsqueda', async function () {
  await this.page.locator('input[type="text"]').first().fill(this.consultaToken)
})

When('hago clic en consultar', async function () {
  await this.page.locator('button[type="submit"]').click()
  await this.page.waitForLoadState('networkidle')
})

When('introduzco el token {string}', async function (token) {
  await this.page.locator('input[type="text"]').first().fill(token)
})

When('hago clic en consultar sin introducir token', async function () {
  await this.page.locator('button[type="submit"]').click()
})

When('hago clic en el botón {string}', async function (text) {
  await this.page.locator('button', { hasText: text }).click()
  await this.page.waitForLoadState('networkidle')
})

When('hago clic en limpiar historial', async function () {
  await this.page.locator('button', { hasText: 'Limpiar historial' }).click()
  await this.page.waitForTimeout(300)
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('veo los datos de la declaración con el nombre del solicitante', async function () {
  await expect(this.page.locator('.declaracion-card')).toBeVisible()
  await expect(this.page.locator('.campo-valor').first()).not.toBeEmpty()
})

Then('veo el error de token requerido', async function () {
  await expect(this.page.locator('.info-box-error')).toContainText('Introduce el código de seguimiento')
})

Then('veo el mensaje de token no encontrado', async function () {
  await expect(this.page.locator('.info-box-error')).toContainText('No se ha encontrado')
})

Then('estoy en la página principal del formulario', async function () {
  await expect(this.page.locator('h1')).toContainText('Cuestionario para Expediente Fiscal')
})

Then('veo el historial de tokens en la página de consulta', async function () {
  await expect(this.page.locator('.declaracion-card').first()).toBeVisible()
})

Then('el historial de tokens está vacío', async function () {
  const cards = this.page.locator('.card .declaraciones-list .declaracion-card')
  const count = await cards.count()
  expect(count).toBe(0)
})
