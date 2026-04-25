import { Given, When, Then } from '@cucumber/cucumber'

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_IDIOMAS = [
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

const MOCK_TRADUCCIONES = {
  es: {
    btnContinue: 'Continuar',
    btnSubmit: 'Enviar declaración',
    btnSubmitting: 'Enviando…',
    btnBack: 'Atrás',
    btnClear: 'Limpiar',
    fieldNombre: 'Nombre',
    fieldApellidos: 'Apellidos',
    fieldDniNie: 'DNI / NIE',
    fieldEmail: 'Email',
    fieldTelefono: 'Teléfono',
    yes: 'Sí',
    no: 'No',
    langLabel: 'Idioma',
    successTitle: '¡Declaración enviada!',
    section1: 'Datos de identificación',
    instructionsTitle: 'Instrucciones:',
  },
  en: {
    btnContinue: 'Continue',
    btnSubmit: 'Send declaration',
    btnSubmitting: 'Sending…',
    btnBack: 'Back',
    btnClear: 'Clear',
    fieldNombre: 'Name',
    fieldApellidos: 'Surnames',
    fieldDniNie: 'ID / NIE',
    fieldEmail: 'Email',
    fieldTelefono: 'Phone',
    yes: 'Yes',
    no: 'No',
    langLabel: 'Language',
    successTitle: 'Declaration sent!',
    section1: 'Identification data',
    instructionsTitle: 'Instructions:',
  },
  ca: {
    btnContinue: 'Continuar',
    btnSubmit: 'Enviar declaració',
    btnSubmitting: 'Enviant…',
    btnBack: 'Enrere',
    btnClear: 'Netejar',
    fieldNombre: 'Nom',
    fieldApellidos: 'Cognoms',
    fieldDniNie: 'DNI / NIE',
    fieldEmail: 'Correu',
    fieldTelefono: 'Telèfon',
    yes: 'Sí',
    no: 'No',
    langLabel: 'Idioma',
    successTitle: 'Declaració enviada!',
    section1: "Dades d'identificació",
    instructionsTitle: "Instruccions:",
  },
  fr: {
    btnContinue: 'Continuer',
    btnSubmit: 'Envoyer la déclaration',
    btnSubmitting: 'Envoi…',
    btnBack: 'Retour',
    btnClear: 'Effacer',
    fieldNombre: 'Prénom',
    fieldApellidos: 'Nom de famille',
    fieldDniNie: 'DNI / NIE',
    fieldEmail: 'E-mail',
    fieldTelefono: 'Téléphone',
    yes: 'Oui',
    no: 'Non',
    langLabel: 'Langue',
    successTitle: 'Déclaration envoyée !',
    section1: "Données d'identification",
    instructionsTitle: "Instructions :",
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Intercept idiomas and traducciones API with mock data. */
async function interceptTranslationAPIs(page, { idiomas = MOCK_IDIOMAS, traducciones = MOCK_TRADUCCIONES } = {}) {
  await page.route('**/v1/irpf/idiomas', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(idiomas),
    })
  )
  await page.route('**/v1/irpf/traducciones', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(traducciones),
    })
  )
}

/** Click the language button for a given code (e.g. 'EN', 'CA', 'FR', 'ES'). */
async function clickLangButton(page, code) {
  const btn = page.locator(`.lang-flag-btn .lang-flag-code:text-is("${code.toUpperCase()}")`).first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  await btn.click()
  // Wait until React re-renders (active class moves to the new button)
  await page.waitForFunction(
    (code) => document.querySelector(`.lang-flag-btn.active .lang-flag-code`)?.textContent === code,
    code.toUpperCase(),
    { timeout: 5000 }
  )
}

// ── Steps: navegación con mock ──────────────────────────────────────────────

Given('el usuario abre la pagina con traducciones simuladas', async function () {
  await interceptTranslationAPIs(this.page)
  await this.grantIntranetAccess()
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 20000 })
  // Wait for translations to be applied (the lang-flag buttons appear once
  // the LanguageContext loads the mocked data)
  await this.page.waitForSelector('.lang-flag-btn', { timeout: 10000 })
  // Wait until the Continuar button text is rendered (translations applied)
  await this.page.waitForSelector('button.btn-primary', { timeout: 8000 })
})

Given('el usuario abre la pagina con traducciones vacías', async function () {
  await interceptTranslationAPIs(this.page, { idiomas: [], traducciones: {} })
  await this.grantIntranetAccess()
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 20000 })
})

