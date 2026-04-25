'use strict'

// ---------------------------------------------------------------------------
//  Test backend server – uses an in-memory mock service so no database is
//  needed.  Start with:  TEST_PORT=3099 node test-server.js
//
//  Special endpoints:
//    POST /test/reset  – wipe in-memory state and reload seed data
// ---------------------------------------------------------------------------

const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const PORT = parseInt(process.env.TEST_PORT || '3099', 10)

// ── Pre-compute bcrypt hashes at startup (low rounds = fast for tests) ──────

// Intentionally low bcrypt rounds – this is a test-only server and security
// strength is not required here.  NEVER use rounds < 10 in production.
const ROUNDS = 1
const HASH_user = bcrypt.hashSync('password123', ROUNDS)
const HASH_admin = bcrypt.hashSync('admin123', ROUNDS)
const HASH_blocked = bcrypt.hashSync('pass123', ROUNDS)

// ── In-memory state ──────────────────────────────────────────────────────────

let declaraciones
let usuarios
let preguntas
let idiomas
let traducciones  // idiomaId -> Map<clave, valor>
let idiomaSeq
let preguntaSeq

function resetState() {
  idiomaSeq = 10
  preguntaSeq = 100

  declaraciones = new Map()

  usuarios = new Map([
    ['TEST1234A', {
      dniNie: 'TEST1234A', passwordHash: HASH_user,
      nombre: 'Test', apellidos: 'Usuario', email: 'test@example.com',
      telefono: '600000000', role: 'user', bloqueado: false, denunciado: false,
      preguntasAsignadas: [], creadoEn: new Date().toISOString(),
    }],
    ['ADMIN001A', {
      dniNie: 'ADMIN001A', passwordHash: HASH_admin,
      nombre: 'Admin', apellidos: 'Sistema', email: 'admin@example.com',
      telefono: '', role: 'admin', bloqueado: false, denunciado: false,
      preguntasAsignadas: [], creadoEn: new Date().toISOString(),
    }],
    ['BLOQUEADO1', {
      dniNie: 'BLOQUEADO1', passwordHash: HASH_blocked,
      nombre: 'Bloqueado', apellidos: 'Usuario', email: 'bloqueado@example.com',
      telefono: '', role: 'user', bloqueado: true, denunciado: false,
      preguntasAsignadas: [], creadoEn: new Date().toISOString(),
    }],
  ])

  preguntas = [
    { id: '1', campo: 'viviendaAlquiler', texto: '¿Vive de alquiler?', tipo: 'sino', actualizadaEn: null },
    { id: '2', campo: 'alquilerMenos35', texto: '¿El inquilino tiene menos de 35 años?', tipo: 'sino', actualizadaEn: null },
    { id: '3', campo: 'viviendaPropiedad', texto: '¿Tiene vivienda en propiedad?', tipo: 'sino', actualizadaEn: null },
  ]

  idiomas = [
    { id: 'id-es', code: 'es', label: 'Español', activo: true, creadoEn: null, actualizadoEn: null },
    { id: 'id-en', code: 'en', label: 'English', activo: true, creadoEn: null, actualizadoEn: null },
  ]

  traducciones = new Map([
    ['id-es', new Map([['btnContinue', 'Continuar'], ['btnSubmit', 'Enviar declaración']])],
    ['id-en', new Map([['btnContinue', 'Continue'], ['btnSubmit', 'Send declaration']])],
  ])
}

// ── Validation (mirrors dbService.js validateDeclaracionBody) ─────────────────

const REQUIRED_TEXT_FIELDS = ['nombre', 'apellidos', 'dniNie', 'email', 'telefono']
const REQUIRED_YN_FIELDS = [
  'viviendaAlquiler', 'viviendaPropiedad', 'pisosAlquiladosTerceros', 'segundaResidencia',
  'familiaNumerosa', 'ayudasGobierno', 'mayores65ACargo', 'hijosMenores26',
  'ingresosJuego', 'ingresosInversiones',
]
const OPTIONAL_YN_FIELDS = ['alquilerMenos35', 'propiedadAntes2013', 'mayoresConviven']

