// ---------------------------------------------------------------------------
// MOCK API – implementaciones en memoria para el modo demo
// Reemplaza las llamadas reales a la API cuando DEMO_MODE está activado.
// ---------------------------------------------------------------------------
import { CATALOGO_PREGUNTAS, declaracionesStore, passwordsStore, generarId } from './demoData.js'

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
 * @returns {Promise<{ data: { dniNie: string } | null, error: { message: string } | null }>}
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
  return { data: { dniNie }, error: null }
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
