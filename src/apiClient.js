// ---------------------------------------------------------------------------
//  API client – all calls go through the backend REST API.
// ---------------------------------------------------------------------------

import { API_BASE_URL } from './constants.js'

// ── Helpers ────────────────────────────────────────────────────────────────

async function request(method, path, { body, query } = {}) {
  let url = `${API_BASE_URL}${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.append(k, v)
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  try {
    const res = await fetch(url, opts)
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      return { data: null, error: { message: json?.error ?? res.statusText }, response: { status: res.status } }
    }
    return { data: json, error: null, response: { status: res.status } }
  } catch (err) {
    return { data: null, error: { message: err.message ?? 'Error de red' } }
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function loginUser({ dniNie, password }) {
  return request('POST', '/auth/login', { body: { dniNie, password } })
}

export async function changePassword({ dniNie, oldPassword, newPassword }) {
  return request('POST', '/auth/change-password', { body: { dniNie, oldPassword, newPassword } })
}

// ── IRPF preguntas ─────────────────────────────────────────────────────────

export async function getPreguntas() {
  return request('GET', '/irpf/preguntas')
}

// ── Declaraciones ──────────────────────────────────────────────────────────

export async function listDeclaraciones(options) {
  const { dniNie, estado, page, limit } = options?.query ?? {}
  return request('GET', '/irpf/declaraciones', { query: { dniNie, estado, page, limit } })
}

export async function listDeclaracionesAll(options) {
  const { dniNie, estado, page, limit } = options?.query ?? {}
  return request('GET', '/irpf/declaraciones/all', { query: { dniNie, estado, page, limit } })
}

export async function createDeclaracion(options) {
  const body = options?.body ?? {}
  return request('POST', '/irpf/declaraciones', { body })
}

export async function getDeclaracion(options) {
  const id = options?.path?.id
  return request('GET', `/irpf/declaraciones/${encodeURIComponent(id)}`)
}

export async function getDeclaracionByToken(options) {
  const token = options?.token?.trim()
  if (!token) return { data: null, error: { message: 'Token requerido' } }
  return request('GET', `/irpf/consulta/${encodeURIComponent(token)}`)
}

export async function updateEstadoDeclaracion(options) {
  const id = options?.path?.id
  const estado = options?.body?.estado
  return request('PATCH', `/irpf/declaraciones/${encodeURIComponent(id)}`, { body: { estado } })
}

export async function updateDeclaracion(options) {
  const id = options?.path?.id
  const body = options?.body ?? {}
  return request('PUT', `/irpf/declaraciones/${encodeURIComponent(id)}`, { body })
}

export async function deleteDeclaracion(options) {
  const id = options?.path?.id
  return request('DELETE', `/irpf/declaraciones/${encodeURIComponent(id)}`)
}

export async function sendEmailDeclaracion({ declaracionId, email, mensaje }) {
  return request('POST', `/irpf/declaraciones/${encodeURIComponent(declaracionId)}/email`, {
    body: { email, mensaje },
  })
}

// ── Admin: Preguntas del formulario ───────────────────────────────────────

export async function listPreguntasFormulario(options = {}) {
  const { page, limit } = options.query ?? {}
  return request('GET', '/admin/preguntas-formulario', { query: { page, limit } })
}

export async function createPreguntaFormulario(options) {
  const body = options?.body ?? {}
  return request('POST', '/admin/preguntas-formulario', { body })
}

export async function updatePreguntaFormulario(options) {
  const id = options?.path?.id
  const body = options?.body ?? {}
  return request('PUT', `/admin/preguntas-formulario/${encodeURIComponent(id)}`, { body })
}

export async function deletePreguntaFormulario(options) {
  const id = options?.path?.id
  return request('DELETE', `/admin/preguntas-formulario/${encodeURIComponent(id)}`)
}

// ── Admin: Usuarios ────────────────────────────────────────────────────────

export async function listUsersAdmin(options) {
  const { bloqueado, denunciado, search, page, limit } = options?.query ?? {}
  return request('GET', '/admin/users', { query: { bloqueado, denunciado, search, page, limit } })
}

export async function assignUserAccount({ dniNie, password, declaracionId }) {
  return request('POST', '/admin/users/assign', { body: { dniNie, password, declaracionId } })
}

export async function getUserByDniNie({ dniNie }) {
  return request('GET', `/admin/users/${encodeURIComponent(dniNie)}`)
}

export async function blockUser(options) {
  const { dniNie } = options?.path ?? {}
  const { bloqueado } = options?.body ?? {}
  return request('PATCH', `/admin/users/${encodeURIComponent(dniNie)}/block`, { body: { bloqueado } })
}

export async function reportUser(options) {
  const { dniNie } = options?.path ?? {}
  const { denunciado } = options?.body ?? {}
  return request('PATCH', `/admin/users/${encodeURIComponent(dniNie)}/report`, { body: { denunciado } })
}

export async function deleteUser(options) {
  const { dniNie } = options?.path ?? {}
  return request('DELETE', `/admin/users/${encodeURIComponent(dniNie)}`)
}

export async function sendEmailToUser({ dniNie, email, mensaje }) {
  return request('POST', `/admin/users/${encodeURIComponent(dniNie)}/email`, {
    body: { email, mensaje },
  })
}

// ── Idiomas & Traducciones ─────────────────────────────────────────────────

export async function getIdiomas() {
  return request('GET', '/irpf/idiomas')
}

export async function getTraducciones() {
  return request('GET', '/irpf/traducciones')
}

export async function listIdiomasAdmin(options = {}) {
  const { query } = options
  return request('GET', '/admin/idiomas', { query })
}

export async function createIdiomaAdmin({ body } = {}) {
  return request('POST', '/admin/idiomas', { body })
}

export async function updateIdiomaAdmin({ path: { id } = {}, body } = {}) {
  return request('PUT', `/admin/idiomas/${encodeURIComponent(id)}`, { body })
}

export async function deleteIdiomaAdmin({ path: { id } = {} } = {}) {
  return request('DELETE', `/admin/idiomas/${encodeURIComponent(id)}`)
}

export async function getIdiomaContent({ path: { id } = {} } = {}) {
  return request('GET', `/admin/idiomas/${encodeURIComponent(id)}/content`)
}

export async function updateIdiomaContent({ path: { id } = {}, body } = {}) {
  return request('PUT', `/admin/idiomas/${encodeURIComponent(id)}/content`, { body })
}

// ── PDF upload (stored as part of declaración) ─────────────────────────────
// We update the declaración with the rentaPdf field so the data persists
// across page reloads via the DB.

export async function uploadRentaPdf({ declaracionId, nombre, dataUrl }) {
  const pdfData = dataUrl ? { nombre, dataUrl } : null
  return updateDeclaracion({
    path: { id: declaracionId },
    body: { rentaPdf: pdfData },
  })
}
