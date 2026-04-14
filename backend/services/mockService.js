'use strict'

// ---------------------------------------------------------------------------
//  Mock service – all business logic backed by the in-memory store.
//  Mirrors the behaviour of src/mockApi.js in the frontend.
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const store = require('../data/mockStore')

const BCRYPT_ROUNDS = 12

// ── Helpers ────────────────────────────────────────────────────────────────

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

async function verifyPassword(input, stored) {
  // Plain-text passwords are used in the initial seed data (demo purposes only).
  // Passwords set through the API are always bcrypt-hashed.
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    return bcrypt.compare(input, stored)
  }
  // Fallback: plain-text comparison for seed users (development/demo only)
  return input === stored
}

// ── Auth ───────────────────────────────────────────────────────────────────

async function loginUser({ dniNie, password }) {
  const storedPassword = store.passwords.get(dniNie)
  if (storedPassword === undefined) {
    return { data: null, error: { message: 'DNI/NIE no encontrado' } }
  }
  if (store.blocked.get(dniNie) === true) {
    return { data: null, error: { message: 'USER_BLOCKED' } }
  }
  if (!(await verifyPassword(password, storedPassword))) {
    return { data: null, error: { message: 'Contraseña incorrecta' } }
  }
  const role = store.roles.get(dniNie) ?? 'user'
  return { data: { dniNie, role }, error: null }
}

async function changePassword({ dniNie, oldPassword, newPassword }) {
  const storedPassword = store.passwords.get(dniNie)
  if (storedPassword === undefined) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  if (!(await verifyPassword(oldPassword, storedPassword))) {
    return { data: null, error: { message: 'La contraseña actual es incorrecta' } }
  }
  const hashed = await hashPassword(newPassword)
  store.passwords.set(dniNie, hashed)
  return { data: { success: true }, error: null }
}

// ── IRPF preguntas ─────────────────────────────────────────────────────────

async function getPreguntas() {
  return { data: store.CATALOGO_PREGUNTAS, error: null }
}

// ── Admin: preguntas_formulario ────────────────────────────────────────────

async function listPreguntasFormulario() {
  const result = []
  store.CATALOGO_PREGUNTAS.secciones.forEach((s) => {
    s.preguntas.forEach((p, idx) => {
      result.push({
        campo: p.id,
        texto: p.texto,
        seccionId: s.id,
        seccionTitulo: s.titulo,
        orden: p._orden !== undefined ? p._orden : idx,
        indentada: p.indentada ?? false,
        condicionCampo: p.condicion?.campo ?? null,
        condicionValor: p.condicion?.valor ?? null,
        actualizadaEn: p._actualizadaEn ?? null,
      })
    })
  })
  return { data: result, error: null }
}

async function updatePreguntaFormulario(campo, { texto, orden, indentada }) {
  if (!campo) return { data: null, error: { message: 'El campo es obligatorio' } }

  for (const seccion of store.CATALOGO_PREGUNTAS.secciones) {
    const pregunta = seccion.preguntas.find((p) => p.id === campo)
    if (pregunta) {
      if (texto !== undefined) {
        if (!String(texto).trim()) return { data: null, error: { message: 'El texto no puede estar vacío' } }
        pregunta.texto = texto
        if (pregunta.textos) pregunta.textos.es = texto
      }
      if (indentada !== undefined) pregunta.indentada = Boolean(indentada)
      if (orden !== undefined) pregunta._orden = Number(orden)
      pregunta._actualizadaEn = new Date().toISOString()
      const idx = seccion.preguntas.indexOf(pregunta)
      return {
        data: {
          campo: pregunta.id,
          texto: pregunta.texto,
          seccionId: seccion.id,
          seccionTitulo: seccion.titulo,
          orden: pregunta._orden !== undefined ? pregunta._orden : idx,
          indentada: pregunta.indentada ?? false,
          condicionCampo: pregunta.condicion?.campo ?? null,
          condicionValor: pregunta.condicion?.valor ?? null,
          actualizadaEn: pregunta._actualizadaEn,
        },
        error: null,
      }
    }
  }
  return { data: null, error: { message: 'Pregunta no encontrada' } }
}

