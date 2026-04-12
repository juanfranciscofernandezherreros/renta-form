// ---------------------------------------------------------------------------
// MOCK API – implementaciones en memoria para el modo demo
// Reemplaza las llamadas reales a la API cuando DEMO_MODE está activado.
// ---------------------------------------------------------------------------
import { CATALOGO_PREGUNTAS, declaracionesStore, passwordsStore, rolesStore, generarId } from './demoData.js'

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
