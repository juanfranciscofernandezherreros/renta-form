// API-only step definitions used by features/backend.feature.
//
// These steps talk to the backend HTTP API directly (no browser). They use
// Node's built-in fetch (Node >= 20) and a small per-scenario state object
// stored on the cucumber World so consecutive `When` steps inside a scenario
// can share state (admin token, ids of created resources, generated unique
// values, etc.).
import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// ── Helpers ────────────────────────────────────────────────────────────────

const apiBaseUrl = () =>
  process.env.BACKEND_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3001'

/** Resolve "$varName" substrings in a string against the world's variables. */
function resolveVars(str, vars) {
  if (typeof str !== 'string') return str
  return str.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m
  )
}

/** Recursively resolve $vars inside any JSON-shaped value. */
function resolveDeep(value, vars) {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return resolveVars(value, vars)
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, vars))
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveDeep(v, vars)
    return out
  }
  return value
}

/** Generate a syntactically valid Spanish DNI (8 digits + control letter). */
function uniqueDni() {
  // Use a numeric base derived from a uuid so it's both unique and < 99999999.
  const num = Math.abs(parseInt(randomUUID().replace(/-/g, '').slice(0, 7), 16)) % 90000000 + 10000000
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE'
  const letter = letters[num % 23]
  return `${num}${letter}`
}

/** Lazily ensure scenario-local state is attached to `this` (the World). */
function ctx(world) {
  if (!world.api) {
    world.api = {
      vars: {},
      lastResponse: null,
    }
  }
  return world.api
}

/** Perform an HTTP request and store the result on the world. */
async function doRequest(world, method, rawPath, { body, auth = false } = {}) {
  const c = ctx(world)
  const path = resolveVars(rawPath, c.vars)
  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    if (!c.vars.adminToken) {
      throw new Error('No hay token de administrador en la variable "adminToken". '
        + '¿Olvidaste el paso "Given inicio sesión como administrador"?')
    }
    headers['Authorization'] = `Bearer ${c.vars.adminToken}`
  }
  const init = { method, headers }
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body)
  const res = await fetch(url, init)
  const text = await res.text()
  let json = null
  if (text) {
    try { json = JSON.parse(text) } catch { /* non-JSON (e.g. CSV) */ }
  }
  c.lastResponse = { status: res.status, headers: res.headers, text, json }
  return c.lastResponse
}

function getProp(obj, name) {
  if (obj === null || obj === undefined) {
    throw new Error(`No se puede leer la propiedad "${name}" de un cuerpo nulo`)
  }
  return obj[name]
}

// ── Variables / fixtures ───────────────────────────────────────────────────

Given('un dniNie único en la variable {string}', function (varName) {
  ctx(this).vars[varName] = uniqueDni()
})

Given('un campo único en la variable {string}', function (varName) {
  // Backend requires camelCase: starts lower-case, then letters/digits only.
  ctx(this).vars[varName] = `campoTest${randomUUID().replace(/[^a-z0-9]/gi, '').slice(0, 8)}`
})

Given('un código de idioma único en la variable {string}', function (varName) {
  // The DB code column is currently sized for 16 chars; keep alphanumeric-only.
  ctx(this).vars[varName] = `t${randomUUID().replace(/[^a-z0-9]/gi, '').slice(0, 4)}`
})

Given('un nombre de rol único en la variable {string}', function (varName) {
  // Reserved names like "admin"/"user" must not appear; the regex requires
  // 2-50 chars in [a-zA-Z0-9_-]. We avoid underscores to be safe.
  ctx(this).vars[varName] = `rol${randomUUID().replace(/[^a-z0-9]/gi, '').slice(0, 8)}`
})

// Cached across scenarios: the rate limiter on /v1/auth/admin-login only
// allows ~20 attempts per 15 minutes per IP, so we log in once per process
// and reuse the bearer token for every admin scenario.
let cachedAdminToken = null

Given('inicio sesión como administrador', async function () {
  const c = ctx(this)
  if (cachedAdminToken) {
    c.vars.adminToken = cachedAdminToken
    return
  }
  const res = await doRequest(this, 'POST', '/v1/auth/admin-login', {
    body: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin',
    },
  })
  if (res.status !== 200 || !res.json?.token) {
    throw new Error(`Login admin falló: status=${res.status} body=${res.text}`)
  }
  cachedAdminToken = res.json.token
  c.vars.adminToken = cachedAdminToken
})

// ── Genéricos: requests ────────────────────────────────────────────────────

When('envío {string} a {string}', async function (method, path) {
  await doRequest(this, method, path)
})

When('envío {string} a {string} con el JSON', async function (method, path, body) {
  const parsed = JSON.parse(resolveVars(body, ctx(this).vars))
  await doRequest(this, method, path, { body: resolveDeep(parsed, ctx(this).vars) })
})

When('envío {string} autenticado a {string}', async function (method, path) {
  await doRequest(this, method, path, { auth: true })
})

When('envío {string} autenticado a {string} con el JSON', async function (method, path, body) {
  const parsed = JSON.parse(resolveVars(body, ctx(this).vars))
  await doRequest(this, method, path, { body: resolveDeep(parsed, ctx(this).vars), auth: true })
})

