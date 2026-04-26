import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber'

setDefaultTimeout(60 * 1000)

// ── Question counts ──────────────────────────────────────────────────────
// The catalog is fully dynamic in the DB – the test reads the configured
// list once and uses it both for total count and section grouping.  Tests
// rely on the default seed (seedPreguntas.js) where preguntas 1-6 are
// "vivienda", 7-12 are "familia" and 13-14 are "ingresos".  If you change
// the seed/order, also update the slice boundaries below.
const SECTION_BOUNDARIES = { vivienda: [0, 6], familia: [6, 12], ingresos: [12, 14] }

let _cachedTotal = null
async function fetchTotalQuestions() {
  if (_cachedTotal !== null) return _cachedTotal
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001/v1'
  const res = await fetch(`${baseUrl}/irpf/preguntas`)
  const json = await res.json()
  _cachedTotal = (json.secciones || []).reduce(
    (acc, s) => acc + (s.preguntas?.length || 0), 0
  )
  return _cachedTotal
}

async function questionsForSection(name) {
  // Use the seed-derived boundaries while preferring the real total when
  // it differs (e.g. an admin added a new pregunta).  Sections "vivienda"
  // and "familia" stay at 6 each; "ingresos" absorbs any extra questions.
  const total = await fetchTotalQuestions()
  const [start, end] = SECTION_BOUNDARIES[name]
  if (name === 'ingresos') return Math.max(0, total - start)
  return Math.max(0, Math.min(end, total) - start)
}

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

/**
 * Answer a single yes/no question card visible on screen.
 * After clicking, auto-advance animates to the next question.
 * @param {import('playwright').Page} page
 * @param {'si'|'no'} value
 */
async function answerQuestion(page, value) {
  await page.waitForSelector('.wizard-step .question-card', { timeout: 10000 })
  await page.waitForTimeout(200)
  const card = page.locator('.wizard-step .question-card').first()
  const cssClass = value === 'si' ? 'yes' : 'no'
  const alreadySelected = card.locator(`.yesno-btn.selected.${cssClass}`)
  if ((await alreadySelected.count()) === 0) {
    const btnIndex = value === 'si' ? 0 : 1
    await card.locator('.yesno-btn').nth(btnIndex).click()
    // Wait for auto-advance animation (700 ms matches the wizard transition)
    await page.waitForTimeout(700)
  }
}

/**
 * Answer the next N questions sequentially.
 * @param {import('playwright').Page} page
 * @param {'si'|'no'} value
 * @param {number} count
 */
async function answerNQuestions(page, value, count) {
  for (let i = 0; i < count; i++) {
    await answerQuestion(page, value)
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

// ── Respuestas de vivienda ──
Given('el usuario responde Si a todas las preguntas de vivienda', async function () {
  await answerNQuestions(this.page, 'si', await questionsForSection('vivienda'))
})

Given('el usuario responde No a todas las preguntas de vivienda', async function () {
  await answerNQuestions(this.page, 'no', await questionsForSection('vivienda'))
})

// ── Respuestas de familia ──
Given('el usuario responde No a todas las preguntas de familia', async function () {
  await answerNQuestions(this.page, 'no', await questionsForSection('familia'))
})

Given('el usuario responde Si a todas las preguntas de familia', async function () {
  await answerNQuestions(this.page, 'si', await questionsForSection('familia'))
})

// ── Respuestas de ingresos ──
Given('el usuario responde No a todas las preguntas de ingresos', async function () {
  await answerNQuestions(this.page, 'no', await questionsForSection('ingresos'))
})

Given('el usuario responde Si a todas las preguntas de ingresos', async function () {
  await answerNQuestions(this.page, 'si', await questionsForSection('ingresos'))
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
  // Wait for either an error toast or an alert to appear after the API responds
  await this.page.waitForSelector(
    '.toast-error, [role="alert"], .Toastify__toast--error, .alert-danger',
    { timeout: 10000 }
  ).catch(() => {})
  await this.page.waitForTimeout(500)
})

Then('se muestra un error de declaracion duplicada', async function () {
  // The backend returns the message "Ya existe una declaración con este DNI/NIE" on 409
  const bodyText = await this.page.evaluate(() => document.body.innerText)
  const hasDuplicateError =
    bodyText.includes('Ya existe') ||
    bodyText.includes('409') ||
    bodyText.includes('duplicad')
  if (!hasDuplicateError) {
    throw new Error(
      `No se mostró el mensaje de error de declaración duplicada. Texto de la página: ${bodyText.slice(0, 300)}`
    )
  }
})

Then('se toma un screenshot {string}', async function (name) {
  await this.page.waitForTimeout(400)
  const path = await this.screenshot(name)
  console.log(`  Screenshot guardado: ${path}`)
})

When('el usuario hace clic en Volver', async function () {
  const btn = this.page.locator('button:has-text("Volver")').first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  await btn.click()
  // Wait for the identification form to become visible instead of a fixed timeout
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 10000 })
})

Then('se muestra el formulario de identificacion', async function () {
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 10000 })
})

Then('se muestran errores de validacion en los campos obligatorios', async function () {
  await this.page.waitForSelector('.field-error, .is-invalid', { timeout: 10000 })
})

Then('se muestra la pantalla de exito', async function () {
  await this.page.waitForSelector('.success-panel', { timeout: 20000 })
})