// ── Steps: selector de idioma visible ──────────────────────────────────────

Then('el selector de idioma es visible', async function () {
  await this.page.waitForSelector('.lang-flags-top', { timeout: 10000 })
  const visible = await this.page.locator('.lang-flags-top').isVisible()
  if (!visible) throw new Error('El selector de idioma no es visible')
  const buttons = await this.page.locator('.lang-flag-btn').count()
  if (buttons < 1) throw new Error('No hay botones de idioma en el selector')
})

// ── Steps: estado activo de botón ──────────────────────────────────────────

Then('el botón de idioma {string} está activo', async function (code) {
  const upperCode = code.toUpperCase()
  const btn = this.page.locator(`.lang-flag-btn.active .lang-flag-code:text-is("${upperCode}")`)
  await btn.waitFor({ state: 'visible', timeout: 5000 })
  const count = await btn.count()
  if (count === 0) {
    throw new Error(`El botón de idioma "${upperCode}" no está marcado como activo`)
  }
})

Then('el botón de idioma {string} no está activo', async function (code) {
  const upperCode = code.toUpperCase()
  // The active button has class 'active'; verify this code does NOT have it
  const activeBtn = this.page.locator(`.lang-flag-btn.active .lang-flag-code:text-is("${upperCode}")`)
  const count = await activeBtn.count()
  if (count > 0) {
    throw new Error(`El botón de idioma "${upperCode}" no debería estar activo pero lo está`)
  }
})

// ── Steps: cambio de idioma ─────────────────────────────────────────────────

When('el usuario selecciona el idioma {string}', async function (code) {
  await clickLangButton(this.page, code)
})

// ── Steps: texto traducido ──────────────────────────────────────────────────

Then('el botón de continuar muestra el texto traducido al inglés', async function () {
  const btn = this.page.locator('button.btn-primary:has-text("Continue")').first()
  await btn.waitFor({ state: 'visible', timeout: 8000 })
  const text = await btn.innerText()
  if (!text.includes('Continue')) {
    throw new Error(`Se esperaba "Continue" en el botón Continuar pero se encontró: "${text}"`)
  }
})

Then('el botón de continuar muestra el texto en español', async function () {
  const btn = this.page.locator('button.btn-primary:has-text("Continuar")').first()
  await btn.waitFor({ state: 'visible', timeout: 8000 })
  const text = await btn.innerText()
  if (!text.includes('Continuar')) {
    throw new Error(`Se esperaba "Continuar" en el botón pero se encontró: "${text}"`)
  }
})

Then('el formulario muestra etiquetas en francés', async function () {
  // Wait for "Prénom" label to appear after language switch
  await this.page.getByText('Prénom', { exact: false }).waitFor({ state: 'visible', timeout: 8000 })
})

Then('los botones de respuesta muestran el texto en catalán', async function () {
  // In Catalan, the name field label is "Nom" (vs "Nombre" in Spanish)
  await this.page.getByText('Nom', { exact: false }).waitFor({ state: 'visible', timeout: 8000 })
})

Then('los elementos de interfaz son visibles aunque no haya traducciones cargadas', async function () {
  // With no translations, the t() function returns the key itself.
  // The form should still render with the navigation buttons visible.
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 10000 })
  const continuarBtn = this.page.locator('button.btn-primary').first()
  const visible = await continuarBtn.isVisible()
  if (!visible) {
    throw new Error('El botón principal no es visible cuando no hay traducciones cargadas')
  }
})

// ── Steps: API de idiomas ────────────────────────────────────────────────────

When('se llama al endpoint de idiomas', async function () {
  const response = await this.page.request.get(`${this.baseUrl}/v1/irpf/idiomas`)
  this.lastApiResponse = { status: response.status(), body: await response.json() }
})

Then('la respuesta de idiomas tiene el formato correcto', async function () {
  const { status, body } = this.lastApiResponse
  if (status !== 200) throw new Error(`El endpoint de idiomas devolvió status ${status}`)
  if (!Array.isArray(body)) throw new Error('La respuesta de idiomas debe ser un array')
  // Each element should have code and label
  for (const idioma of body) {
    if (typeof idioma.code !== 'string' || !idioma.code) {
      throw new Error(`El idioma no tiene un campo 'code' válido: ${JSON.stringify(idioma)}`)
    }
    if (typeof idioma.label !== 'string' || !idioma.label) {
      throw new Error(`El idioma no tiene un campo 'label' válido: ${JSON.stringify(idioma)}`)
    }
  }
})