When('envío {string} a {string} con cabecera {string} {string}', async function (method, path, headerName, headerValue) {
  const c = ctx(this)
  const url = `${apiBaseUrl()}${resolveVars(path, c.vars)}`
  const res = await fetch(url, {
    method,
    headers: { [headerName]: resolveVars(headerValue, c.vars) },
  })
  const text = await res.text()
  let json = null
  if (text) { try { json = JSON.parse(text) } catch { /* */ } }
  c.lastResponse = { status: res.status, headers: res.headers, text, json }
})

When('envío {string} autenticado a {string} con un CSV de {int} filas vacías', async function (method, path, n) {
  // Build a CSV that exceeds the per-import row limit so we exercise the
  // "demasiadas filas" branch in bulkImportDeclaraciones.
  const header = 'nombre,apellidos,dniNie,email,telefono'
  const rows = []
  for (let i = 0; i < n; i += 1) {
    rows.push(`Bulk${i},User${i},,bulk${i}@example.com,60000${(1000 + i).toString().slice(-4)}`)
  }
  await doRequest(this, method, path, { body: { csv: [header, ...rows].join('\n') }, auth: true })
})

When('envío {string} a {string} con la declaración usando {string}', async function (method, path, dniVar) {
  const dni = ctx(this).vars[dniVar]
  if (!dni) throw new Error(`La variable "${dniVar}" no está definida`)
  await doRequest(this, method, path, {
    body: {
      nombre: 'Test',
      apellidos: 'User',
      dniNie: dni,
      email: 't@t.com',
      telefono: '600000000',
      viviendaAlquiler: 'no',
    },
  })
})

// ── Aserciones sobre la respuesta ──────────────────────────────────────────

Then('la respuesta tiene status {int}', function (expected) {
  const r = ctx(this).lastResponse
  assert.equal(
    r.status,
    expected,
    `Se esperaba status ${expected} pero se obtuvo ${r?.status}; body=${r?.text?.slice(0, 300)}`
  )
})

Then('la respuesta tiene un status de error de cliente', function () {
  const r = ctx(this).lastResponse
  assert.ok(r.status >= 400 && r.status < 500, `status esperado 4xx, fue ${r.status}: ${r.text?.slice(0, 200)}`)
})

Then('la respuesta tiene un status de error de servicio', function () {
  const r = ctx(this).lastResponse
  assert.ok(r.status >= 500 && r.status < 600, `status esperado 5xx, fue ${r.status}: ${r.text?.slice(0, 200)}`)
})

Then('la respuesta JSON tiene la propiedad {string}', function (name) {
  const r = ctx(this).lastResponse
  assert.ok(r.json && Object.prototype.hasOwnProperty.call(r.json, name),
    `Se esperaba la propiedad "${name}". Body: ${r.text?.slice(0, 200)}`)
})

Then('la propiedad {string} de la respuesta JSON vale {string}', function (name, value) {
  const r = ctx(this).lastResponse
  assert.equal(String(getProp(r.json, name)), value)
})

Then('la propiedad {string} de la respuesta JSON es un array no vacío', function (name) {
  const r = ctx(this).lastResponse
  const arr = getProp(r.json, name)
  assert.ok(Array.isArray(arr), `${name} no es array`)
  assert.ok(arr.length > 0, `${name} está vacío`)
})

Then('el cuerpo de la respuesta es un array no vacío', function () {
  const r = ctx(this).lastResponse
  assert.ok(Array.isArray(r.json), 'El cuerpo no es un array')
  assert.ok(r.json.length > 0, 'El array está vacío')
})

Then('cada elemento del array tiene las propiedades {string} y {string}', function (a, b) {
  const r = ctx(this).lastResponse
  assert.ok(Array.isArray(r.json))
  for (const el of r.json) {
    assert.ok(el && Object.prototype.hasOwnProperty.call(el, a), `Falta "${a}" en ${JSON.stringify(el)}`)
    assert.ok(el && Object.prototype.hasOwnProperty.call(el, b), `Falta "${b}" en ${JSON.stringify(el)}`)
  }
})

Then('el cuerpo de la respuesta es un objeto con al menos una clave de idioma', function () {
  const r = ctx(this).lastResponse
  assert.ok(r.json && typeof r.json === 'object' && !Array.isArray(r.json), 'No es objeto')
  assert.ok(Object.keys(r.json).length > 0, 'No tiene claves')
})

Then('la respuesta es un texto que contiene {string}', function (substr) {
  const r = ctx(this).lastResponse
  assert.ok(r.text && r.text.includes(substr), `El cuerpo no contiene "${substr}"; era: ${r.text?.slice(0, 200)}`)
})

Then('guardo la propiedad {string} de la respuesta en la variable {string}', function (prop, varName) {
  const r = ctx(this).lastResponse
  const value = getProp(r.json, prop)
  if (value === undefined) {
    throw new Error(`La propiedad "${prop}" no existe en la respuesta: ${r.text?.slice(0, 200)}`)
  }
  ctx(this).vars[varName] = value
})

Then('guardo el id del rol {string} en la variable {string}', function (roleName, varName) {
  const r = ctx(this).lastResponse
  if (!Array.isArray(r.json)) throw new Error('La respuesta no es un array de roles')
  const role = r.json.find((x) => x && x.nombre === roleName)
  if (!role) throw new Error(`No se encontró el rol "${roleName}" en la respuesta`)
  ctx(this).vars[varName] = role.id
})
