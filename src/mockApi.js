// ---------------------------------------------------------------------------
// MOCK API – implementaciones en memoria para el modo demo
// Reemplaza las llamadas reales a la API cuando DEMO_MODE está activado.
// ---------------------------------------------------------------------------
import {
  CATALOGO_PREGUNTAS,
  declaracionesStore,
  passwordsStore,
  rolesStore,
  generarId,
  preguntasAdicionalesStore,
  declaracionPreguntaStore,
  generarPreguntaId,
  generarDpId,
  seccionesStore,
  generarSeccionId,
  usersStore,
  blockedStore,
  reportedStore,
  userPreguntasStore,
  userSeccionesStore,
} from './demoData.js'

/** Simula un pequeño retardo de red (ms). */
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Mock de getPreguntas – devuelve el catálogo estático de preguntas.
 * @returns {Promise<{ data: import('./api/types.gen').CatalogoPreguntas, error: null }>}
 */
export async function getPreguntas() {
  await delay()
  return { data: CATALOGO_PREGUNTAS, error: null }
}

/**
 * Mock de listDeclaraciones – filtra el almacén por dniNie (y opcionalmente estado).
 * @param {{ query?: { dniNie?: string, estado?: string, page?: number, limit?: number } }} options
 * @returns {Promise<{ data: import('./api/types.gen').ListaDeclaraciones, error: null }>}
 */
export async function listDeclaraciones(options) {
  await delay()
  const { dniNie, estado, page = 1, limit = 10 } = options?.query ?? {}
  let resultado = [...declaracionesStore]

  if (dniNie) {
    resultado = resultado.filter(d => d.dniNie === dniNie)
  }
  if (estado) {
    resultado = resultado.filter(d => d.estado === estado)
  }

  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)

  return {
    data: { data, total, page, limit },
    error: null,
  }
}

/**
 * Mock de createDeclaracion – guarda la declaración en el almacén en memoria.
 * @param {{ body: import('./api/types.gen').DeclaracionInput }} options
 * @returns {Promise<{ data: import('./api/types.gen').DeclaracionCreada, error: null, response: { status: number } }>}
 */
export async function createDeclaracion(options) {
  await delay(500)
  const body = options?.body ?? {}
  const ahora = new Date().toISOString()
  const id = generarId()

  /** @type {import('./api/types.gen').Declaracion} */
  const nuevaDeclaracion = {
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

  declaracionesStore.push(nuevaDeclaracion)

  return {
    data: { id, estado: 'recibido', creadoEn: ahora },
    error: null,
    response: { status: 201 },
  }
}

/**
 * Mock de loginUser – valida DNI/NIE y contraseña.
 * @param {{ dniNie: string, password: string }} options
 * @returns {Promise<{ data: { dniNie: string, role: string } | null, error: { message: string } | null }>}
 */
export async function loginUser({ dniNie, password }) {
  await delay()
  const storedPassword = passwordsStore.get(dniNie)
  if (storedPassword === undefined) {
    return { data: null, error: { message: 'DNI/NIE no encontrado' } }
  }
  if (storedPassword !== password) {
    return { data: null, error: { message: 'Contraseña incorrecta' } }
  }
  const role = rolesStore.get(dniNie) ?? 'user'
  return { data: { dniNie, role }, error: null }
}

/**
 * Mock de changePassword – cambia la contraseña de un usuario.
 * @param {{ dniNie: string, oldPassword: string, newPassword: string }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function changePassword({ dniNie, oldPassword, newPassword }) {
  await delay()
  const storedPassword = passwordsStore.get(dniNie)
  if (storedPassword === undefined) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  if (storedPassword !== oldPassword) {
    return { data: null, error: { message: 'La contraseña actual es incorrecta' } }
  }
  passwordsStore.set(dniNie, newPassword)
  return { data: { success: true }, error: null }
}

/**
 * Mock de listDeclaracionesAll – devuelve todas las declaraciones (uso admin).
 * @param {{ query?: { estado?: string, dniNie?: string, page?: number, limit?: number } }} options
 * @returns {Promise<{ data: import('./api/types.gen').ListaDeclaraciones, error: null }>}
 */
export async function listDeclaracionesAll(options) {
  await delay()
  const { dniNie, estado, page = 1, limit = 20 } = options?.query ?? {}
  let resultado = [...declaracionesStore]

  if (dniNie) {
    resultado = resultado.filter(d => d.dniNie.toLowerCase().includes(dniNie.toLowerCase()))
  }
  if (estado) {
    resultado = resultado.filter(d => d.estado === estado)
  }

  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)

  return { data: { data, total, page, limit }, error: null }
}

