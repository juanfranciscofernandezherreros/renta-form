import { Given, When, Then } from '@cucumber/cucumber'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Replace {key} placeholders in a URL with values from this.savedValues. */
function interpolate(url, saved = {}) {
  return url.replace(/\{(\w+)\}/g, (_, key) => {
    if (saved[key] === undefined) throw new Error(`Saved value "${key}" not found. Available: ${Object.keys(saved).join(', ')}`)
    return saved[key]
  })
}

/** Parse a DocString as JSON, ignoring leading/trailing whitespace and a leading "json" marker. */
function parseDocstring(raw) {
  const cleaned = raw.trim().replace(/^json\s*/i, '')
  return JSON.parse(cleaned)
}

/** Replace {key} placeholders in a string only when the key exists in saved. */
function interpolateDocstring(str, saved = {}) {
  return str.replace(/\{(\w+)\}/g, (match, key) => (saved[key] !== undefined ? saved[key] : match))
}

/** Drill into a nested object using a dotted path like "data.dniNie". */
function getField(obj, path) {
  return path.split('.').reduce((acc, key) => (acc !== undefined && acc !== null ? acc[key] : undefined), obj)
}

// ── Request steps ──────────────────────────────────────────────────────────

When('hago GET a {string}', async function (url) {
  const finalUrl = interpolate(url, this.savedValues)
  const resp = await this.apiContext.get(finalUrl)
  let body
  try { body = await resp.json() } catch { body = null }
  this.lastApiResponse = { status: resp.status(), body }
})

When('hago POST a {string} sin body', async function (url) {
  const finalUrl = interpolate(url, this.savedValues)
  const resp = await this.apiContext.post(finalUrl)
  let body
  try { body = await resp.json() } catch { body = null }
  this.lastApiResponse = { status: resp.status(), body }
})

When('hago POST a {string} con body:', async function (url, docstring) {
  const finalUrl = interpolate(url, this.savedValues)
  const data = parseDocstring(interpolateDocstring(docstring, this.savedValues))
  const resp = await this.apiContext.post(finalUrl, { data })
  let body
  try { body = await resp.json() } catch { body = null }
  this.lastApiResponse = { status: resp.status(), body }
})

When('hago PUT a {string} con body:', async function (url, docstring) {
  const finalUrl = interpolate(url, this.savedValues)
  const data = parseDocstring(interpolateDocstring(docstring, this.savedValues))
  const resp = await this.apiContext.put(finalUrl, { data })
  let body
  try { body = await resp.json() } catch { body = null }
  this.lastApiResponse = { status: resp.status(), body }
})

When('hago PATCH a {string} con body:', async function (url, docstring) {
  const finalUrl = interpolate(url, this.savedValues)
  const data = parseDocstring(interpolateDocstring(docstring, this.savedValues))
  const resp = await this.apiContext.patch(finalUrl, { data })
  let body
  try { body = await resp.json() } catch { body = null }
  this.lastApiResponse = { status: resp.status(), body }
})

When('hago DELETE a {string}', async function (url) {
  const finalUrl = interpolate(url, this.savedValues)
  const resp = await this.apiContext.delete(finalUrl)
  let body
  try { body = await resp.json() } catch { body = null }
  this.lastApiResponse = { status: resp.status(), body }
})

// ── Response assertion steps ───────────────────────────────────────────────

Then('la respuesta tiene status {int}', function (expectedStatus) {
  const { status } = this.lastApiResponse
  if (status !== expectedStatus) {
    throw new Error(`Se esperaba status ${expectedStatus} pero se recibió ${status}. Body: ${JSON.stringify(this.lastApiResponse.body)}`)
  }
})

Then('la respuesta es un array', function () {
  const { body } = this.lastApiResponse
  if (!Array.isArray(body)) {
    throw new Error(`Se esperaba un array pero se recibió: ${JSON.stringify(body)}`)
  }
})

Then('la respuesta tiene al menos {int} elementos', function (minCount) {
  const { body } = this.lastApiResponse
  const arr = Array.isArray(body) ? body : body?.data
  if (!Array.isArray(arr)) throw new Error(`La respuesta no contiene un array. Body: ${JSON.stringify(body)}`)
  if (arr.length < minCount) {
    throw new Error(`Se esperaban al menos ${minCount} elementos, pero hay ${arr.length}`)
  }
})