function validateDeclaracion(body, { requireAll = false } = {}) {
  if (requireAll) {
    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!body[field]) return `Campo obligatorio: ${field}`
    }
    for (const field of REQUIRED_YN_FIELDS) {
      if (body[field] !== 'si' && body[field] !== 'no') {
        return `El campo '${field}' debe ser 'si' o 'no'`
      }
    }
  }
  for (const field of OPTIONAL_YN_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '' && body[field] !== 'si' && body[field] !== 'no') {
      return `El campo '${field}' debe ser 'si', 'no' o estar vacío`
    }
  }
  if (!requireAll) {
    for (const field of REQUIRED_YN_FIELDS) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== '' && body[field] !== 'si' && body[field] !== 'no') {
        return `El campo '${field}' debe ser 'si' o 'no'`
      }
    }
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function userToResponse(u) {
  return {
    dniNie: u.dniNie, nombre: u.nombre, apellidos: u.apellidos,
    email: u.email, telefono: u.telefono || '', role: u.role,
    bloqueado: u.bloqueado, denunciado: u.denunciado,
    preguntasAsignadas: u.preguntasAsignadas || [], creadoEn: u.creadoEn,
  }
}

function makeDeclaracion(body) {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    estado: 'pendiente',
    creadoEn: now,
    actualizadoEn: now,
    nombre: body.nombre || '',
    apellidos: body.apellidos || '',
    dniNie: body.dniNie || '',
    email: body.email || '',
    telefono: body.telefono || '',
    viviendaAlquiler: body.viviendaAlquiler ?? false,
    alquilerMenos35: body.alquilerMenos35,
    viviendaPropiedad: body.viviendaPropiedad ?? false,
    propiedadAntes2013: body.propiedadAntes2013,
    pisosAlquiladosTerceros: body.pisosAlquiladosTerceros ?? false,
    segundaResidencia: body.segundaResidencia ?? false,
    familiaNumerosa: body.familiaNumerosa ?? false,
    ayudasGobierno: body.ayudasGobierno ?? false,
    mayores65ACargo: body.mayores65ACargo ?? false,
    mayoresConviven: body.mayoresConviven,
    hijosMenores26: body.hijosMenores26 ?? false,
    ingresosJuego: body.ingresosJuego ?? false,
    ingresosInversiones: body.ingresosInversiones ?? false,
  }
}

// ── Mock service (same interface as dbService.js) ────────────────────────────