When('se llama al endpoint de traducciones', async function () {
  const response = await this.page.request.get(`${this.baseUrl}/v1/irpf/traducciones`)
  this.lastApiResponse = { status: response.status(), body: await response.json() }
})

Then('la respuesta de traducciones tiene el formato correcto', async function () {
  const { status, body } = this.lastApiResponse
  if (status !== 200) throw new Error(`El endpoint de traducciones devolvió status ${status}`)
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('La respuesta de traducciones debe ser un objeto agrupado por código de idioma')
  }
  // Each value should be an object of key→value translations
  for (const [langCode, entries] of Object.entries(body)) {
    if (typeof entries !== 'object' || Array.isArray(entries)) {
      throw new Error(`Las traducciones para "${langCode}" no son un objeto clave-valor`)
    }
  }
})

// ── Steps: admin pestaña de idiomas ─────────────────────────────────────────

Then('la pestaña de idiomas está visible en el panel de administración', async function () {
  await this.page.waitForSelector('.admin-tabs', { timeout: 10000 })
  const tab = this.page.locator('.admin-tabs button:has-text("Idiomas"), .admin-tabs [role="tab"]:has-text("Idiomas")')
  const count = await tab.count()
  if (count === 0) {
    throw new Error('La pestaña de idiomas no está visible en el panel de administración')
  }
})

When('el administrador navega a la pestaña de idiomas', async function () {
  const tab = this.page.locator('.admin-tabs button:has-text("Idiomas")').first()
  await tab.waitFor({ state: 'visible', timeout: 10000 })
  await tab.click()
  // Wait for the idiomas section content to appear
  await this.page.waitForSelector('.admin-toolbar, table, .info-box', { timeout: 10000 })
})

Then('la tabla de idiomas es visible', async function () {
  // Either a table or a loading indicator should be visible
  await this.page.waitForSelector('table, .info-box', { timeout: 10000 })
  // The heading for idiomas section should be present
  await this.page.getByText('Idiomas', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
})

Then('la tabla de idiomas muestra columnas de código y etiqueta', async function () {
  await this.page.waitForSelector('table', { timeout: 10000 })
  const headers = await this.page.locator('table th').allInnerTexts()
  const hasCodigo = headers.some(h => h.toLowerCase().includes('código') || h.toLowerCase().includes('code') || h.toLowerCase().includes('cod'))
  const hasEtiqueta = headers.some(h => h.toLowerCase().includes('etiqueta') || h.toLowerCase().includes('label'))
  if (!hasCodigo) {
    throw new Error(`La columna de código no aparece en la tabla. Cabeceras: ${headers.join(', ')}`)
  }
  if (!hasEtiqueta) {
    throw new Error(`La columna de etiqueta no aparece en la tabla. Cabeceras: ${headers.join(', ')}`)
  }
})

When('el administrador crea un nuevo idioma con código {string} y etiqueta {string}', async function (code, label) {
  this.lastCreatedIdiomaCode = code
  this.lastCreatedIdiomaLabel = label
  // Click "Nuevo idioma" button
  const newBtn = this.page.locator('button:has-text("Nuevo idioma")').first()
  await newBtn.waitFor({ state: 'visible', timeout: 10000 })
  await newBtn.click()

  // Fill in the modal form
  const codeInput = this.page.locator('input[name="code"]')
  await codeInput.waitFor({ state: 'visible', timeout: 5000 })
  await codeInput.fill(code)

  const labelInput = this.page.locator('input[name="label"]')
  await labelInput.fill(label)

  // Submit
  const saveBtn = this.page.locator('.admin-modal button.btn-primary, .modal button.btn-primary').first()
  await saveBtn.click()
  // Wait for the modal to close and the table to refresh
  await this.page.waitForSelector('table', { timeout: 10000 })
})

Then('la tabla de idiomas muestra el idioma recién creado', async function () {
  const code = this.lastCreatedIdiomaCode
  const label = this.lastCreatedIdiomaLabel
  if (!code || !label) throw new Error('No se guardó la información del idioma creado')

  await this.page.waitForSelector('table', { timeout: 10000 })
  const tableText = await this.page.locator('table').innerText()

  if (!tableText.toLowerCase().includes(code.toLowerCase()) || !tableText.toLowerCase().includes(label.toLowerCase())) {
    throw new Error(`El idioma "${label}" (${code}) no aparece en la tabla tras crearlo`)
  }
})

// ── Steps: estado vacío (sin idiomas ni traducciones) ────────────────────────

/** Intercept admin idiomas and faltantes APIs with empty data. */
async function interceptAdminEmptyAPIs(page) {
  // Public endpoints (used by LanguageContext)
  await page.route('**/v1/irpf/idiomas', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('**/v1/irpf/traducciones', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  )
  // Admin idiomas list
  await page.route('**/v1/admin/idiomas*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0, page: 1, totalPages: 0 }),
    })
  )
  // Faltantes endpoint – simulate empty DB but return required keys
  await page.route('**/v1/admin/traducciones/faltantes*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        referencia: 'es',
        total_claves: 0,
        claves_requeridas: [
          'btnContinue', 'btnSubmit', 'btnSubmitting', 'btnBack', 'btnClear',
          'fieldNombre', 'fieldApellidos', 'fieldDniNie', 'fieldEmail', 'fieldTelefono',
          'yes', 'no', 'langLabel', 'successTitle', 'section1', 'instructionsTitle',
        ],
        faltantes: {},
        resumen: [],
      }),
    })
  )
}