// ── Declaraciones ──────────────────────────────────────────────────────────

async function listDeclaraciones({ dniNie, estado, page = 1, limit = 10 }) {
  let resultado = [...store.declaraciones]
  if (dniNie) resultado = resultado.filter((d) => d.dniNie === dniNie)
  if (estado) resultado = resultado.filter((d) => d.estado === estado)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

async function listDeclaracionesAll({ dniNie, estado, page = 1, limit = 20 }) {
  let resultado = [...store.declaraciones]
  if (dniNie)
    resultado = resultado.filter((d) =>
      d.dniNie.toLowerCase().includes(dniNie.toLowerCase())
    )
  if (estado) resultado = resultado.filter((d) => d.estado === estado)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

async function createDeclaracion(body, _files = {}) {
  const ahora = new Date().toISOString()
  const id = store.generarId()
  const nueva = {
    id,
    estado: 'recibido',
    creadoEn: ahora,
    actualizadoEn: ahora,
    nombre: body.nombre ?? '',
    apellidos: body.apellidos ?? '',
    dniNie: body.dniNie ?? '',
    email: body.email ?? '',
    telefono: body.telefono ?? '',
    viviendaAlquiler: body.viviendaAlquiler,
    ...(body.alquilerMenos35 !== undefined && { alquilerMenos35: body.alquilerMenos35 }),
    viviendaPropiedad: body.viviendaPropiedad,
    ...(body.propiedadAntes2013 !== undefined && { propiedadAntes2013: body.propiedadAntes2013 }),
    pisosAlquiladosTerceros: body.pisosAlquiladosTerceros,
    segundaResidencia: body.segundaResidencia,
    familiaNumerosa: body.familiaNumerosa,
    ayudasGobierno: body.ayudasGobierno,
    mayores65ACargo: body.mayores65ACargo,
    ...(body.mayoresConviven !== undefined && { mayoresConviven: body.mayoresConviven }),
    hijosMenores26: body.hijosMenores26,
    ingresosJuego: body.ingresosJuego,
    ingresosInversiones: body.ingresosInversiones,
    comentarios: body.comentarios ?? '',
    documentos: [],
  }
  store.declaraciones.push(nueva)
  return { data: { id, estado: 'recibido', creadoEn: ahora }, error: null, status: 201 }
}

async function getDeclaracion(id) {
  const dec = store.declaraciones.find((d) => d.id === id)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
  return { data: dec, error: null }
}

async function getDeclaracionByToken(token) {
  if (!token) return { data: null, error: { message: 'Token requerido' } }
  const dec = store.declaraciones.find((d) => d.id === token.trim())
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
  return { data: dec, error: null }
}

async function updateEstadoDeclaracion(id, estado) {
  const idx = store.declaraciones.findIndex((d) => d.id === id)
  if (idx === -1) return { data: null, error: { message: 'Declaración no encontrada' } }
  store.declaraciones[idx] = {
    ...store.declaraciones[idx],
    estado,
    actualizadoEn: new Date().toISOString(),
  }
  return { data: store.declaraciones[idx], error: null }
}

async function updateDeclaracion(id, body, _files = {}) {
  const idx = store.declaraciones.findIndex((d) => d.id === id)
  if (idx === -1) return { data: null, error: { message: 'Declaración no encontrada' } }
  store.declaraciones[idx] = {
    ...store.declaraciones[idx],
    ...body,
    id,
    actualizadoEn: new Date().toISOString(),
  }
  return { data: store.declaraciones[idx], error: null }
}

async function deleteDeclaracion(id) {
  const idx = store.declaraciones.findIndex((d) => d.id === id)
  if (idx === -1) return { data: null, error: { message: 'Declaración no encontrada' } }
  store.declaraciones.splice(idx, 1)
  return { data: { success: true }, error: null }
}

async function sendEmailDeclaracion({ declaracionId, email, mensaje }) {
  console.info(`[MOCK EMAIL] → ${email} (declaracion: ${declaracionId}): ${mensaje ?? 'Notificación enviada.'}`)
  return { data: { success: true, to: email }, error: null }
}

// ── Admin: Secciones ───────────────────────────────────────────────────────

async function listSeccionesAdmin({ activa, page = 1, limit = 10 }) {
  let resultado = [...store.secciones]
  if (activa !== undefined) resultado = resultado.filter((s) => s.activa === activa)
  resultado.sort((a, b) => a.orden - b.orden)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

async function createSeccionAdmin(body) {
  if (!body.nombre || !body.nombre.trim()) {
    return { data: null, error: { message: 'El nombre es obligatorio' }, status: 400 }
  }
  const duplicate = store.secciones.find(
    (s) => s.nombre.toLowerCase() === body.nombre.trim().toLowerCase()
  )
  if (duplicate) {
    return { data: null, error: { message: 'Ya existe una sección con ese nombre' }, status: 409 }
  }
  const ahora = new Date().toISOString()
  const nueva = {
    id: store.generarSeccionId(),
    nombre: body.nombre.trim(),
    orden: body.orden ?? store.secciones.length + 1,
    activa: body.activa !== undefined ? body.activa : true,
    creadaEn: ahora,
    actualizadaEn: ahora,
  }
  store.secciones.push(nueva)
  return { data: nueva, error: null, status: 201 }
}

async function updateSeccionAdmin(id, body) {
  const idx = store.secciones.findIndex((s) => s.id === id)
  if (idx === -1) return { data: null, error: { message: 'Sección no encontrada' } }
  if (body.nombre !== undefined) {
    const dup = store.secciones.find(
      (s, i) => i !== idx && s.nombre.toLowerCase() === body.nombre.trim().toLowerCase()
    )
    if (dup) return { data: null, error: { message: 'Ya existe una sección con ese nombre' } }
  }
  store.secciones[idx] = {
    ...store.secciones[idx],
    ...body,
    ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
    id,
    actualizadaEn: new Date().toISOString(),
  }
  return { data: store.secciones[idx], error: null }
}

async function deleteSeccionAdmin(id) {
  const idx = store.secciones.findIndex((s) => s.id === id)
  if (idx === -1) return { data: null, error: { message: 'Sección no encontrada' } }
  const nombre = store.secciones[idx].nombre
  const enUso = store.preguntasAdicionales.some((p) => p.seccion === nombre)
  if (enUso) {
    return {
      data: null,
      error: { message: 'No se puede eliminar: hay preguntas asignadas a esta sección' },
    }
  }
  store.secciones.splice(idx, 1)
  return { data: { success: true }, error: null }
}

async function getSeccionDeclaraciones(id) {
  const seccion = store.secciones.find((s) => s.id === id)
  if (!seccion) return { data: null, error: { message: 'Sección no encontrada' } }
  const preguntasEnSeccion = store.preguntasAdicionales.filter(
    (p) => p.seccion === seccion.nombre
  )
  const preguntaIds = new Set(preguntasEnSeccion.map((p) => p.id))
  const declaracionIds = [
    ...new Set(
      store.declaracionPreguntas
        .filter((dp) => preguntaIds.has(dp.preguntaId))
        .map((dp) => dp.declaracionId)
    ),
  ]
  const declaraciones = declaracionIds.map((decId) => {
    const dec = store.declaraciones.find((d) => d.id === decId)
    return dec
      ? { id: dec.id, dniNie: dec.dniNie, nombre: `${dec.nombre} ${dec.apellidos}` }
      : { id: decId, dniNie: '—', nombre: '—' }
  })
  return { data: { data: declaraciones, total: declaraciones.length }, error: null }
}

async function getSeccionPreguntas(id) {
  const seccion = store.secciones.find((s) => s.id === id)
  if (!seccion) return { data: null, error: { message: 'Sección no encontrada' } }
  const preguntas = store.preguntasAdicionales.filter((p) => p.seccion === seccion.nombre)
  return { data: { data: preguntas, total: preguntas.length }, error: null }
}

// ── Admin: Usuarios ────────────────────────────────────────────────────────

async function listUsersAdmin({ bloqueado, denunciado, page = 1, limit = 10 }) {
  let resultado = store.users.map((u) => ({
    ...u,
    bloqueado: store.blocked.get(u.dniNie) ?? false,
    denunciado: store.reported.get(u.dniNie) ?? false,
    preguntasAsignadas: store.userPreguntas.get(u.dniNie) ?? [],
    seccionesAsignadas: store.userSecciones.get(u.dniNie) ?? [],
  }))
  if (bloqueado !== undefined) resultado = resultado.filter((u) => u.bloqueado === bloqueado)
  if (denunciado !== undefined) resultado = resultado.filter((u) => u.denunciado === denunciado)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

async function blockUser(dniNie, bloqueado) {
  if (!store.users.find((u) => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  store.blocked.set(dniNie, !!bloqueado)
  return { data: { success: true }, error: null }
}

async function reportUser(dniNie, denunciado) {
  if (!store.users.find((u) => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  store.reported.set(dniNie, !!denunciado)
  return { data: { success: true }, error: null }
}

async function deleteUser(dniNie) {
  const idx = store.users.findIndex((u) => u.dniNie === dniNie)
  if (idx === -1) return { data: null, error: { message: 'Usuario no encontrado' } }
  store.users.splice(idx, 1)
  store.blocked.delete(dniNie)
  store.reported.delete(dniNie)
  store.userPreguntas.delete(dniNie)
  store.userSecciones.delete(dniNie)
  store.passwords.delete(dniNie)
  store.roles.delete(dniNie)
  const decIds = store.declaraciones.filter((d) => d.dniNie === dniNie).map((d) => d.id)
  decIds.forEach((decId) => {
    const i = store.declaraciones.findIndex((d) => d.id === decId)
    if (i !== -1) store.declaraciones.splice(i, 1)
    for (let j = store.declaracionPreguntas.length - 1; j >= 0; j--) {
      if (store.declaracionPreguntas[j].declaracionId === decId)
        store.declaracionPreguntas.splice(j, 1)
    }
  })
  return { data: { success: true }, error: null }
}

async function assignUserAccount({ dniNie, password, declaracionId }) {
  if (!dniNie || !password) {
    return { data: null, error: { message: 'DNI/NIE y contraseña son obligatorios' } }
  }
  const dec = store.declaraciones.find((d) => d.id === declaracionId)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
  const existing = store.users.find((u) => u.dniNie === dniNie)
  const isNew = !existing
  if (isNew) {
    const ahora = new Date().toISOString()
    const newUser = {
      dniNie,
      nombre: dec.nombre ?? '',
      apellidos: dec.apellidos ?? '',
      email: dec.email ?? '',
      telefono: dec.telefono ?? '',
      role: 'user',
      creadoEn: ahora,
    }
    store.users.push(newUser)
    store.blocked.set(dniNie, false)
    store.reported.set(dniNie, false)
    store.userPreguntas.set(dniNie, [])
    store.userSecciones.set(dniNie, [])
    store.roles.set(dniNie, 'user')
  }
  const hashed = await hashPassword(password)
  store.passwords.set(dniNie, hashed)
  return { data: { created: isNew, dniNie }, error: null }
}

async function getUserByDniNie(dniNie) {
  const user = store.users.find((u) => u.dniNie === dniNie)
  return { data: user ?? null, error: null }
}

async function sendEmailToUser({ dniNie, email, mensaje }) {
  console.info(
    `[MOCK EMAIL → USUARIO] → ${email} (${dniNie}): ${mensaje ?? 'Notificación enviada.'}`
  )
  return { data: { success: true, to: email }, error: null }
}

async function setUserSecciones(dniNie, seccionIds) {
  if (!store.users.find((u) => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  for (const id of seccionIds) {
    if (!store.secciones.find((s) => s.id === id)) {
      return { data: null, error: { message: `Sección ${id} no encontrada` } }
    }
  }
  store.userSecciones.set(dniNie, [...seccionIds])
  return { data: { success: true }, error: null }
}

// ── Admin: Idiomas ─────────────────────────────────────────────────────────

async function listIdiomasAdmin({ activo, page = 1, limit = 10 }) {
  let resultado = [...store.idiomas]
  if (activo !== undefined && activo !== '') {
    const flag = activo === true || activo === 'true'
    resultado = resultado.filter((i) => i.activo === flag)
  }
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

async function createIdiomaAdmin(body) {
  const { code, label } = body
  if (!code?.trim() || !label?.trim()) {
    return { data: null, error: { message: 'El código y la etiqueta son obligatorios' } }
  }
  if (store.idiomas.find((i) => i.code === code.trim())) {
    return { data: null, error: { message: `Ya existe un idioma con el código "${code}"` } }
  }
  const ahora = new Date().toISOString()
  const nuevo = {
    id: store.generarIdiomaId(),
    code: code.trim(),
    label: label.trim(),
    activo: body.activo !== false,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  store.idiomas.push(nuevo)
  if (!store.translations[nuevo.code]) store.translations[nuevo.code] = {}
  return { data: nuevo, error: null }
}

async function updateIdiomaAdmin(id, body) {
  const idx = store.idiomas.findIndex((i) => i.id === id)
  if (idx === -1) return { data: null, error: { message: 'Idioma no encontrado' } }
  const { label, activo } = body
  store.idiomas[idx] = {
    ...store.idiomas[idx],
    ...(label !== undefined && { label: label.trim() }),
    ...(activo !== undefined && { activo }),
    actualizadoEn: new Date().toISOString(),
  }
  return { data: store.idiomas[idx], error: null }
}

async function deleteIdiomaAdmin(id) {
  const idx = store.idiomas.findIndex((i) => i.id === id)
  if (idx === -1) return { data: null, error: { message: 'Idioma no encontrado' } }
  if (store.idiomas[idx].code === 'es') {
    return { data: null, error: { message: 'No se puede eliminar el idioma por defecto (es)' } }
  }
  store.idiomas.splice(idx, 1)
  return { data: { success: true }, error: null }
}

async function getIdiomaContent(id) {
  const idioma = store.idiomas.find((i) => i.id === id)
  if (!idioma) return { data: null, error: { message: 'Idioma no encontrado' } }
  const content = store.translations[idioma.code] ?? {}
  return { data: { code: idioma.code, content }, error: null }
}

async function updateIdiomaContent(id, body) {
  const idioma = store.idiomas.find((i) => i.id === id)
  if (!idioma) return { data: null, error: { message: 'Idioma no encontrado' } }
  store.translations[idioma.code] = {
    ...(store.translations[idioma.code] ?? {}),
    ...body.content,
  }
  return { data: { code: idioma.code, content: store.translations[idioma.code] }, error: null }
}

// ── Admin: Preguntas adicionales ───────────────────────────────────────────

async function listPreguntasAdmin({ activa, page = 1, limit = 10 } = {}) {
  let resultado = [...store.preguntasAdicionales]
  if (activa !== undefined) {
    resultado = resultado.filter((p) => p.activa === activa)
  }
  resultado.sort((a, b) => a.orden - b.orden)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

async function createPreguntaAdmin({ texto, seccion, tipoRespuesta, orden = 0, activa = true, obligatoria = false } = {}) {
  if (!texto || !String(texto).trim()) return { data: null, error: { message: 'El texto es obligatorio' } }
  if (!seccion || !String(seccion).trim()) return { data: null, error: { message: 'La sección es obligatoria' } }
  const ahora = new Date().toISOString()
  const nueva = {
    id: store.generarPreguntaId(),
    texto: texto.trim(),
    seccion: seccion.trim(),
    tipoRespuesta: tipoRespuesta ?? 'yn',
    orden: Number(orden),
    activa: Boolean(activa),
    obligatoria: Boolean(obligatoria),
    creadaEn: ahora,
    actualizadaEn: ahora,
  }
  store.preguntasAdicionales.push(nueva)
  return { data: nueva, error: null, status: 201 }
}

async function updatePreguntaAdmin(id, body) {
  const idx = store.preguntasAdicionales.findIndex((p) => p.id === id)
  if (idx === -1) return { data: null, error: { message: 'Pregunta no encontrada' } }
  store.preguntasAdicionales[idx] = {
    ...store.preguntasAdicionales[idx],
    ...body,
    id,
    actualizadaEn: new Date().toISOString(),
  }
  return { data: store.preguntasAdicionales[idx], error: null }
}

async function deletePreguntaAdmin(id) {
  const idx = store.preguntasAdicionales.findIndex((p) => p.id === id)
  if (idx === -1) return { data: null, error: { message: 'Pregunta no encontrada' } }
  store.preguntasAdicionales.splice(idx, 1)
  for (let j = store.declaracionPreguntas.length - 1; j >= 0; j--) {
    if (store.declaracionPreguntas[j].preguntaId === id) store.declaracionPreguntas.splice(j, 1)
  }
  return { data: { success: true }, error: null }
}

// ── Declaración ↔ Preguntas adicionales ───────────────────────────────────

async function getDeclaracionPreguntas(declaracionId) {
  const dec = store.declaraciones.find((d) => d.id === declaracionId)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
  const asignaciones = store.declaracionPreguntas
    .filter((dp) => dp.declaracionId === declaracionId)
    .map((dp) => ({
      ...dp,
      pregunta: store.preguntasAdicionales.find((p) => p.id === dp.preguntaId) ?? null,
    }))
  return { data: { data: asignaciones, total: asignaciones.length }, error: null }
}

async function upsertDeclaracionPreguntas(declaracionId, asignaciones = []) {
  const dec = store.declaraciones.find((d) => d.id === declaracionId)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
  for (const a of asignaciones) {
    const preguntaExiste = store.preguntasAdicionales.some((p) => p.id === a.preguntaId)
    if (!preguntaExiste) return { data: null, error: { message: `Pregunta ${a.preguntaId} no encontrada` } }
    const existente = store.declaracionPreguntas.find(
      (dp) => dp.declaracionId === declaracionId && dp.preguntaId === a.preguntaId
    )
    const ahora = new Date().toISOString()
    if (existente) {
      existente.respuesta = a.respuesta ?? existente.respuesta
      if (a.respuesta !== undefined && a.respuesta !== null) existente.respondidaEn = ahora
    } else {
      store.declaracionPreguntas.push({
        id: store.generarDpId(),
        declaracionId,
        preguntaId: a.preguntaId,
        respuesta: a.respuesta ?? null,
        asignadaEn: ahora,
        respondidaEn: (a.respuesta !== null && a.respuesta !== undefined) ? ahora : null,
      })
    }
  }
  return getDeclaracionPreguntas(declaracionId)
}

async function removeDeclaracionPregunta(declaracionId, preguntaId) {
  const idx = store.declaracionPreguntas.findIndex(
    (dp) => dp.declaracionId === declaracionId && dp.preguntaId === preguntaId
  )
  if (idx === -1) return { data: null, error: { message: 'Asignación no encontrada' } }
  store.declaracionPreguntas.splice(idx, 1)
  return { data: { success: true }, error: null }
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  loginUser,
  changePassword,
  getPreguntas,
  listDeclaraciones,
  listDeclaracionesAll,
  createDeclaracion,
  getDeclaracion,
  getDeclaracionByToken,
  updateEstadoDeclaracion,
  updateDeclaracion,
  deleteDeclaracion,
  sendEmailDeclaracion,
  getDocumento: async () => ({ data: null, error: { message: 'No disponible en modo mock' } }),
  deleteDocumento: async () => ({ data: null, error: { message: 'No disponible en modo mock' } }),
  listPreguntasFormulario,
  updatePreguntaFormulario,
  listSeccionesAdmin,
  createSeccionAdmin,
  updateSeccionAdmin,
  deleteSeccionAdmin,
  getSeccionDeclaraciones,
  getSeccionPreguntas,
  listUsersAdmin,
  blockUser,
  reportUser,
  deleteUser,
  assignUserAccount,
  getUserByDniNie,
  sendEmailToUser,
  setUserSecciones,
  listIdiomasAdmin,
  createIdiomaAdmin,
  updateIdiomaAdmin,
  deleteIdiomaAdmin,
  getIdiomaContent,
  updateIdiomaContent,
  listPreguntasAdmin,
  createPreguntaAdmin,
  updatePreguntaAdmin,
  deletePreguntaAdmin,
  getDeclaracionPreguntas,
  upsertDeclaracionPreguntas,
  removeDeclaracionPregunta,
}