/**
 * Mock de getDeclaracion – obtiene el detalle de una declaración por id.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: import('./api/types.gen').Declaracion | null, error: { message: string } | null }>}
 */
export async function getDeclaracion(options) {
  await delay()
  const id = options?.path?.id
  const dec = declaracionesStore.find(d => d.id === id)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
  return { data: dec, error: null }
}

/**
 * Mock de updateEstadoDeclaracion – actualiza el estado de una declaración.
 * @param {{ path: { id: string }, body: { estado: string } }} options
 * @returns {Promise<{ data: import('./api/types.gen').Declaracion | null, error: { message: string } | null }>}
 */
export async function updateEstadoDeclaracion(options) {
  await delay()
  const id = options?.path?.id
  const estado = options?.body?.estado
  const idx = declaracionesStore.findIndex(d => d.id === id)
  if (idx === -1) return { data: null, error: { message: 'Declaración no encontrada' } }
  declaracionesStore[idx] = {
    ...declaracionesStore[idx],
    estado,
    actualizadoEn: new Date().toISOString(),
  }
  return { data: declaracionesStore[idx], error: null }
}

/**
 * Mock de deleteDeclaracion – elimina una declaración del almacén.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function deleteDeclaracion(options) {
  await delay()
  const id = options?.path?.id
  const idx = declaracionesStore.findIndex(d => d.id === id)
  if (idx === -1) return { data: null, error: { message: 'Declaración no encontrada' } }
  declaracionesStore.splice(idx, 1)
  return { data: { success: true }, error: null }
}

/**
 * Mock de sendEmailDeclaracion – simula el envío de un email al contribuyente.
 * @param {{ declaracionId: string, email: string, mensaje?: string }} options
 * @returns {Promise<{ data: { success: boolean, to: string } | null, error: null }>}
 */
export async function sendEmailDeclaracion({ declaracionId, email, mensaje }) {
  await delay(600)
  console.info(`[MOCK EMAIL] → ${email} (declaracion: ${declaracionId}): ${mensaje ?? 'Notificación enviada.'}`)
  return { data: { success: true, to: email }, error: null }
}

// ---------------------------------------------------------------------------
// Preguntas adicionales – CRUD admin
// ---------------------------------------------------------------------------

/**
 * Mock de listPreguntasAdmin – devuelve todas las preguntas adicionales.
 * @param {{ query?: { activa?: boolean, page?: number, limit?: number } }} options
 * @returns {Promise<{ data: { data: object[], total: number, page: number, limit: number }, error: null }>}
 */