Then('la respuesta contiene el campo {string}', function (fieldPath) {
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (value === undefined) {
    throw new Error(`El campo "${fieldPath}" no existe en la respuesta: ${JSON.stringify(this.lastApiResponse.body)}`)
  }
})

Then('el campo {string} de la respuesta es {string}', function (fieldPath, expected) {
  const resolvedExpected = interpolateDocstring(expected, this.savedValues)
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (String(value) !== String(resolvedExpected)) {
    throw new Error(`Campo "${fieldPath}": se esperaba "${resolvedExpected}" pero se recibió "${value}"`)
  }
})

Then('el campo {string} de la respuesta es {int}', function (fieldPath, expected) {
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (Number(value) !== Number(expected)) {
    throw new Error(`Campo "${fieldPath}": se esperaba ${expected} pero se recibió ${value}`)
  }
})

Then('el campo {string} de la respuesta es verdadero', function (fieldPath) {
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (value !== true) {
    throw new Error(`Campo "${fieldPath}": se esperaba true pero se recibió ${JSON.stringify(value)}`)
  }
})

Then('el campo {string} de la respuesta es falso', function (fieldPath) {
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (value !== false) {
    throw new Error(`Campo "${fieldPath}": se esperaba false pero se recibió ${JSON.stringify(value)}`)
  }
})

Then('el campo {string} de la respuesta contiene {string}', function (fieldPath, substring) {
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (typeof value !== 'string' || !value.includes(substring)) {
    throw new Error(`Campo "${fieldPath}": se esperaba que contuviera "${substring}" pero se recibió "${value}"`)
  }
})

Then('la respuesta contiene las claves {string}', function (keysStr) {
  const keys = keysStr.split(',').map(k => k.trim())
  const { body } = this.lastApiResponse
  for (const key of keys) {
    if (getField(body, key) === undefined) {
      throw new Error(`La respuesta no contiene la clave "${key}". Body: ${JSON.stringify(body)}`)
    }
  }
})

// ── State-saving steps ─────────────────────────────────────────────────────

Then('guardo el campo {string} de la respuesta como {string}', function (fieldPath, alias) {
  const value = getField(this.lastApiResponse.body, fieldPath)
  if (value === undefined) {
    throw new Error(`No se pudo guardar "${alias}": el campo "${fieldPath}" no existe en ${JSON.stringify(this.lastApiResponse.body)}`)
  }
  this.savedValues = this.savedValues || {}
  this.savedValues[alias] = value
})

// ── Setup helpers (Given steps that create entities via the API) ──────────

Given('existe una declaración de prueba', async function () {
  const dniNie = `TST${Date.now().toString().slice(-8)}Z`
  const resp = await this.apiContext.post('/v1/irpf/declaraciones', {
    data: {
      nombre: 'Test', apellidos: 'Prueba', dniNie, email: 'prueba@test.com',
      telefono: '600000000', viviendaAlquiler: false, viviendaPropiedad: false,
      pisosAlquiladosTerceros: false, segundaResidencia: false, familiaNumerosa: false,
      ayudasGobierno: false, mayores65ACargo: false, hijosMenores26: false,
      ingresosJuego: false, ingresosInversiones: false,
    },
  })
  const body = await resp.json()
  if (!body.id) throw new Error(`No se pudo crear la declaración de prueba: ${JSON.stringify(body)}`)
  this.savedValues = this.savedValues || {}
  this.savedValues.declaracionId = body.id
  this.savedValues.declaracionDniNie = dniNie
})

Given('existe un idioma de prueba con código {string} y etiqueta {string}', async function (code, label) {
  const resp = await this.apiContext.post('/v1/admin/idiomas', { data: { code, label } })
  const body = await resp.json()
  if (!body.id) throw new Error(`No se pudo crear el idioma de prueba: ${JSON.stringify(body)}`)
  this.savedValues = this.savedValues || {}
  this.savedValues.idiomaId = body.id
  this.savedValues.idiomaCode = body.code
})

Given('existe una pregunta de formulario de prueba', async function () {
  const resp = await this.apiContext.post('/v1/admin/preguntas-formulario', {
    data: { texto: 'Pregunta de prueba generada en test' },
  })
  const body = await resp.json()
  if (!body.id) throw new Error(`No se pudo crear la pregunta de prueba: ${JSON.stringify(body)}`)
  this.savedValues = this.savedValues || {}
  this.savedValues.preguntaId = body.id
})
