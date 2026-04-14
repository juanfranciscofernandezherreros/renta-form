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

  // If any file fields are present, send as multipart/form-data
  const fileFields = ['docDniAnverso', 'docDniReverso', 'docAdicional']
  const hasFiles = fileFields.some(f => body[f] != null)

  if (hasFiles) {
    const fd = new FormData()
    for (const [key, value] of Object.entries(body)) {
      if (value == null) continue
      if (fileFields.includes(key)) {
        if (Array.isArray(value)) {
          for (const file of value) {
            fd.append(key, file)
          }
        } else {
          fd.append(key, value)
        }
      } else {
        fd.append(key, String(value))
      }
    }

    let url = `${API_BASE_URL}/irpf/declaraciones`
    try {
      const res = await fetch(url, { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { data: null, error: { message: json?.error ?? res.statusText }, response: { status: res.status } }
      }
      return { data: json, error: null, response: { status: res.status } }
    } catch (err) {
      return { data: null, error: { message: err.message ?? 'Error de red' } }
    }
  }

  return request('POST', '/irpf/declaraciones', { body })
}

export function getDocumentoUrl(docId) {
  return `${API_BASE_URL}/irpf/documentos/${encodeURIComponent(docId)}`
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

  // If any file fields are present, send as multipart/form-data
  const fileFields = ['docDniAnverso', 'docDniReverso', 'docAdicional']
  const hasFiles = fileFields.some(f => body[f] != null)

  if (hasFiles) {
    const fd = new FormData()
    for (const [key, value] of Object.entries(body)) {
      if (value == null) continue
      if (fileFields.includes(key)) {
        if (Array.isArray(value)) {
          for (const file of value) {
            fd.append(key, file)
          }
        } else {
          fd.append(key, value)
        }
      } else {
        fd.append(key, String(value))
      }
    }
    const url = `${API_BASE_URL}/irpf/declaraciones/${encodeURIComponent(id)}`
    try {
      const res = await fetch(url, { method: 'PUT', body: fd })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { data: null, error: { message: json?.error ?? res.statusText }, response: { status: res.status } }
      }
      return { data: json, error: null, response: { status: res.status } }
    } catch (err) {
      return { data: null, error: { message: err.message ?? 'Error de red' } }
    }
  }

  return request('PUT', `/irpf/declaraciones/${encodeURIComponent(id)}`, { body })
}

export async function deleteDocumento(options) {
  const docId = options?.path?.docId
  return request('DELETE', `/irpf/documentos/${encodeURIComponent(docId)}`)
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

// ── Admin: Preguntas adicionales ──────────────────────────────────────────

export async function listPreguntasAdmin(options) {
  const { activa, page, limit } = options?.query ?? {}
  return request('GET', '/admin/preguntas', { query: { activa, page, limit } })
}

export async function createPreguntaAdmin(options) {
  const body = options?.body ?? {}
  return request('POST', '/admin/preguntas', { body })
}

export async function updatePreguntaAdmin(options) {
  const id = options?.path?.id
  const body = options?.body ?? {}
  return request('PUT', `/admin/preguntas/${encodeURIComponent(id)}`, { body })
}

export async function deletePreguntaAdmin(options) {
  const id = options?.path?.id
  return request('DELETE', `/admin/preguntas/${encodeURIComponent(id)}`)
}

// ── Declaración ↔ Preguntas adicionales ──────────────────────────────────

export async function getDeclaracionPreguntas(options) {
  const id = options?.path?.id
  return request('GET', `/irpf/declaraciones/${encodeURIComponent(id)}/preguntas`)
}

export async function upsertDeclaracionPreguntas(options) {
  const id = options?.path?.id
  const { asignaciones = [] } = options?.body ?? {}
  return request('POST', `/irpf/declaraciones/${encodeURIComponent(id)}/preguntas`, {
    body: { asignaciones },
  })
}

export async function removeDeclaracionPregunta(options) {
  const { id, preguntaId } = options?.path ?? {}
  return request('DELETE', `/irpf/declaraciones/${encodeURIComponent(id)}/preguntas/${encodeURIComponent(preguntaId)}`)
}

// ── Admin: Preguntas del formulario ───────────────────────────────────────

export async function listPreguntasFormulario() {
  return request('GET', '/admin/preguntas-formulario')
}

export async function listSeccionesFormulario() {
  return request('GET', '/admin/secciones-formulario')
}

export async function createPreguntaFormulario(options) {
  const body = options?.body ?? {}
  return request('POST', '/admin/preguntas-formulario', { body })
}

export async function updatePreguntaFormulario(options) {
  const campo = options?.path?.campo
  const body = options?.body ?? {}
  return request('PUT', `/admin/preguntas-formulario/${encodeURIComponent(campo)}`, { body })
}

export async function deletePreguntaFormulario(options) {
  const campo = options?.path?.campo
  return request('DELETE', `/admin/preguntas-formulario/${encodeURIComponent(campo)}`)
}

// ── Admin: Secciones ───────────────────────────────────────────────────────

export async function listSeccionesAdmin(options) {
  const { activa, page, limit } = options?.query ?? {}
  return request('GET', '/admin/secciones', { query: { activa, page, limit } })
}

export async function createSeccionAdmin(options) {
  const body = options?.body ?? {}
  return request('POST', '/admin/secciones', { body })
}

export async function updateSeccionAdmin(options) {
  const id = options?.path?.id
  const body = options?.body ?? {}
  return request('PUT', `/admin/secciones/${encodeURIComponent(id)}`, { body })
}

export async function deleteSeccionAdmin(options) {
  const id = options?.path?.id
  return request('DELETE', `/admin/secciones/${encodeURIComponent(id)}`)
}

export async function getSeccionDeclaraciones(options) {
  const id = options?.path?.id
  return request('GET', `/admin/secciones/${encodeURIComponent(id)}/declaraciones`)
}

export async function getSeccionPreguntas(options) {
  const id = options?.path?.id
  return request('GET', `/admin/secciones/${encodeURIComponent(id)}/preguntas`)
}

// ── Admin: Usuarios ────────────────────────────────────────────────────────

export async function listUsersAdmin(options) {
  const { bloqueado, denunciado, page, limit } = options?.query ?? {}
  return request('GET', '/admin/users', { query: { bloqueado, denunciado, page, limit } })
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

export async function setUserSecciones(options) {
  const { dniNie } = options?.path ?? {}
  const { seccionIds } = options?.body ?? {}
  return request('PUT', `/admin/users/${encodeURIComponent(dniNie)}/secciones`, {
    body: { seccionIds },
  })
}

// ── Admin: Idiomas ─────────────────────────────────────────────────────────

export async function listIdiomasAdmin(options) {
  const { activo, page, limit } = options?.query ?? {}
  return request('GET', '/admin/idiomas', { query: { activo, page, limit } })
}

export async function createIdiomaAdmin(options) {
  const body = options?.body ?? {}
  return request('POST', '/admin/idiomas', { body })
}

export async function updateIdiomaAdmin(options) {
  const id = options?.path?.id
  const body = options?.body ?? {}
  return request('PUT', `/admin/idiomas/${encodeURIComponent(id)}`, { body })
}

export async function deleteIdiomaAdmin(options) {
  const id = options?.path?.id
  return request('DELETE', `/admin/idiomas/${encodeURIComponent(id)}`)
}

export async function getIdiomaContent(options) {
  const id = options?.path?.id
  return request('GET', `/admin/idiomas/${encodeURIComponent(id)}/content`)
}

export async function updateIdiomaContent(options) {
  const id = options?.path?.id
  const body = options?.body ?? {}
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