export async function listPreguntasAdmin(options) {
  await delay()
  let resultado = [...preguntasAdicionalesStore]
  const { activa, page = 1, limit = 10 } = options?.query ?? {}
  if (activa !== undefined) {
    resultado = resultado.filter(p => p.activa === activa)
  }
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

/**
 * Mock de createPreguntaAdmin – crea una nueva pregunta adicional.
 * @param {{ body: { texto: string, seccion: string, tipoRespuesta: string, orden?: number, activa?: boolean } }} options
 * @returns {Promise<{ data: object | null, error: { message: string } | null, response: { status: number } }>}
 */
export async function createPreguntaAdmin(options) {
  await delay(300)
  const body = options?.body ?? {}
  if (!body.texto || !body.seccion || !body.tipoRespuesta) {
    return { data: null, error: { message: 'texto, seccion y tipoRespuesta son obligatorios' }, response: { status: 400 } }
  }
  const ahora = new Date().toISOString()
  const nueva = {
    id: generarPreguntaId(),
    texto: body.texto,
    seccion: body.seccion,
    tipoRespuesta: body.tipoRespuesta,
    orden: body.orden ?? 0,
    activa: body.activa !== undefined ? body.activa : true,
    creadaEn: ahora,
    actualizadaEn: ahora,
  }
  preguntasAdicionalesStore.push(nueva)
  return { data: nueva, error: null, response: { status: 201 } }
}

/**
 * Mock de getPreguntaAdmin – obtiene una pregunta adicional por id.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: object | null, error: { message: string } | null }>}
 */
export async function getPreguntaAdmin(options) {
  await delay()
  const id = options?.path?.id
  const p = preguntasAdicionalesStore.find(p => p.id === id)
  if (!p) return { data: null, error: { message: 'Pregunta no encontrada' } }
  return { data: p, error: null }
}

/**
 * Mock de updatePreguntaAdmin – actualiza una pregunta adicional.
 * @param {{ path: { id: string }, body: object }} options
 * @returns {Promise<{ data: object | null, error: { message: string } | null }>}
 */
export async function updatePreguntaAdmin(options) {
  await delay(300)
  const id = options?.path?.id
  const body = options?.body ?? {}
  const idx = preguntasAdicionalesStore.findIndex(p => p.id === id)
  if (idx === -1) return { data: null, error: { message: 'Pregunta no encontrada' } }
  preguntasAdicionalesStore[idx] = {
    ...preguntasAdicionalesStore[idx],
    ...body,
    id,
    actualizadaEn: new Date().toISOString(),
  }
  return { data: preguntasAdicionalesStore[idx], error: null }
}

/**
 * Mock de deletePreguntaAdmin – elimina una pregunta adicional.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function deletePreguntaAdmin(options) {
  await delay(300)
  const id = options?.path?.id
  const idx = preguntasAdicionalesStore.findIndex(p => p.id === id)
  if (idx === -1) return { data: null, error: { message: 'Pregunta no encontrada' } }
  preguntasAdicionalesStore.splice(idx, 1)
  // Remove all assignments linked to this question
  const dpIdx = declaracionPreguntaStore.filter(dp => dp.preguntaId === id)
  dpIdx.forEach(dp => {
    const i = declaracionPreguntaStore.findIndex(x => x.id === dp.id)
    if (i !== -1) declaracionPreguntaStore.splice(i, 1)
  })
  return { data: { success: true }, error: null }
}

// ---------------------------------------------------------------------------
// Asignaciones declaración ↔ pregunta (many-to-many)
// ---------------------------------------------------------------------------

/**
 * Mock de getDeclaracionPreguntas – obtiene preguntas y respuestas de una declaración.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: { data: object[], total: number } | null, error: { message: string } | null }>}
 */
export async function getDeclaracionPreguntas(options) {
  await delay()
  const id = options?.path?.id
  const dec = declaracionesStore.find(d => d.id === id)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }

  const asignaciones = declaracionPreguntaStore
    .filter(dp => dp.declaracionId === id)
    .map(dp => ({
      ...dp,
      pregunta: preguntasAdicionalesStore.find(p => p.id === dp.preguntaId) ?? null,
    }))

  return { data: { data: asignaciones, total: asignaciones.length }, error: null }
}

/**
 * Mock de upsertDeclaracionPreguntas – crea o actualiza asignaciones de preguntas.
 * @param {{ path: { id: string }, body: { asignaciones: Array<{ preguntaId: string, respuesta?: string }> } }} options
 * @returns {Promise<{ data: { data: object[], total: number } | null, error: { message: string } | null }>}
 */
export async function upsertDeclaracionPreguntas(options) {
  await delay(400)
  const id = options?.path?.id
  const { asignaciones = [] } = options?.body ?? {}

  const dec = declaracionesStore.find(d => d.id === id)
  if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }

  for (const a of asignaciones) {
    const preguntaExiste = preguntasAdicionalesStore.some(p => p.id === a.preguntaId)
    if (!preguntaExiste) return { data: null, error: { message: `Pregunta ${a.preguntaId} no encontrada` } }

    const existente = declaracionPreguntaStore.find(
      dp => dp.declaracionId === id && dp.preguntaId === a.preguntaId
    )
    const ahora = new Date().toISOString()

    if (existente) {
      existente.respuesta = a.respuesta ?? existente.respuesta
      if (a.respuesta !== undefined && a.respuesta !== null) {
        existente.respondidaEn = ahora
      }
    } else {
      declaracionPreguntaStore.push({
        id: generarDpId(),
        declaracionId: id,
        preguntaId: a.preguntaId,
        respuesta: a.respuesta ?? null,
        asignadaEn: ahora,
        respondidaEn: a.respuesta !== null && a.respuesta !== undefined ? ahora : null,
      })
    }
  }

  const resultado = declaracionPreguntaStore
    .filter(dp => dp.declaracionId === id)
    .map(dp => ({
      ...dp,
      pregunta: preguntasAdicionalesStore.find(p => p.id === dp.preguntaId) ?? null,
    }))

  return { data: { data: resultado, total: resultado.length }, error: null }
}