Given('el administrador accede al panel de administracion con traducciones vacías', async function () {
  await interceptAdminEmptyAPIs(this.page)
  await this.page.goto(`${this.baseUrl}/#/backend_admin`, { waitUntil: 'networkidle' })
  const loginForm = this.page.locator('form')
  if (await loginForm.isVisible()) {
    await this.page.fill('input[name="dniNie"], input[type="text"]', 'ADMIN')
    await this.page.fill('input[name="password"], input[type="password"]', 'admin1234')
    // Re-intercept after navigation triggered by login (routes may reset)
    await interceptAdminEmptyAPIs(this.page)
    await this.page.click('button[type="submit"]')
    await this.page.waitForSelector('.admin-tabs, .admin-panel, [class*="admin"]', { timeout: 10000 })
  }
})

When('el administrador navega a la pestaña de traducciones', async function () {
  const tab = this.page.locator('.admin-tabs button:has-text("Traducciones"), .admin-tabs [role="tab"]:has-text("Traducciones")').first()
  await tab.waitFor({ state: 'visible', timeout: 10000 })
  await tab.click()
  await this.page.waitForSelector('.info-box, .traduccion-idioma-card', { timeout: 10000 })
})

Then('la pestaña de traducciones indica que no hay idiomas configurados', async function () {
  const msg = this.page.locator('.info-box').filter({ hasText: /no hay idiomas/i })
  await msg.waitFor({ state: 'visible', timeout: 8000 })
})

Then('la pestaña de traducciones muestra las claves de traducción requeridas', async function () {
  // The tab should render a badge for each required key when no idiomas exist
  await this.page.waitForSelector('.info-box', { timeout: 8000 })
  const text = await this.page.locator('body').innerText()
  // At least one known required key should be visible
  const knownKeys = ['btnContinue', 'fieldNombre', 'yes', 'no', 'langLabel']
  const found = knownKeys.filter(k => text.includes(k))
  if (found.length === 0) {
    throw new Error(`Ninguna clave requerida aparece en la pestaña de traducciones vacía. Claves esperadas: ${knownKeys.join(', ')}`)
  }
})

// ── Steps: API de faltantes ────────────────────────────────────────────────

When('se llama al endpoint de traducciones faltantes', async function () {
  const response = await this.page.request.get(`${this.baseUrl}/v1/admin/traducciones/faltantes`)
  this.lastApiResponse = { status: response.status(), body: await response.json() }
})

Then('la respuesta de faltantes incluye claves requeridas', async function () {
  const { status, body } = this.lastApiResponse
  if (status !== 200) throw new Error(`El endpoint de faltantes devolvió status ${status}`)
  if (!body || typeof body !== 'object') throw new Error('La respuesta de faltantes debe ser un objeto')
  if (!Array.isArray(body.claves_requeridas) || body.claves_requeridas.length === 0) {
    throw new Error('La respuesta de faltantes debe incluir un array "claves_requeridas" no vacío')
  }
  const expected = ['btnContinue', 'fieldNombre', 'yes', 'no']
  for (const key of expected) {
    if (!body.claves_requeridas.includes(key)) {
      throw new Error(`La clave requerida "${key}" no está en claves_requeridas: ${body.claves_requeridas.join(', ')}`)
    }
  }
})
