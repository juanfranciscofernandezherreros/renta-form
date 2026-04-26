'use strict'

// ---------------------------------------------------------------------------
//  DB service – all business logic backed by PostgreSQL.
//  Column names in the DB use snake_case; they are mapped to camelCase
//  before returning to the API consumer.
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('../db/pool')

const BCRYPT_ROUNDS = 12

// ── Translation keys ───────────────────────────────────────────────────────
// Canonical set of i18n keys used by the frontend.  Extracted from all t('key')
// calls in the src/ directory.  Used by getMissingTranslations so the endpoint
// can report gaps for every language without needing a base/reference language.
const ALL_REQUIRED_KEYS = [
  'btnAdmin',
  'btnBack',
  'btnClear',
  'btnConsultando',
  'btnConsultar',
  'btnContinue',
  'btnDismissError',
  'btnDownloadPDF',
  'btnLoggingIn',
  'btnLogin',
  'btnSendAnother',
  'btnSubmit',
  'btnSubmitting',
  'btnUpdatePassword',
  'btnUpdatingPassword',
  'campaignName',
  'changePasswordTitle',
  'confirmClear',
  'errDniDuplicate',
  'errDniFormat',
  'errNewPasswordLength',
  'errNewPasswordLengthSuffix',
  'errOldPasswordRequired',
  'errPasswordRequired',
  'errPasswordsNoMatch',
  'errTokenRequired',
  'errUserBlocked',
  'errValidationQuestions',
  'errValidationRequired',
  'errorQuestions',
  'estadoArchivado',
  'estadoCompletado',
  'estadoDocumentacionPendiente',
  'estadoEnRevision',
  'estadoRecibido',
  'fieldApellidos',
  'fieldApellidosPlaceholder',
  'fieldConfirmPassword',
  'fieldDniNie',
  'fieldEmail',
  'fieldEmailOptional',
  'fieldEmailPlaceholder',
  'fieldNewPassword',
  'fieldNombre',
  'fieldOldPassword',
  'fieldPassword',
  'fieldPasswordPlaceholder',
  'fieldTelefono',
  'fieldTelefonoPlaceholder',
  'instructionsText',
  'instructionsText2',
  'instructionsTitle',
  'labelTelefono',
  'langLabel',
  'loadingQuestions',
  'noQuestions',
  'loginInfoText',
  'loginInfoTitle',
  'loginSectionId',
  'loginTestPassword',
  'loginTestUsers',
  'logoText',
  'navLogin',
  'navLogout',
  'navNewForm',
  'no',
  'profileDeclaraciones',
  'profileEdit',
  'profileEditLocked',
  'profileEmpty',
  'profileEmptyLink',
  'profileEmptyText',
  'profileLoadError',
  'profileLoading',
  'profileSent',
  'profileUpdated',
  'pwSuccess',
  'rentaPdfBtn',
  'rentaPdfBtnTitle',
  'section1',
  'section5',
  'step1Subtitle',
  'successText',
  'successTitle',
  'toastErrorHttp',
  'toastErrorHttpSuffix',
  'toastErrorNetwork',
  'toastSuccess',
  'tokenClearHistory',
  'tokenConsultaDesc',
  'tokenConsultaTitle',
  'tokenLabel',
  'tokenMyTokens',
  'tokenNoHistory',
  'tokenNotFound',
  'tokenPlaceholder',
  'tokenResultDni',
  'tokenResultEmail',
  'tokenResultNombre',
  'tokenResultTitle',
  'yes',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

function verifyPassword(input, stored) {
  return bcrypt.compare(input, stored)
}

/** Maps a DB row (snake_case) to the camelCase shape the frontend expects. */
function rowToDeclaracion(row) {
  if (!row) return null
  return {
    id: row.id,
    estado: row.estado,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    nombre: row.nombre,
    apellidos: row.apellidos,
    dniNie: row.dni_nie,
    email: row.email,
    telefono: row.telefono,
    viviendaAlquiler: row.vivienda_alquiler,
    alquilerMenos35: row.alquiler_menos_35 ?? undefined,
    viviendaPropiedad: row.vivienda_propiedad,
    propiedadAntes2013: row.propiedad_antes_2013 ?? undefined,
    pisosAlquiladosTerceros: row.pisos_alquilados_terceros,
    segundaResidencia: row.segunda_residencia,
    familiaNumerosa: row.familia_numerosa,
    ayudasGobierno: row.ayudas_gobierno,
    mayores65ACargo: row.mayores_65_a_cargo,
    mayoresConviven: row.mayores_conviven ?? undefined,
    hijosMenores26: row.hijos_menores_26,
    hijosConviven: row.hijos_conviven ?? undefined,
    ingresosJuego: row.ingresos_juego,
    ingresosInversiones: row.ingresos_inversiones,
  }
}

function rowToUser(row) {
  if (!row) return null
  return {
    dniNie: row.dni_nie,
    nombre: row.nombre,
    apellidos: row.apellidos,
    email: row.email,
    telefono: row.telefono ?? '',
    role: row.role,
    bloqueado: row.bloqueado ?? false,
    denunciado: row.denunciado ?? false,
    preguntasAsignadas: row.preguntas_asignadas ?? [],
    creadoEn: row.creado_en,
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────

async function loginAdmin({ username, password }) {
  try {
    const normalised = (username ?? '').trim().toUpperCase()
    const { rows } = await pool.query(
      'SELECT password_hash, role, bloqueado FROM usuarios WHERE UPPER(dni_nie) = $1',
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    const user = rows[0]
    if (user.role !== 'admin') return { data: null, error: { message: 'No tienes permisos de administrador' } }
    if (user.bloqueado) return { data: null, error: { message: 'USER_BLOCKED' } }
    if (!(await verifyPassword(password, user.password_hash))) {
      return { data: null, error: { message: 'Contraseña incorrecta' } }
    }
    return { data: { username: normalised, role: user.role }, error: null }
  } catch (err) {
    console.error('loginAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function loginUser({ dniNie, password }) {
  try {
    const normalised = (dniNie ?? '').trim().toUpperCase()
    const { rows } = await pool.query(
      'SELECT password_hash, role, bloqueado FROM usuarios WHERE UPPER(dni_nie) = $1',
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'DNI/NIE no encontrado' } }
    const user = rows[0]
    if (user.bloqueado) return { data: null, error: { message: 'USER_BLOCKED' } }
    if (!(await verifyPassword(password, user.password_hash))) {
      return { data: null, error: { message: 'Contraseña incorrecta' } }
    }
    return { data: { dniNie: normalised, role: user.role }, error: null }
  } catch (err) {
    console.error('loginUser DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function changePassword({ dniNie, oldPassword, newPassword }) {
  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE dni_nie = $1',
      [dniNie]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    if (!(await verifyPassword(oldPassword, rows[0].password_hash))) {
      return { data: null, error: { message: 'La contraseña actual es incorrecta' } }
    }
    const hashed = await hashPassword(newPassword)
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE dni_nie = $2', [hashed, dniNie])
    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('changePassword DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── IRPF preguntas (loaded from DB) ──────────────────────────────────────

// Static catalogue used as the canonical ordering of preguntas.  Each entry
// has a stable UUID `id` (primary key in the DB) and a `campo` identifier
// (camelCase, matching the column name in declaraciones).  The `campo`
// column was dropped from the DB; the id↔campo mapping lives only here and
// is used to translate the DB row id into the public id returned by the API.
const PREGUNTAS_CATALOGO = require('../data/preguntas')
const ID_ORDER = new Map(PREGUNTAS_CATALOGO.map((p, idx) => [p.id, idx]))
const ID_TO_CAMPO = new Map(PREGUNTAS_CATALOGO.map(p => [p.id, p.campo]))

async function getPreguntas(lang) {
  try {
    // Return ALL preguntas from the DB (canonical + ones created via the
    // admin CRUD). Canonical preguntas keep their static order; any newly
    // created preguntas are appended at the end, ordered by `actualizada_en`
    // (creation order) so they are stable.
    const { rows } = await pool.query(
      `SELECT id, texto, actualizada_en
       FROM preguntas`
    )
    rows.sort((a, b) => {
      const ai = ID_ORDER.has(a.id) ? ID_ORDER.get(a.id) : Number.MAX_SAFE_INTEGER
      const bi = ID_ORDER.has(b.id) ? ID_ORDER.get(b.id) : Number.MAX_SAFE_INTEGER
      if (ai !== bi) return ai - bi
      const at = a.actualizada_en ? new Date(a.actualizada_en).getTime() : 0
      const bt = b.actualizada_en ? new Date(b.actualizada_en).getTime() : 0
      return at - bt
    })
    const preguntas = rows.map(r => {
      let textos
      if (r.texto === null || r.texto === undefined) {
        textos = {}
      } else if (typeof r.texto === 'object') {
        textos = r.texto
      } else {
        // Plain string stored in JSONB column – treat as Spanish text
        textos = { es: String(r.texto) }
      }
      // Use the requested language, fall back to 'es', then any available value
      const texto = (lang && textos[lang]) || textos.es || Object.values(textos)[0] || ''
      // The public id of the pregunta is its camelCase `campo` (matches the
      // column name in declaraciones), not the internal UUID.
      return { id: ID_TO_CAMPO.get(r.id) ?? r.id, texto, textos }
    })
    return { data: { secciones: [{ id: 'general', numero: 1, titulo: '', titulos: {}, preguntas }] }, error: null }
  } catch (err) {
    console.error('getPreguntas DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: preguntas ─────────────────────────────────────────────────────


function rowToPreguntaFormulario(r) {
  // texto is JSONB – extract Spanish text for display, or stringify if needed
  const textoRaw = r.texto
  let textos
  let textoDisplay
  if (textoRaw === null || textoRaw === undefined) {
    textos = {}
    textoDisplay = ''
  } else if (typeof textoRaw === 'object') {
    textos = textoRaw
    textoDisplay = textoRaw.es || Object.values(textoRaw)[0] || ''
  } else {
    // Plain string stored in JSONB column
    textos = { es: String(textoRaw) }
    textoDisplay = String(textoRaw)
  }
  return {
    id: r.id,
    texto: textoDisplay,
    textos,
    tipo: 'sino',
    actualizadaEn: r.actualizada_en,
  }
}

async function listPreguntasFormulario({ page = 1, limit = 10 } = {}) {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM preguntas')
    const total = parseInt(countRes.rows[0].count, 10)
    // Fetch all preguntas first so we can apply the canonical-first ordering
    // before paginating; the table is small (≤ a few dozen rows).
    const { rows } = await pool.query(
      `SELECT id, texto, actualizada_en FROM preguntas`
    )
    // Order rows according to the canonical static catalogue order, then by
    // creation order (actualizada_en ASC) for non-canonical rows so newly
    // created preguntas appear at the bottom in a stable order.
    rows.sort((a, b) => {
      const ai = ID_ORDER.has(a.id) ? ID_ORDER.get(a.id) : Number.MAX_SAFE_INTEGER
      const bi = ID_ORDER.has(b.id) ? ID_ORDER.get(b.id) : Number.MAX_SAFE_INTEGER
      if (ai !== bi) return ai - bi
      const at = a.actualizada_en ? new Date(a.actualizada_en).getTime() : 0
      const bt = b.actualizada_en ? new Date(b.actualizada_en).getTime() : 0
      return at - bt
    })
    const offset = (page - 1) * limit
    const paged = rows.slice(offset, offset + limit)
    return {
      data: {
        data: paged.map(r => ({
          ...rowToPreguntaFormulario(r),
          canonica: ID_ORDER.has(r.id),
        })),
        total,
        page,
        limit,
      },
      error: null,
    }
  } catch (err) {
    console.error('listPreguntasFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function createPreguntaFormulario({ texto, textos } = {}) {
  // Build the i18n object. Accept either a `textos` map or a plain `texto`
  // string (treated as the Spanish translation).
  let mergeObj
  if (textos !== undefined) {
    if (typeof textos !== 'object' || Array.isArray(textos) || textos === null) {
      return { data: null, error: { message: 'textos debe ser un objeto con claves de idioma' } }
    }
    const sanitised = {}
    for (const [lang, val] of Object.entries(textos)) {
      const key = String(lang).trim().toLowerCase()
      const v = String(val ?? '').trim()
      if (key && v) sanitised[key] = v
    }
    if (!sanitised.es) {
      return { data: null, error: { message: 'El texto en español (es) es obligatorio' } }
    }
    mergeObj = sanitised
  } else if (texto !== undefined) {
    const v = String(texto).trim()
    if (!v) return { data: null, error: { message: 'El texto no puede estar vacío' } }
    mergeObj = { es: v }
  } else {
    return { data: null, error: { message: 'Debes proporcionar texto o textos' } }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO preguntas (texto)
       VALUES ($1::jsonb)
       RETURNING id, texto, actualizada_en`,
      [JSON.stringify(mergeObj)]
    )
    return { data: { ...rowToPreguntaFormulario(rows[0]), canonica: false }, status: 201, error: null }
  } catch (err) {
    console.error('createPreguntaFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function deletePreguntaFormulario(id) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }
  // Allow deleting any pregunta, including canonical ones.  The static
  // catalogue (backend/data/preguntas.js) keeps the id↔campo mapping for any
  // canonical row that is still present in the DB; deleting the row simply
  // removes that question from the form and the admin list.
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM preguntas WHERE id = $1',
      [id]
    )
    if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' }, status: 404 }
    return { data: null, status: 204, error: null }
  } catch (err) {
    console.error('deletePreguntaFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updatePreguntaFormulario(id, { texto, textos }) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }

  // Build the i18n object to merge.  Accept either a full `textos` map or a
  // legacy plain `texto` string (treated as the Spanish translation).
  let mergeObj
  if (textos !== undefined) {
    if (typeof textos !== 'object' || Array.isArray(textos)) {
      return { data: null, error: { message: 'textos debe ser un objeto con claves de idioma' } }
    }
    const sanitised = {}
    for (const [lang, val] of Object.entries(textos)) {
      const key = lang.trim().toLowerCase()
      if (key) sanitised[key] = String(val)
    }
    if (!Object.keys(sanitised).length) {
      return { data: null, error: { message: 'textos no puede estar vacío' } }
    }
    mergeObj = sanitised
  } else if (texto !== undefined) {
    if (!String(texto).trim()) return { data: null, error: { message: 'El texto no puede estar vacío' } }
    mergeObj = { es: String(texto).trim() }
  } else {
    return { data: null, error: { message: 'No hay cambios que guardar' } }
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE preguntas
         SET texto = COALESCE(texto, '{}'::jsonb) || $1::jsonb,
             actualizada_en = NOW()
       WHERE id = $2`,
      [JSON.stringify(mergeObj), id]
    )
    if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' } }

    const { rows } = await pool.query(
      `SELECT id, texto, actualizada_en FROM preguntas WHERE id = $1`,
      [id]
    )
    return { data: rowToPreguntaFormulario(rows[0]), error: null }
  } catch (err) {
    console.error('updatePreguntaFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Declaraciones ──────────────────────────────────────────────────────────

async function listDeclaraciones({ dniNie, estado, page = 1, limit = 10 }) {
  try {
    const conditions = []
    const params = []
    if (dniNie) { conditions.push(`dni_nie = $${params.length + 1}`); params.push(dniNie) }
    if (estado) { conditions.push(`estado = $${params.length + 1}`); params.push(estado) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM declaraciones ${where}`, params)
    const total = parseInt(countRes.rows[0].count, 10)
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT * FROM declaraciones ${where} ORDER BY creado_en DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const declaraciones = rows.map(rowToDeclaracion)
    return { data: { data: declaraciones, total, page, limit }, error: null }
  } catch (err) {
    console.error('listDeclaraciones DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function listDeclaracionesAll({ dniNie, estado, page = 1, limit = 20 }) {
  try {
    const conditions = []
    const params = []
    if (dniNie) {
      conditions.push(`dni_nie ILIKE $${params.length + 1}`)
      params.push(`%${dniNie}%`)
    }
    if (estado) { conditions.push(`estado = $${params.length + 1}`); params.push(estado) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM declaraciones ${where}`, params)
    const total = parseInt(countRes.rows[0].count, 10)
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT * FROM declaraciones ${where} ORDER BY creado_en DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const declaraciones = rows.map(rowToDeclaracion)
    return { data: { data: declaraciones, total, page, limit }, error: null }
  } catch (err) {
    console.error('listDeclaracionesAll DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

const REQUIRED_TEXT_FIELDS = ['nombre', 'apellidos', 'dniNie', 'telefono']
// All Sí/No answer fields are optional. They map 1:1 to nullable
// `respuesta_yn` columns in `declaraciones`; empty/missing values are
// stored as NULL via `toYN()`.
const YN_FIELDS = [
  'viviendaAlquiler', 'alquilerMenos35', 'viviendaPropiedad', 'propiedadAntes2013',
  'pisosAlquiladosTerceros', 'segundaResidencia', 'familiaNumerosa', 'ayudasGobierno',
  'mayores65ACargo', 'mayoresConviven', 'hijosMenores26', 'hijosConviven',
  'ingresosJuego', 'ingresosInversiones',
]

function validateDeclaracionBody(body, { requireAll = false } = {}) {
  if (requireAll) {
    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!body[field]) return `Campo obligatorio: ${field}`
    }
  }
  for (const field of YN_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '' && body[field] !== 'si' && body[field] !== 'no') {
      return `El campo '${field}' debe ser 'si', 'no' o estar vacío`
    }
  }
  return null
}

function toYN(val) {
  if (val === 'si' || val === 'no') return val
  return null
}

async function createDeclaracion(body) {
  const {
    nombre, apellidos, dniNie, email, telefono,
    viviendaAlquiler, alquilerMenos35, viviendaPropiedad, propiedadAntes2013,
    pisosAlquiladosTerceros, segundaResidencia,
    familiaNumerosa, ayudasGobierno, mayores65ACargo, mayoresConviven,
    hijosMenores26, hijosConviven, ingresosJuego, ingresosInversiones,
  } = body

  const validationError = validateDeclaracionBody(body, { requireAll: true })
  if (validationError) return { data: null, error: { message: validationError }, status: 400 }

  // Guard: refuse to create a declaration if no questions are configured
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM preguntas')
    const count = countRes.rows && countRes.rows.length > 0 ? parseInt(countRes.rows[0].count, 10) : 0
    if (count === 0) {
      return { data: null, error: { message: 'No hay preguntas configuradas. Contacta con el administrador.' }, status: 422 }
    }
  } catch (err) {
    console.error('createDeclaracion preguntas-count error:', err.message)
    return { data: null, error: { message: 'Error verificando configuración de preguntas' }, status: 503 }
  }

  let rows
  try {
    ({ rows } = await pool.query(
      `INSERT INTO declaraciones (
        nombre, apellidos, dni_nie, email, telefono,
        vivienda_alquiler, alquiler_menos_35, vivienda_propiedad, propiedad_antes_2013,
        pisos_alquilados_terceros, segunda_residencia,
        familia_numerosa, ayudas_gobierno, mayores_65_a_cargo, mayores_conviven,
        hijos_menores_26, hijos_conviven, ingresos_juego, ingresos_inversiones
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      ) RETURNING id, estado, creado_en`,
      [
        nombre, apellidos, dniNie, email, telefono,
        toYN(viviendaAlquiler), toYN(alquilerMenos35), toYN(viviendaPropiedad), toYN(propiedadAntes2013),
        toYN(pisosAlquiladosTerceros), toYN(segundaResidencia),
        toYN(familiaNumerosa), toYN(ayudasGobierno), toYN(mayores65ACargo), toYN(mayoresConviven),
        toYN(hijosMenores26), toYN(hijosConviven), toYN(ingresosJuego), toYN(ingresosInversiones),
      ]
    ))
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'uq_declaraciones_dni_nie') {
      return { data: null, error: { message: 'Ya existe una declaración con este DNI/NIE' }, status: 409 }
    }
    console.error('createDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
  const row = rows[0]
  const declaracionId = row.id

  return { data: { id: declaracionId, estado: row.estado, creadoEn: row.creado_en }, error: null, status: 201 }
}

async function getDeclaracion(id) {
  try {
    const { rows } = await pool.query('SELECT * FROM declaraciones WHERE id = $1', [id])
    if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
    const dec = rowToDeclaracion(rows[0])
    return { data: dec, error: null }
  } catch (err) {
    console.error('getDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function getDeclaracionByToken(token) {
  if (!token) return { data: null, error: { message: 'Token requerido' } }
  try {
    const { rows } = await pool.query('SELECT * FROM declaraciones WHERE id = $1', [token.trim()])
    if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
    const dec = rowToDeclaracion(rows[0])
    return { data: dec, error: null }
  } catch (err) {
    console.error('getDeclaracionByToken DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateEstadoDeclaracion(id, estado) {
  try {
    const { rows } = await pool.query(
      'UPDATE declaraciones SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    )
    if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
    return { data: rowToDeclaracion(rows[0]), error: null }
  } catch (err) {
    console.error('updateEstadoDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateDeclaracion(id, body) {
  const validationError = validateDeclaracionBody(body, { requireAll: false })
  if (validationError) return { data: null, error: { message: validationError }, status: 400 }

  // Build a dynamic SET clause for only provided fields
  const FIELD_MAP = {
    nombre: 'nombre',
    apellidos: 'apellidos',
    email: 'email',
    telefono: 'telefono',
    viviendaAlquiler: 'vivienda_alquiler',
    alquilerMenos35: 'alquiler_menos_35',
    viviendaPropiedad: 'vivienda_propiedad',
    propiedadAntes2013: 'propiedad_antes_2013',
    pisosAlquiladosTerceros: 'pisos_alquilados_terceros',
    segundaResidencia: 'segunda_residencia',
    familiaNumerosa: 'familia_numerosa',
    ayudasGobierno: 'ayudas_gobierno',
    mayores65ACargo: 'mayores_65_a_cargo',
    mayoresConviven: 'mayores_conviven',
    hijosMenores26: 'hijos_menores_26',
    hijosConviven: 'hijos_conviven',
    ingresosJuego: 'ingresos_juego',
    ingresosInversiones: 'ingresos_inversiones',
  }
  const ALL_YN_FIELDS = new Set(YN_FIELDS)
  const setClauses = []
  const params = []
  for (const [camel, snake] of Object.entries(FIELD_MAP)) {
    if (body[camel] !== undefined) {
      const val = ALL_YN_FIELDS.has(camel) ? toYN(body[camel]) : body[camel]
      params.push(val)
      setClauses.push(`${snake} = $${params.length}`)
    }
  }

  try {
    if (setClauses.length) {
      params.push(id)
      const { rows } = await pool.query(
        `UPDATE declaraciones SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      )
      if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
      return { data: rowToDeclaracion(rows[0]), error: null }
    } else {
      const { rows } = await pool.query('SELECT * FROM declaraciones WHERE id = $1', [id])
      if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
      return { data: rowToDeclaracion(rows[0]), error: null }
    }
  } catch (err) {
    console.error('updateDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function deleteDeclaracion(id) {
  try {
    const { rowCount } = await pool.query('DELETE FROM declaraciones WHERE id = $1', [id])
    if (!rowCount) return { data: null, error: { message: 'Declaración no encontrada' } }
    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('deleteDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: Secciones ───────────────────────────────────────────────────────

// (secciones table removed – no longer used)

// ── Admin: Usuarios ────────────────────────────────────────────────────────

async function listUsersAdmin({ bloqueado, denunciado, search, page = 1, limit = 10 }) {
  try {
    const conditions = []
    const params = []
    if (bloqueado !== undefined) { conditions.push(`bloqueado = $${params.length + 1}`); params.push(bloqueado) }
    if (denunciado !== undefined) { conditions.push(`denunciado = $${params.length + 1}`); params.push(denunciado) }
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&')
      const like = `%${escaped}%`
      conditions.push(`(nombre ILIKE $${params.length + 1} OR apellidos ILIKE $${params.length + 2} OR email ILIKE $${params.length + 3} OR dni_nie ILIKE $${params.length + 4})`)
      params.push(like, like, like, like)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM usuarios ${where}`, params)
    const total = parseInt(countRes.rows[0].count, 10)
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT * FROM usuarios ${where} ORDER BY creado_en DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    return { data: { data: rows.map(rowToUser), total, page, limit }, error: null }
  } catch (err) {
    console.error('listUsersAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function blockUser(dniNie, bloqueado) {
  try {
    const { rowCount } = await pool.query(
      'UPDATE usuarios SET bloqueado = $1 WHERE dni_nie = $2',
      [!!bloqueado, dniNie]
    )
    if (!rowCount) return { data: null, error: { message: 'Usuario no encontrado' } }
    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('blockUser DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function reportUser(dniNie, denunciado) {
  try {
    const { rowCount } = await pool.query(
      'UPDATE usuarios SET denunciado = $1 WHERE dni_nie = $2',
      [!!denunciado, dniNie]
    )
    if (!rowCount) return { data: null, error: { message: 'Usuario no encontrado' } }
    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('reportUser DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function deleteUser(dniNie) {
  try {
    const { rows } = await pool.query('SELECT role FROM usuarios WHERE dni_nie = $1', [dniNie])
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    if (rows[0].role === 'admin') {
      return { data: null, error: { message: 'No se pueden eliminar usuarios administradores' }, status: 403 }
    }
    await pool.query('DELETE FROM declaraciones WHERE dni_nie = $1', [dniNie])
    await pool.query('DELETE FROM usuarios WHERE dni_nie = $1', [dniNie])
    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('deleteUser DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function assignUserAccount({ dniNie, password, declaracionId }) {
  if (!dniNie || !password) {
    return { data: null, error: { message: 'DNI/NIE y contraseña son obligatorios' } }
  }
  try {
    const decCheck = await pool.query('SELECT nombre, apellidos, email, telefono FROM declaraciones WHERE id = $1', [declaracionId])
    if (!decCheck.rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
    const dec = decCheck.rows[0]
    const existing = await pool.query('SELECT dni_nie FROM usuarios WHERE dni_nie = $1', [dniNie])
    const isNew = !existing.rows.length
    const hashed = await hashPassword(password)
    if (isNew) {
      await pool.query(
        `INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, 'user', $6)`,
        [dniNie, dec.nombre, dec.apellidos, dec.email, dec.telefono ?? '', hashed]
      )
    } else {
      await pool.query('UPDATE usuarios SET password_hash = $1 WHERE dni_nie = $2', [hashed, dniNie])
    }
    return { data: { created: isNew, dniNie }, error: null }
  } catch (err) {
    console.error('assignUserAccount DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function getUserByDniNie(dniNie) {
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE dni_nie = $1', [dniNie])
    return { data: rows.length ? rowToUser(rows[0]) : null, error: null }
  } catch (err) {
    console.error('getUserByDniNie DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Public: Idiomas & Traducciones ─────────────────────────────────────────

async function getIdiomas() {
  try {
    const { rows } = await pool.query(
      `SELECT code, label FROM idiomas WHERE activo = TRUE ORDER BY code`
    )
    return { data: rows, error: null }
  } catch (err) {
    console.error('getIdiomas DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function getTraducciones() {
  try {
    const { rows } = await pool.query(
      `SELECT i.code, t.clave, t.valor
       FROM traducciones t
       JOIN idiomas i ON i.id = t.idioma_id
       WHERE i.activo = TRUE
       ORDER BY i.code, t.clave`
    )
    const result = {}
    for (const r of rows) {
      if (!result[r.code]) result[r.code] = {}
      result[r.code][r.clave] = r.valor
    }
    return { data: result, error: null }
  } catch (err) {
    console.error('getTraducciones DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: Idiomas CRUD ───────────────────────────────────────────────────

function rowToIdioma(r) {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    activo: r.activo,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
  }
}

async function listIdiomasAdmin({ activo, page = 1, limit = 20 } = {}) {
  try {
    const conditions = []
    const params = []
    if (activo !== undefined) {
      conditions.push(`activo = $${params.length + 1}`)
      params.push(activo)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM idiomas ${where}`, params)
    const total = parseInt(countRes.rows[0].count, 10)
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT * FROM idiomas ${where} ORDER BY code LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    return { data: { data: rows.map(rowToIdioma), total, page, limit }, error: null }
  } catch (err) {
    console.error('listIdiomasAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function createIdiomaAdmin({ code, label, activo }) {
  if (!code || !String(code).trim()) return { data: null, error: { message: 'El código es obligatorio' } }
  if (!label || !String(label).trim()) return { data: null, error: { message: 'La etiqueta es obligatoria' } }
  try {
    const { rows } = await pool.query(
      `INSERT INTO idiomas (code, label, activo) VALUES ($1, $2, $3) RETURNING *`,
      [code.trim().toLowerCase(), label.trim(), activo ?? true]
    )
    return { data: rowToIdioma(rows[0]), error: null, status: 201 }
  } catch (err) {
    if (err.code === '23505') {
      return { data: null, error: { message: 'Ya existe un idioma con ese código' }, status: 409 }
    }
    console.error('createIdiomaAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateIdiomaAdmin(id, { label, activo }) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }
  const setClauses = []
  const params = []
  if (label !== undefined) {
    params.push(label.trim())
    setClauses.push(`label = $${params.length}`)
  }
  if (activo !== undefined) {
    params.push(activo)
    setClauses.push(`activo = $${params.length}`)
  }
  if (!setClauses.length) return { data: null, error: { message: 'No hay cambios que guardar' } }
  try {
    params.push(id)
    const { rows } = await pool.query(
      `UPDATE idiomas SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return { data: null, error: { message: 'Idioma no encontrado' } }
    return { data: rowToIdioma(rows[0]), error: null }
  } catch (err) {
    console.error('updateIdiomaAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function deleteIdiomaAdmin(id) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }
  try {
    // Prevent deleting the default language (es)
    const check = await pool.query('SELECT code FROM idiomas WHERE id = $1', [id])
    if (!check.rows.length) return { data: null, error: { message: 'Idioma no encontrado' }, status: 404 }
    if (check.rows[0].code === 'es') {
      return { data: null, error: { message: 'No se puede eliminar el idioma por defecto' }, status: 400 }
    }
    await pool.query('DELETE FROM idiomas WHERE id = $1', [id])
    return { data: null, error: null, status: 204 }
  } catch (err) {
    console.error('deleteIdiomaAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function getIdiomaContent(id) {
  try {
    const idioma = await pool.query('SELECT id, code FROM idiomas WHERE id = $1', [id])
    if (!idioma.rows.length) return { data: null, error: { message: 'Idioma no encontrado' }, status: 404 }
    const { rows } = await pool.query(
      `SELECT clave, valor FROM traducciones WHERE idioma_id = $1 ORDER BY clave`,
      [id]
    )
    const content = {}
    for (const r of rows) content[r.clave] = r.valor
    return { data: { code: idioma.rows[0].code, content }, error: null }
  } catch (err) {
    console.error('getIdiomaContent DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateIdiomaContent(id, { content }) {
  if (!content || typeof content !== 'object') {
    return { data: null, error: { message: 'El contenido es obligatorio' } }
  }
  try {
    const idioma = await pool.query('SELECT id, code FROM idiomas WHERE id = $1', [id])
    if (!idioma.rows.length) return { data: null, error: { message: 'Idioma no encontrado' }, status: 404 }

    // Full replacement inside a transaction: delete existing translations then re-insert.
    // This ensures keys removed on the client are also removed from the database,
    // and the operation is atomic — a failed INSERT cannot leave the table empty.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM traducciones WHERE idioma_id = $1', [id])
      const entries = Object.entries(content)
      if (entries.length) {
        const values = []
        const placeholders = []
        let idx = 1
        for (const [clave, valor] of entries) {
          placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`)
          values.push(id, clave, String(valor))
          idx += 3
        }
        await client.query(
          `INSERT INTO traducciones (idioma_id, clave, valor) VALUES ${placeholders.join(', ')}`,
          values
        )
      }
      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }

    // Return the full content after update
    return getIdiomaContent(id)
  } catch (err) {
    console.error('updateIdiomaContent DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: Traducciones faltantes ─────────────────────────────────────────

async function getMissingTranslations(ref = 'static') {
  try {
    // Normalise the reference code
    const refCode = String(ref || 'static').trim().toLowerCase()

    // ── Static mode: compare every active language against the canonical key
    //    list extracted from the frontend source.  No base language required.
    if (refCode === 'static') {
      const allLangsRes = await pool.query(
        `SELECT code, id FROM idiomas WHERE activo = TRUE ORDER BY code`
      )

      const faltantes = {}
      for (const { code, id } of allLangsRes.rows) {
        const existingRes = await pool.query(
          `SELECT clave FROM traducciones WHERE idioma_id = $1`,
          [id]
        )
        const existing = new Set(existingRes.rows.map(r => r.clave))
        faltantes[code] = ALL_REQUIRED_KEYS.filter(k => !existing.has(k))
      }

      const resumen = Object.entries(faltantes).map(([idioma, claves]) => ({
        idioma,
        total_faltantes: claves.length,
      }))

      return {
        data: {
          referencia: 'static',
          total_claves: ALL_REQUIRED_KEYS.length,
          claves_requeridas: ALL_REQUIRED_KEYS,
          faltantes,
          resumen,
        },
        error: null,
      }
    }

    // ── Reference-language mode: use a DB language as the key source ──────────

    // Check if the reference language exists and is active
    const refCheck = await pool.query(
      `SELECT id FROM idiomas WHERE code = $1 AND activo = TRUE`,
      [refCode]
    )

    // When the reference language does not exist fall back to static mode so
    // callers always get a useful response.
    if (!refCheck.rows.length) {
      return getMissingTranslations('static')
    }

    const refId = refCheck.rows[0].id

    // Total keys in the reference language
    const totalRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM traducciones WHERE idioma_id = $1`,
      [refId]
    )
    const totalClaves = parseInt(totalRes.rows[0].cnt, 10)

    // Determine the effective reference key set: DB keys, or fallback to
    // ALL_REQUIRED_KEYS when the reference language has no translations yet.
    let refKeys
    if (totalClaves === 0) {
      refKeys = ALL_REQUIRED_KEYS
    } else {
      const refKeysRes = await pool.query(
        `SELECT clave FROM traducciones WHERE idioma_id = $1 ORDER BY clave`,
        [refId]
      )
      // Merge DB keys with static keys so newly added frontend keys are always reported
      const dbKeys = new Set(refKeysRes.rows.map(r => r.clave))
      const merged = new Set([...dbKeys, ...ALL_REQUIRED_KEYS])
      refKeys = [...merged].sort()
    }

    // All other active languages (to include ones with 0 missing keys in the result)
    const otherLangsRes = await pool.query(
      `SELECT code, id FROM idiomas WHERE activo = TRUE AND code != $1 ORDER BY code`,
      [refCode]
    )

    const faltantes = {}
    for (const { code } of otherLangsRes.rows) faltantes[code] = []

    if (otherLangsRes.rows.length > 0) {
      for (const { code, id } of otherLangsRes.rows) {
        const existingRes = await pool.query(
          `SELECT clave FROM traducciones WHERE idioma_id = $1`,
          [id]
        )
        const existing = new Set(existingRes.rows.map(r => r.clave))
        faltantes[code] = refKeys.filter(k => !existing.has(k))
      }
    }

    const resumen = Object.entries(faltantes).map(([idioma, claves]) => ({
      idioma,
      total_faltantes: claves.length,
    }))

    return {
      data: {
        referencia: refCode,
        total_claves: refKeys.length,
        claves_requeridas: ALL_REQUIRED_KEYS,
        faltantes,
        resumen,
      },
      error: null,
    }
  } catch (err) {
    console.error('getMissingTranslations DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Email stubs ────────────────────────────────────────────────────────────
// Email delivery is not configured in this deployment.  These stubs keep the
// API surface consistent (no unhandled TypeErrors in the routes) and return
// a clear message so callers know the feature is unavailable.

async function sendEmailDeclaracion({ declaracionId }) {
  if (!declaracionId) {
    return { data: null, error: { message: 'declaracionId es obligatorio' }, status: 400 }
  }
  // Verify the declaration exists before responding
  try {
    const { rows } = await pool.query('SELECT id FROM declaraciones WHERE id = $1', [declaracionId])
    if (!rows.length) {
      return { data: null, error: { message: 'Declaración no encontrada' }, status: 404 }
    }
  } catch (err) {
    console.error('sendEmailDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
  return { data: null, error: { message: 'El envío de correo no está configurado en este servidor' }, status: 501 }
}

async function sendEmailToUser({ dniNie }) {
  if (!dniNie) {
    return { data: null, error: { message: 'dniNie es obligatorio' }, status: 400 }
  }
  // Verify the user exists before responding
  try {
    const { rows } = await pool.query('SELECT dni_nie FROM usuarios WHERE dni_nie = $1', [dniNie])
    if (!rows.length) {
      return { data: null, error: { message: 'Usuario no encontrado' }, status: 404 }
    }
  } catch (err) {
    console.error('sendEmailToUser DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
  return { data: null, error: { message: 'El envío de correo no está configurado en este servidor' }, status: 501 }
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  loginAdmin,
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
  listPreguntasFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
  listUsersAdmin,
  blockUser,
  reportUser,
  deleteUser,
  assignUserAccount,
  getUserByDniNie,
  getIdiomas,
  getTraducciones,
  listIdiomasAdmin,
  createIdiomaAdmin,
  updateIdiomaAdmin,
  deleteIdiomaAdmin,
  getIdiomaContent,
  updateIdiomaContent,
  getMissingTranslations,
  ALL_REQUIRED_KEYS,
  sendEmailDeclaracion,
  sendEmailToUser,
}