/**
 * Mock de removeDeclaracionPregunta – desasigna una pregunta de una declaración.
 * @param {{ path: { id: string, preguntaId: string } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function removeDeclaracionPregunta(options) {
  await delay(300)
  const { id, preguntaId } = options?.path ?? {}
  const idx = declaracionPreguntaStore.findIndex(
    dp => dp.declaracionId === id && dp.preguntaId === preguntaId
  )
  if (idx === -1) return { data: null, error: { message: 'Asignación no encontrada' } }
  declaracionPreguntaStore.splice(idx, 1)
  return { data: { success: true }, error: null }
}

// ---------------------------------------------------------------------------
// Secciones – CRUD admin
// ---------------------------------------------------------------------------

/**
 * Mock de listSeccionesAdmin – devuelve todas las secciones.
 * @param {{ query?: { activa?: boolean, page?: number, limit?: number } }} options
 * @returns {Promise<{ data: { data: object[], total: number, page: number, limit: number }, error: null }>}
 */
export async function listSeccionesAdmin(options) {
  await delay()
  let resultado = [...seccionesStore]
  const { activa, page = 1, limit = 10 } = options?.query ?? {}
  if (activa !== undefined) {
    resultado = resultado.filter(s => s.activa === activa)
  }
  resultado.sort((a, b) => a.orden - b.orden)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

/** Comprueba si ya existe una sección con el mismo nombre (case-insensitive), excluyendo opcionalmente un índice. */
function findDuplicateSeccion(nombre, excludeIdx = -1) {
  return seccionesStore.find(
    (s, i) => i !== excludeIdx && s.nombre.toLowerCase() === nombre.trim().toLowerCase()
  )
}

/**
 * Mock de createSeccionAdmin – crea una nueva sección.
 * @param {{ body: { nombre: string, orden?: number, activa?: boolean } }} options
 * @returns {Promise<{ data: object | null, error: { message: string } | null, response: { status: number } }>}
 */
export async function createSeccionAdmin(options) {
  await delay(300)
  const body = options?.body ?? {}
  if (!body.nombre || !body.nombre.trim()) {
    return { data: null, error: { message: 'El nombre es obligatorio' }, response: { status: 400 } }
  }
  if (findDuplicateSeccion(body.nombre)) {
    return { data: null, error: { message: 'Ya existe una sección con ese nombre' }, response: { status: 409 } }
  }
  const ahora = new Date().toISOString()
  const nueva = {
    id: generarSeccionId(),
    nombre: body.nombre.trim(),
    orden: body.orden ?? seccionesStore.length + 1,
    activa: body.activa !== undefined ? body.activa : true,
    creadaEn: ahora,
    actualizadaEn: ahora,
  }
  seccionesStore.push(nueva)
  return { data: nueva, error: null, response: { status: 201 } }
}

/**
 * Mock de updateSeccionAdmin – actualiza una sección.
 * @param {{ path: { id: string }, body: object }} options
 * @returns {Promise<{ data: object | null, error: { message: string } | null }>}
 */
export async function updateSeccionAdmin(options) {
  await delay(300)
  const id = options?.path?.id
  const body = options?.body ?? {}
  const idx = seccionesStore.findIndex(s => s.id === id)
  if (idx === -1) return { data: null, error: { message: 'Sección no encontrada' } }
  if (body.nombre !== undefined && findDuplicateSeccion(body.nombre, idx)) {
    return { data: null, error: { message: 'Ya existe una sección con ese nombre' } }
  }
  seccionesStore[idx] = {
    ...seccionesStore[idx],
    ...body,
    ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
    id,
    actualizadaEn: new Date().toISOString(),
  }
  return { data: seccionesStore[idx], error: null }
}

/**
 * Mock de deleteSeccionAdmin – elimina una sección.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function deleteSeccionAdmin(options) {
  await delay(300)
  const id = options?.path?.id
  const idx = seccionesStore.findIndex(s => s.id === id)
  if (idx === -1) return { data: null, error: { message: 'Sección no encontrada' } }
  const seccionNombre = seccionesStore[idx].nombre
  const enUso = preguntasAdicionalesStore.some(p => p.seccion === seccionNombre)
  if (enUso) {
    return { data: null, error: { message: 'No se puede eliminar: hay preguntas asignadas a esta sección' } }
  }
  seccionesStore.splice(idx, 1)
  return { data: { success: true }, error: null }
}

/**
 * Mock de getSeccionDeclaraciones – devuelve las declaraciones que tienen preguntas de una sección.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: { data: object[], total: number } | null, error: { message: string } | null }>}
 */
export async function getSeccionDeclaraciones(options) {
  await delay()
  const id = options?.path?.id
  const seccion = seccionesStore.find(s => s.id === id)
  if (!seccion) return { data: null, error: { message: 'Sección no encontrada' } }

  const preguntasEnSeccion = preguntasAdicionalesStore.filter(p => p.seccion === seccion.nombre)
  const preguntaIds = new Set(preguntasEnSeccion.map(p => p.id))

  const declaracionIds = [...new Set(
    declaracionPreguntaStore
      .filter(dp => preguntaIds.has(dp.preguntaId))
      .map(dp => dp.declaracionId)
  )]

  const declaraciones = declaracionIds.map(decId => {
    const dec = declaracionesStore.find(d => d.id === decId)
    return dec
      ? { id: dec.id, dniNie: dec.dniNie, nombre: `${dec.nombre} ${dec.apellidos}` }
      : { id: decId, dniNie: '—', nombre: '—' }
  })

  return { data: { data: declaraciones, total: declaraciones.length }, error: null }
}

/**
 * Mock de getSeccionPreguntas – devuelve las preguntas adicionales asignadas a una sección.
 * @param {{ path: { id: string } }} options
 * @returns {Promise<{ data: { data: object[], total: number } | null, error: { message: string } | null }>}
 */
export async function getSeccionPreguntas(options) {
  await delay()
  const id = options?.path?.id
  const seccion = seccionesStore.find(s => s.id === id)
  if (!seccion) return { data: null, error: { message: 'Sección no encontrada' } }

  const preguntas = preguntasAdicionalesStore.filter(p => p.seccion === seccion.nombre)
  return { data: { data: preguntas, total: preguntas.length }, error: null }
}

// ---------------------------------------------------------------------------
// Gestión de usuarios – CRUD admin
// ---------------------------------------------------------------------------

/**
 * Mock de listUsersAdmin – devuelve todos los usuarios registrados con su estado.
 * @param {{ query?: { bloqueado?: boolean, denunciado?: boolean, page?: number, limit?: number } }} options
 * @returns {Promise<{ data: { data: object[], total: number, page: number, limit: number }, error: null }>}
 */
export async function listUsersAdmin(options) {
  await delay()
  const { bloqueado, denunciado, page = 1, limit = 10 } = options?.query ?? {}
  let resultado = usersStore.map(u => ({
    ...u,
    bloqueado: blockedStore.get(u.dniNie) ?? false,
    denunciado: reportedStore.get(u.dniNie) ?? false,
    preguntasAsignadas: userPreguntasStore.get(u.dniNie) ?? [],
    seccionesAsignadas: userSeccionesStore.get(u.dniNie) ?? [],
  }))
  if (bloqueado !== undefined) resultado = resultado.filter(u => u.bloqueado === bloqueado)
  if (denunciado !== undefined) resultado = resultado.filter(u => u.denunciado === denunciado)
  const total = resultado.length
  const start = (page - 1) * limit
  const data = resultado.slice(start, start + limit)
  return { data: { data, total, page, limit }, error: null }
}

/**
 * Mock de blockUser – bloquea o desbloquea un usuario.
 * @param {{ path: { dniNie: string }, body: { bloqueado: boolean } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function blockUser(options) {
  await delay()
  const { dniNie } = options?.path ?? {}
  const { bloqueado } = options?.body ?? {}
  if (!usersStore.find(u => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  blockedStore.set(dniNie, !!bloqueado)
  return { data: { success: true }, error: null }
}

/**
 * Mock de reportUser – denuncia o anula la denuncia de un usuario.
 * @param {{ path: { dniNie: string }, body: { denunciado: boolean } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function reportUser(options) {
  await delay()
  const { dniNie } = options?.path ?? {}
  const { denunciado } = options?.body ?? {}
  if (!usersStore.find(u => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  reportedStore.set(dniNie, !!denunciado)
  return { data: { success: true }, error: null }
}

/**
 * Mock de deleteUser – elimina un usuario y sus declaraciones del sistema.
 * @param {{ path: { dniNie: string } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function deleteUser(options) {
  await delay(400)
  const { dniNie } = options?.path ?? {}
  const idx = usersStore.findIndex(u => u.dniNie === dniNie)
  if (idx === -1) return { data: null, error: { message: 'Usuario no encontrado' } }
  usersStore.splice(idx, 1)
  blockedStore.delete(dniNie)
  reportedStore.delete(dniNie)
  userPreguntasStore.delete(dniNie)
  userSeccionesStore.delete(dniNie)
  passwordsStore.delete(dniNie)
  rolesStore.delete(dniNie)
  // Remove all declarations belonging to this user
  const decIds = declaracionesStore.filter(d => d.dniNie === dniNie).map(d => d.id)
  decIds.forEach(decId => {
    const i = declaracionesStore.findIndex(d => d.id === decId)
    if (i !== -1) declaracionesStore.splice(i, 1)
    // Remove question assignments
    for (let j = declaracionPreguntaStore.length - 1; j >= 0; j--) {
      if (declaracionPreguntaStore[j].declaracionId === decId) declaracionPreguntaStore.splice(j, 1)
    }
  })
  return { data: { success: true }, error: null }
}

/**
 * Mock de sendEmailToUser – simula el envío de un email a un usuario.
 * @param {{ dniNie: string, email: string, mensaje?: string }} options
 * @returns {Promise<{ data: { success: boolean, to: string } | null, error: null }>}
 */
export async function sendEmailToUser({ dniNie, email, mensaje }) {
  await delay(600)
  console.info(`[MOCK EMAIL → USUARIO] → ${email} (${dniNie}): ${mensaje ?? 'Notificación enviada.'}`)
  return { data: { success: true, to: email }, error: null }
}

/**
 * Mock de setUserPreguntas – sobreescribe la lista de preguntas asignadas a un usuario.
 * @param {{ path: { dniNie: string }, body: { preguntaIds: string[] } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function setUserPreguntas(options) {
  await delay(300)
  const { dniNie } = options?.path ?? {}
  const { preguntaIds = [] } = options?.body ?? {}
  if (!usersStore.find(u => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  for (const id of preguntaIds) {
    if (!preguntasAdicionalesStore.find(p => p.id === id)) {
      return { data: null, error: { message: `Pregunta ${id} no encontrada` } }
    }
  }
  userPreguntasStore.set(dniNie, [...preguntaIds])
  return { data: { success: true }, error: null }
}

/**
 * Mock de setUserSecciones – sobreescribe la lista de secciones asignadas a un usuario.
 * @param {{ path: { dniNie: string }, body: { seccionIds: string[] } }} options
 * @returns {Promise<{ data: { success: boolean } | null, error: { message: string } | null }>}
 */
export async function setUserSecciones(options) {
  await delay(300)
  const { dniNie } = options?.path ?? {}
  const { seccionIds = [] } = options?.body ?? {}
  if (!usersStore.find(u => u.dniNie === dniNie)) {
    return { data: null, error: { message: 'Usuario no encontrado' } }
  }
  for (const id of seccionIds) {
    if (!seccionesStore.find(s => s.id === id)) {
      return { data: null, error: { message: `Sección ${id} no encontrada` } }
    }
  }
  userSeccionesStore.set(dniNie, [...seccionIds])
  return { data: { success: true }, error: null }
}
