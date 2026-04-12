import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Pasos de intranet
// ---------------------------------------------------------------------------

Given('que visito la página principal', async function () {
  await this.page.goto(this.baseUrl)
  await this.page.waitForLoadState('networkidle')
})

When('introduzco el código de acceso {string}', async function (code) {
  await this.page.locator('input[type="password"]').first().fill(code)
})

When('hago clic en el botón de entrar', async function () {
  await this.page.locator('button[type="submit"]').click()
  await this.page.waitForLoadState('networkidle')
})

When('hago clic en el botón de entrar sin código', async function () {
  await this.page.locator('button[type="submit"]').click()
})

Then('veo el formulario de cuestionario fiscal', async function () {
  await expect(this.page.locator('h1')).toContainText('Cuestionario para Expediente Fiscal')
})

Then('veo un mensaje de error en la página de intranet', async function () {
  await expect(this.page.locator('.info-box-error')).toBeVisible()
})

Then('veo el mensaje {string}', async function (text) {
  await expect(this.page.locator('body')).toContainText(text)
})

// ---------------------------------------------------------------------------
// Pasos de intranet – antecedente compartido
// ---------------------------------------------------------------------------

Given('que he accedido a la intranet con código {string}', async function (code) {
  await this.enterIntranet(code)
})