const svc = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async loginUser({ dniNie, password }) {
    const u = usuarios.get(dniNie)
    if (!u) return { data: null, error: { message: 'DNI/NIE no encontrado' } }
    if (u.bloqueado) return { data: null, error: { message: 'USER_BLOCKED' } }
    const ok = await bcrypt.compare(password, u.passwordHash)
    if (!ok) return { data: null, error: { message: 'Contraseña incorrecta' } }
    return { data: { dniNie, role: u.role }, error: null }
  },

  async changePassword({ dniNie, oldPassword, newPassword }) {
    const u = usuarios.get(dniNie)
    if (!u) return { data: null, error: { message: 'Usuario no encontrado' } }
    const ok = await bcrypt.compare(oldPassword, u.passwordHash)
    if (!ok) return { data: null, error: { message: 'La contraseña actual es incorrecta' } }
    u.passwordHash = await bcrypt.hash(newPassword, ROUNDS)
    return { data: { success: true }, error: null }
  },

  // ── IRPF preguntas ────────────────────────────────────────────────────────
  async getPreguntas() {
    const ps = preguntas.map(p => ({ id: p.campo, texto: p.texto, textos: { es: p.texto } }))
    return { data: { secciones: [{ id: 'general', numero: 1, titulo: '', titulos: {}, preguntas: ps }] }, error: null }
  },

  // ── Declaraciones ─────────────────────────────────────────────────────────
  async listDeclaraciones({ dniNie, estado, page = 1, limit = 10 }) {
    let list = [...declaraciones.values()]
    if (dniNie) list = list.filter(d => d.dniNie === dniNie)
    if (estado) list = list.filter(d => d.estado === estado)
    const total = list.length
    const offset = (page - 1) * limit
    return { data: { data: list.slice(offset, offset + limit), total, page, limit }, error: null }
  },

  async listDeclaracionesAll({ dniNie, estado, page = 1, limit = 20 }) {
    let list = [...declaraciones.values()]
    if (dniNie) list = list.filter(d => d.dniNie.toLowerCase().includes(dniNie.toLowerCase()))
    if (estado) list = list.filter(d => d.estado === estado)
    const total = list.length
    const offset = (page - 1) * limit
    return { data: { data: list.slice(offset, offset + limit), total, page, limit }, error: null }
  },

  async createDeclaracion(body) {
    const validationError = validateDeclaracion(body, { requireAll: true })
    if (validationError) return { data: null, error: { message: validationError }, status: 400 }
    for (const d of declaraciones.values()) {
      if (d.dniNie && body.dniNie && d.dniNie === body.dniNie) {
        return { data: null, error: { message: 'Ya existe una declaración con este DNI/NIE' }, status: 409 }
      }
    }
    const dec = makeDeclaracion(body)
    declaraciones.set(dec.id, dec)
    return { data: { id: dec.id, estado: dec.estado, creadoEn: dec.creadoEn }, error: null, status: 201 }
  },

  async getDeclaracion(id) {
    const dec = declaraciones.get(id)
    if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
    return { data: dec, error: null }
  },

  async getDeclaracionByToken(token) {
    if (!token) return { data: null, error: { message: 'Token requerido' } }
    const dec = declaraciones.get(token.trim())
    if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
    return { data: dec, error: null }
  },

  async updateEstadoDeclaracion(id, estado) {
    const dec = declaraciones.get(id)
    if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
    dec.estado = estado
    return { data: { ...dec }, error: null }
  },

  async updateDeclaracion(id, body) {
    const dec = declaraciones.get(id)
    if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
    const ALLOWED = [
      'nombre', 'apellidos', 'email', 'telefono',
      'viviendaAlquiler', 'alquilerMenos35', 'viviendaPropiedad', 'propiedadAntes2013',
      'pisosAlquiladosTerceros', 'segundaResidencia', 'familiaNumerosa', 'ayudasGobierno',
      'mayores65ACargo', 'mayoresConviven', 'hijosMenores26', 'ingresosJuego', 'ingresosInversiones',
    ]
    for (const key of ALLOWED) {
      if (body[key] !== undefined) dec[key] = body[key]
    }
    return { data: { ...dec }, error: null }
  },

  async deleteDeclaracion(id) {
    if (!declaraciones.has(id)) return { data: null, error: { message: 'Declaración no encontrada' } }
    declaraciones.delete(id)
    return { data: { success: true }, error: null }
  },

  async sendEmailDeclaracion({ declaracionId, email, mensaje }) {
    return { data: { success: true, to: email }, error: null }
  },

  // ── Admin: preguntas-formulario ───────────────────────────────────────────
  async listPreguntasFormulario({ page = 1, limit = 10 } = {}) {
    const total = preguntas.length
    const offset = (page - 1) * limit
    return { data: { data: preguntas.slice(offset, offset + limit), total, page, limit }, error: null }
  },

  async createPreguntaFormulario({ texto }) {
    if (!texto || !String(texto).trim()) return { data: null, error: { message: 'El texto es obligatorio' } }
    const id = String(++preguntaSeq)
    const p = { id, campo: id, texto: String(texto).trim(), tipo: 'sino', actualizadaEn: new Date().toISOString() }
    preguntas.push(p)
    return { data: p, error: null, status: 201 }
  },

  async updatePreguntaFormulario(id, { texto }) {
    if (texto === undefined) return { data: null, error: { message: 'No hay cambios que guardar' } }
    if (!String(texto).trim()) return { data: null, error: { message: 'El texto no puede estar vacío' } }
    const p = preguntas.find(p => p.id === String(id))
    if (!p) return { data: null, error: { message: 'Pregunta no encontrada' } }
    p.texto = String(texto).trim()
    p.actualizadaEn = new Date().toISOString()
    return { data: p, error: null }
  },

  async deletePreguntaFormulario(id) {
    const idx = preguntas.findIndex(p => p.id === String(id))
    if (idx === -1) return { data: null, error: { message: 'Pregunta no encontrada' } }
    preguntas.splice(idx, 1)
    return { data: { deleted: true }, error: null }
  },

  // ── Admin: usuarios ───────────────────────────────────────────────────────
  async listUsersAdmin({ bloqueado, denunciado, search, page = 1, limit = 10 }) {
    let list = [...usuarios.values()].map(userToResponse)
    if (bloqueado !== undefined) list = list.filter(u => u.bloqueado === bloqueado)
    if (denunciado !== undefined) list = list.filter(u => u.denunciado === denunciado)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(u =>
        u.nombre.toLowerCase().includes(s) ||
        u.apellidos.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.dniNie.toLowerCase().includes(s)
      )
    }
    const total = list.length
    const offset = (page - 1) * limit
    return { data: { data: list.slice(offset, offset + limit), total, page, limit }, error: null }
  },

  async assignUserAccount({ dniNie, password, declaracionId }) {
    if (!dniNie || !password) return { data: null, error: { message: 'DNI/NIE y contraseña son obligatorios' } }
    const dec = declaraciones.get(declaracionId)
    if (!dec) return { data: null, error: { message: 'Declaración no encontrada' } }
    const isNew = !usuarios.has(dniNie)
    const hashed = await bcrypt.hash(password, ROUNDS)
    if (isNew) {
      usuarios.set(dniNie, {
        dniNie, passwordHash: hashed,
        nombre: dec.nombre, apellidos: dec.apellidos, email: dec.email,
        telefono: dec.telefono || '', role: 'user', bloqueado: false, denunciado: false,
        preguntasAsignadas: [], creadoEn: new Date().toISOString(),
      })
    } else {
      usuarios.get(dniNie).passwordHash = hashed
    }
    return { data: { created: isNew, dniNie }, error: null }
  },

  async getUserByDniNie(dniNie) {
    const u = usuarios.get(dniNie)
    return { data: u ? userToResponse(u) : null, error: null }
  },

  async blockUser(dniNie, bloqueado) {
    const u = usuarios.get(dniNie)
    if (!u) return { data: null, error: { message: 'Usuario no encontrado' } }
    u.bloqueado = !!bloqueado
    return { data: { success: true }, error: null }
  },

  async reportUser(dniNie, denunciado) {
    const u = usuarios.get(dniNie)
    if (!u) return { data: null, error: { message: 'Usuario no encontrado' } }
    u.denunciado = !!denunciado
    return { data: { success: true }, error: null }
  },

  async deleteUser(dniNie) {
    if (!usuarios.has(dniNie)) return { data: null, error: { message: 'Usuario no encontrado' } }
    for (const [id, d] of declaraciones.entries()) {
      if (d.dniNie === dniNie) declaraciones.delete(id)
    }
    usuarios.delete(dniNie)
    return { data: { success: true }, error: null }
  },

  async sendEmailToUser({ dniNie, email, mensaje }) {
    return { data: { success: true, to: email }, error: null }
  },

  // ── Public: idiomas & traducciones ────────────────────────────────────────
  async getIdiomas() {
    return { data: idiomas.filter(i => i.activo).map(i => ({ code: i.code, label: i.label })), error: null }
  },

  async getTraducciones() {
    const result = {}
    for (const i of idiomas.filter(i => i.activo)) {
      const t = traducciones.get(i.id)
      if (t) result[i.code] = Object.fromEntries(t.entries())
    }
    return { data: result, error: null }
  },

  // ── Admin: idiomas CRUD ───────────────────────────────────────────────────
  async listIdiomasAdmin({ activo, page = 1, limit = 20 } = {}) {
    let list = [...idiomas]
    if (activo !== undefined) list = list.filter(i => i.activo === activo)
    const total = list.length
    const offset = (page - 1) * limit
    return { data: { data: list.slice(offset, offset + limit), total, page, limit }, error: null }
  },

  async createIdiomaAdmin({ code, label, activo }) {
    if (!code || !String(code).trim()) return { data: null, error: { message: 'El código es obligatorio' } }
    if (!label || !String(label).trim()) return { data: null, error: { message: 'La etiqueta es obligatoria' } }
    const normalised = code.trim().toLowerCase()
    if (idiomas.some(i => i.code === normalised)) {
      return { data: null, error: { message: 'Ya existe un idioma con ese código' }, status: 409 }
    }
    const id = `id-${++idiomaSeq}`
    const idioma = { id, code: normalised, label: label.trim(), activo: activo ?? true, creadoEn: new Date().toISOString(), actualizadoEn: null }
    idiomas.push(idioma)
    return { data: idioma, error: null, status: 201 }
  },

  async updateIdiomaAdmin(id, { label, activo }) {
    const idioma = idiomas.find(i => i.id === id)
    if (!idioma) return { data: null, error: { message: 'Idioma no encontrado' } }
    const changes = []
    if (label !== undefined) { idioma.label = label.trim(); changes.push('label') }
    if (activo !== undefined) { idioma.activo = activo; changes.push('activo') }
    if (!changes.length) return { data: null, error: { message: 'No hay cambios que guardar' } }
    return { data: idioma, error: null }
  },

  async deleteIdiomaAdmin(id) {
    const idx = idiomas.findIndex(i => i.id === id)
    if (idx === -1) return { data: null, error: { message: 'Idioma no encontrado' }, status: 404 }
    if (idiomas[idx].code === 'es') return { data: null, error: { message: 'No se puede eliminar el idioma por defecto' }, status: 400 }
    idiomas.splice(idx, 1)
    traducciones.delete(id)
    return { data: null, error: null, status: 204 }
  },

  async getIdiomaContent(id) {
    const idioma = idiomas.find(i => i.id === id)
    if (!idioma) return { data: null, error: { message: 'Idioma no encontrado' }, status: 404 }
    const t = traducciones.get(id) || new Map()
    return { data: { code: idioma.code, content: Object.fromEntries(t.entries()) }, error: null }
  },

  async updateIdiomaContent(id, { content }) {
    if (!content || typeof content !== 'object') return { data: null, error: { message: 'El contenido es obligatorio' } }
    const idioma = idiomas.find(i => i.id === id)
    if (!idioma) return { data: null, error: { message: 'Idioma no encontrado' }, status: 404 }
    traducciones.set(id, new Map(Object.entries(content)))
    return { data: { code: idioma.code, content }, error: null }
  },
}

// ── Express app ──────────────────────────────────────────────────────────────

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Test reset – wipes all state and reloads seed data
app.post('/test/reset', (_req, res) => {
  resetState()
  res.json({ reset: true })
})

// Test helper – empties the preguntas list to simulate no questions configured
app.post('/test/empty-preguntas', (_req, res) => {
  preguntas = []
  res.json({ cleared: true })
})

// Load actual route factories so we test the real routing logic
const authRoutes = require('./routes/auth')
const irpfRoutes = require('./routes/irpf')
const adminRoutes = require('./routes/admin')

app.use('/v1/auth', authRoutes(svc))
app.use('/v1/irpf', irpfRoutes(svc))
app.use('/v1/admin', adminRoutes(svc))

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Start ─────────────────────────────────────────────────────────────────────

resetState()
app.listen(PORT, () => {
  process.stdout.write(`TEST_SERVER_READY http://localhost:${PORT}\n`)
})
