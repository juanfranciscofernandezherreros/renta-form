import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper: log in as admin
// ---------------------------------------------------------------------------
async function loginAsAdmin(page, baseUrl) {
  // Navigate to #/admin
  await page.evaluate(() => { window.location.hash = '#/admin' })
  await page.waitForLoadState('networkidle')

  // Fill admin login form (username + password fields by name)
  await page.locator('input[name="username"]').waitFor({ state: 'visible' })
  await page.locator('input[name="username"]').fill('admin')
  await page.locator('input[name="password"]').fill('admin')
  await page.locator('button[type="submit"]').click()
  await page.waitForLoadState('networkidle')

  // Wait for admin panel to appear
  await page.locator('.admin-tabs').waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given('que navego a la ruta {string}', async function (hash) {
  await this.page.evaluate((h) => { window.location.hash = h }, hash)
  await this.page.waitForLoadState('networkidle')
})

Given('que he iniciado sesión como administrador', async function () {
  await loginAsAdmin(this.page, this.baseUrl)
})

Given('hay declaraciones en el panel de admin', async function () {
  const count = await this.page.locator('.declaracion-card').count()
  expect(count).toBeGreaterThan(0)
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('introduzco usuario admin {string} y contraseña {string}', async function (username, password) {
  await this.page.locator('input[name="username"]').waitFor({ state: 'visible' })
  await this.page.locator('input[name="username"]').fill(username)
  await this.page.locator('input[name="password"]').fill(password)
})

When('confirmo el login de admin', async function () {
  await this.page.locator('button[type="submit"]').click()
  await this.page.waitForLoadState('networkidle')
})

When('cambio el estado de la primera declaración a {string}', async function (estado) {
  // Expand the first declaration card first if needed
  const body = this.page.locator('.declaracion-body').first()
  if (!(await body.isVisible())) {
    await this.page.locator('.declaracion-header').first().click()
    await this.page.waitForTimeout(300)
  }
  const select = this.page.locator('select.admin-estado-select').first()
  await select.selectOption(estado)
  await this.page.waitForTimeout(500)
})

When('busco declaraciones por DNI {string}', async function (dni) {
  await this.page.locator('input.admin-filter-input').fill(dni)
  await this.page.waitForTimeout(600)
})

When('hago clic en la pestaña {string}', async function (tabName) {
  await this.page.locator('.admin-tab', { hasText: tabName }).click()
  await this.page.waitForTimeout(500)
})

When('elimino la primera declaración', async function () {
  // Expand first card if needed
  const body = this.page.locator('.declaracion-body').first()
  if (!(await body.isVisible())) {
    await this.page.locator('.declaracion-header').first().click()
    await this.page.waitForTimeout(300)
  }
  this.declaracionCountBefore = await this.page.locator('.declaracion-card').count()

  // Click the delete button in the expanded body (use title to avoid ambiguity)
  await this.page.locator('button[title="Eliminar declaración"]').first().click()
  await this.page.waitForTimeout(300)

  // Confirm in the modal
  await this.page.locator('.admin-modal .btn-danger').click()
  // Wait for async deletion + state refresh (mock has ~300 milliseconds delay each)
  await this.page.waitForTimeout(1500)
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('veo el panel de administración', async function () {
  await expect(this.page.locator('.admin-tabs')).toBeVisible()
})

Then('veo la pestaña {string}', async function (tabName) {
  await expect(this.page.locator('.admin-tab', { hasText: tabName })).toBeVisible()
})

Then('veo el error de login de admin', async function () {
  await expect(this.page.locator('.info-box-error')).toBeVisible()
})

Then('veo la lista de declaraciones en el admin', async function () {
  // The stat badge or the list itself
  await expect(this.page.locator('.admin-stats')).toBeVisible()
})

Then('la primera declaración muestra el estado {string}', async function (estadoLabel) {
  await expect(this.page.locator('.estado-badge').first()).toContainText(estadoLabel)
})

Then('veo solo declaraciones del DNI {string}', async function (dni) {
  const cards = this.page.locator('.admin-dec-dni')
  const count = await cards.count()
  for (let i = 0; i < count; i++) {
    const text = await cards.nth(i).textContent()
    expect(text).toBe(dni)
  }
})

Then('veo la lista de preguntas del catálogo', async function () {
  // The preguntas tab renders a list or table of questions
  await expect(this.page.locator('.card')).toBeVisible()
  // Wait a moment for the async load
  await this.page.waitForTimeout(400)
  // Should show at least the section title or a question row
  const content = await this.page.locator('.card').textContent()
  expect(content.length).toBeGreaterThan(10)
})

Then('veo la lista de secciones del catálogo', async function () {
  await this.page.waitForTimeout(400)
  const content = await this.page.locator('.card').last().textContent()
  expect(content.length).toBeGreaterThan(10)
})

Then('veo la tabla de usuarios registrados', async function () {
  await this.page.waitForTimeout(400)
  const content = await this.page.locator('.card').last().textContent()
  expect(content.length).toBeGreaterThan(10)
})

Then('veo la configuración de idiomas disponibles', async function () {
  await this.page.waitForTimeout(400)
  const content = await this.page.locator('.card').last().textContent()
  expect(content.length).toBeGreaterThan(10)
})

Then('el número de declaraciones disminuye en 1', async function () {
  const newCount = await this.page.locator('.declaracion-card').count()
  expect(newCount).toBe(this.declaracionCountBefore - 1)
})
