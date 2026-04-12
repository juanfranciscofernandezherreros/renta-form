import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper: navigate to the login page
// ---------------------------------------------------------------------------
async function goToLogin(page) {
  await page.evaluate(() => { window.location.hash = '#/login' })
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="dniNie"]').waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// Helper: perform a full login
// ---------------------------------------------------------------------------
async function doLogin(page, dniNie, password) {
  await goToLogin(page)
  await page.locator('input[name="dniNie"]').fill(dniNie)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForLoadState('networkidle')
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given('que estoy en la página de login', async function () {
  await goToLogin(this.page)
})

Given('que he iniciado sesión con {string} y {string}', async function (dniNie, password) {
  await doLogin(this.page, dniNie, password)
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('introduzco el DNI {string} y la contraseña {string}', async function (dniNie, password) {
  await this.page.locator('input[name="dniNie"]').fill(dniNie)
  await this.page.locator('input[name="password"]').fill(password)
})

When('hago clic en el botón de acceder', async function () {
  await this.page.locator('button[type="submit"]').click()
  await this.page.waitForLoadState('networkidle')
})

When('hago clic en el botón de acceder sin rellenar campos', async function () {
  // Don't fill anything, just submit
  await this.page.locator('button[type="submit"]').click()
})

When('hago clic en el botón de cerrar sesión', async function () {
  // The logout button text depends on i18n; look for text containing "sesión"
  await this.page.locator('button', { hasText: /[Cc]errar\s+sesi/ }).click()
  await this.page.waitForLoadState('networkidle')
})

When('selecciono el idioma {string}', async function (lang) {
  await this.page.locator('select.lang-select').selectOption(lang)
  await this.page.waitForTimeout(300)
})

When('navego a {string}', async function (hash) {
  await this.page.evaluate((h) => { window.location.hash = h }, hash)
  await this.page.waitForLoadState('networkidle')
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('veo el botón de perfil en la cabecera', async function () {
  await expect(this.page.locator('button', { hasText: /[Pp]erfil/ })).toBeVisible()
})

Then('veo un mensaje de error de credenciales inválidas', async function () {
  await expect(this.page.locator('.info-box-error')).toBeVisible()
})

Then('no se envía el formulario de login', async function () {
  // The browser's built-in validation should prevent submission
  // The page should still show the login form
  await expect(this.page.locator('input[name="dniNie"]')).toBeVisible()
})

Then('veo el botón de acceder en la cabecera', async function () {
  await expect(this.page.locator('button', { hasText: /[Aa]cceder/ })).toBeVisible()
})

Then('veo el título en inglés {string}', async function (title) {
  await expect(this.page.locator('h1')).toContainText(title)
})

Then('veo la página de perfil', async function () {
  await expect(this.page.locator('h1')).toContainText(/[Pp]erfil/)
})
