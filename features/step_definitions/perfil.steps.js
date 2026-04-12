import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function goToProfile(page) {
  await page.evaluate(() => { window.location.hash = '#/perfil' })
  await page.waitForLoadState('networkidle')
  await page.locator('.profile-name').waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given('que estoy en la página de perfil', async function () {
  await goToProfile(this.page)
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('hago clic para expandir la primera declaración', async function () {
  await this.page.locator('.declaracion-header').first().click()
  await this.page.waitForTimeout(300)
})

When('relleno el formulario de cambio de contraseña con contraseña actual {string} y nueva {string}', async function (oldPw, newPw) {
  await this.page.locator('input[name="oldPassword"]').fill(oldPw)
  await this.page.locator('input[name="newPassword"]').fill(newPw)
  await this.page.locator('input[name="confirmPassword"]').fill(newPw)
})

When('relleno el formulario de cambio de contraseña con contraseña actual {string}, nueva {string} y confirmación {string}', async function (oldPw, newPw, confirm) {
  await this.page.locator('input[name="oldPassword"]').fill(oldPw)
  await this.page.locator('input[name="newPassword"]').fill(newPw)
  await this.page.locator('input[name="confirmPassword"]').fill(confirm)
})

When('hago clic en guardar nueva contraseña', async function () {
  await this.page.locator('button', { hasText: /Actualizar contraseña/ }).click()
  await this.page.waitForTimeout(500)
})

When('restablezco la contraseña a {string} con la contraseña actual {string}', async function (newPw, currentPw) {
  // Clear form and set back to original
  await this.page.locator('input[name="oldPassword"]').fill(currentPw)
  await this.page.locator('input[name="newPassword"]').fill(newPw)
  await this.page.locator('input[name="confirmPassword"]').fill(newPw)
  await this.page.locator('button', { hasText: /Actualizar contraseña/ }).click()
  await this.page.waitForTimeout(500)
})

When('hago clic en el botón {string} del perfil', async function (text) {
  await this.page.locator('button', { hasText: text }).click()
  await this.page.waitForLoadState('networkidle')
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('veo la lista de declaraciones del usuario', async function () {
  await expect(this.page.locator('.declaraciones-list')).toBeVisible()
})

Then('veo el DNI del usuario en la cabecera de perfil', async function () {
  await expect(this.page.locator('.profile-name')).toBeVisible()
})

Then('hay al menos una declaración en la lista', async function () {
  const count = await this.page.locator('.declaracion-card').count()
  expect(count).toBeGreaterThan(0)
})

Then('veo los detalles de la declaración expandida', async function () {
  await expect(this.page.locator('.declaracion-body').first()).toBeVisible()
})

Then('veo el mensaje de éxito del cambio de contraseña', async function () {
  await expect(this.page.locator('.info-box', { hasText: /Contraseña actualizada/ })).toBeVisible()
})

Then('veo el error de contraseña incorrecta', async function () {
  await expect(this.page.locator('.info-box-error, .field-error')).toBeVisible()
})

Then('veo el error de contraseña demasiado corta', async function () {
  await expect(this.page.locator('.field-error')).toBeVisible()
})

Then('veo el error de contraseñas no coinciden', async function () {
  await expect(this.page.locator('.field-error', { hasText: /coinciden/ })).toBeVisible()
})

Then('veo el botón de descargar PDF', async function () {
  await expect(this.page.locator('button', { hasText: /PDF/ })).toBeVisible()
})
