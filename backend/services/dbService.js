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
  'btnUpdateEmail',
  'btnUpdatingEmail',
  'campaignName',
  'changeEmailTitle',
  'changePasswordTitle',
  'confirmClear',
  'errDniDuplicate',
  'errDniFormat',
  'errEmailFormat',
  'errEmailRequired',
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
  'fieldNewEmail',
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
  'emailSuccess',
  'rentaPdfBtn',
  'rentaPdfBtnTitle',
  'section1',
  'section5',
  'step1Subtitle',
  'successText',
  'successTitle',
  'summaryTitle',
  'summaryYourData',
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

/** Maps the personal-data row of a declaracion (snake_case → camelCase). */
function rowToDeclaracion(row, respuestas = {}) {
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
    // Spread answer map so each campo (e.g. viviendaAlquiler) becomes a
    // top-level property of the declaracion object — the frontend reads
    // them as `dec[pregunta.campo]`.
    ...respuestas,
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
      'SELECT password_hash, role, bloqueado, email FROM usuarios WHERE UPPER(dni_nie) = $1',
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    const user = rows[0]
    if (user.role !== 'admin') return { data: null, error: { message: 'No tienes permisos de administrador' } }
    if (user.bloqueado) return { data: null, error: { message: 'USER_BLOCKED' } }
    if (!(await verifyPassword(password, user.password_hash))) {
      return { data: null, error: { message: 'Contraseña incorrecta' } }
    }
    return { data: { username: normalised, role: user.role, email: user.email }, error: null }
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function changeEmail({ dniNie, password, newEmail }) {
  try {
    const trimmedEmail = (newEmail ?? '').trim()
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return { data: null, error: { message: 'El formato del email no es válido' } }
    }
    const normalised = (dniNie ?? '').trim().toUpperCase()
    const { rows } = await pool.query(
      'SELECT password_hash, role, email FROM usuarios WHERE UPPER(dni_nie) = $1',
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    const user = rows[0]
    // Only admins can change their own email through this endpoint.
    if (user.role !== 'admin') {
      return { data: null, error: { message: 'No tienes permisos para cambiar el email' }, status: 403 }
    }
    if (!(await verifyPassword(password, user.password_hash))) {
      return { data: null, error: { message: 'La contraseña actual es incorrecta' } }
    }
    if (user.email === trimmedEmail) {
      return { data: { success: true, email: user.email }, error: null }
    }
    await pool.query('UPDATE usuarios SET email = $1 WHERE UPPER(dni_nie) = $2', [trimmedEmail, normalised])
    return { data: { success: true, email: trimmedEmail }, error: null }
  } catch (err) {
    console.error('changeEmail DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── IRPF preguntas (loaded from DB, fully dynamic) ───────────────────────

async function getPreguntas(lang) {
  try {
    const { rows } = await pool.query(
      `SELECT id, campo, orden, texto, actualizada_en
         FROM preguntas
        ORDER BY orden NULLS LAST, actualizada_en, campo`
    )
    const preguntas = rows.map(r => {
      let textos
      if (r.texto === null || r.texto === undefined) {
        textos = {}
      } else if (typeof r.texto === 'object') {
        textos = r.texto
      } else {
        textos = { es: String(r.texto) }
      }
      const texto = (lang && textos[lang]) || textos.es || Object.values(textos)[0] || ''
      // The public id of each pregunta is its `campo` (camelCase). The
      // internal UUID stays in the DB as the FK target for respuestas.
      return { id: r.campo, texto, textos }
    })
    return { data: { secciones: [{ id: 'general', numero: 1, titulo: '', titulos: {}, preguntas }] }, error: null }
  } catch (err) {
    console.error('getPreguntas DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: preguntas ─────────────────────────────────────────────────────

function rowToPreguntaFormulario(r) {
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
    textos = { es: String(textoRaw) }
    textoDisplay = String(textoRaw)
  }
  return {
    id: r.id,
    campo: r.campo,
    orden: r.orden,
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
    const offset = (page - 1) * limit
    const { rows } = await pool.query(
      `SELECT id, campo, orden, texto, actualizada_en
         FROM preguntas
        ORDER BY orden NULLS LAST, actualizada_en, campo
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    return {
      data: {
        data: rows.map(rowToPreguntaFormulario),
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

// camelCase identifier used as the public id of a pregunta.
const CAMPO_RE = /^[a-z][a-zA-Z0-9]*$/

function sanitiseTextos(raw) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}
  for (const [lang, val] of Object.entries(raw)) {
    const key = String(lang).trim().toLowerCase()
    const v = String(val ?? '').trim()
    if (key && v) out[key] = v
  }
  return out
}

async function createPreguntaFormulario({ campo, orden, texto, textos } = {}) {
  // Validate campo (mandatory, camelCase, unique)
  if (!campo || typeof campo !== 'string' || !campo.trim()) {
    return { data: null, error: { message: 'El campo es obligatorio' } }
  }
  const campoNorm = campo.trim()
  if (!CAMPO_RE.test(campoNorm)) {
    return { data: null, error: { message: 'El campo debe ser camelCase (letras y números, comenzando por minúscula)' } }
  }

  // Build the i18n object
  let mergeObj
  if (textos !== undefined) {
    const sanitised = sanitiseTextos(textos)
    if (!sanitised) return { data: null, error: { message: 'textos debe ser un objeto con claves de idioma' } }
    if (!Object.keys(sanitised).length) {
      return { data: null, error: { message: 'Debes proporcionar el texto de la pregunta en al menos un idioma' } }
    }
    mergeObj = sanitised
  } else if (texto !== undefined) {
    const v = String(texto).trim()
    if (!v) return { data: null, error: { message: 'El texto no puede estar vacío' } }
    mergeObj = { es: v }
  } else {
    return { data: null, error: { message: 'Debes proporcionar texto o textos' } }
  }

  // Parse the requested orden (if any). The actual numeric value is decided
  // inside the transaction so that it can be clamped against the live state
  // of the table without a TOCTOU race against concurrent inserts.
  let requestedOrden = null
  if (orden !== undefined && orden !== null && orden !== '') {
    const parsed = parseInt(orden, 10)
    if (Number.isNaN(parsed)) return { data: null, error: { message: 'orden debe ser un número entero' } }
    if (parsed < 1) return { data: null, error: { message: 'orden debe ser mayor o igual que 1' } }
    requestedOrden = parsed
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock the table so the MAX(orden) read and the shift below are atomic
    // with respect to other concurrent create/update operations.
    await client.query('LOCK TABLE preguntas IN SHARE ROW EXCLUSIVE MODE')

    const { rows: maxRows } = await client.query(
      `SELECT COALESCE(MAX(orden), 0)::int AS maxo FROM preguntas`
    )
    const maxo = maxRows[0].maxo
    let ordenNum
    if (requestedOrden === null) {
      // No position requested → append at the end.
      ordenNum = maxo + 1
    } else {
      // Clamp to the valid insertion range [1, maxo + 1] and shift everything
      // that would collide with the new row one position down.
      ordenNum = Math.min(requestedOrden, maxo + 1)
      if (ordenNum <= maxo) {
        await client.query(
          `UPDATE preguntas SET orden = orden + 1 WHERE orden >= $1`,
          [ordenNum]
        )
      }
    }

    const { rows } = await client.query(
      `INSERT INTO preguntas (campo, orden, texto)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, campo, orden, texto, actualizada_en`,
      [campoNorm, ordenNum, JSON.stringify(mergeObj)]
    )
    await client.query('COMMIT')
    return { data: rowToPreguntaFormulario(rows[0]), status: 201, error: null }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') {
      return { data: null, error: { message: 'Ya existe una pregunta con ese campo' }, status: 409 }
    }
    console.error('createPreguntaFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  } finally {
    client.release()
  }
}

async function deletePreguntaFormulario(id) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }
  try {
    const { rowCount } = await pool.query('DELETE FROM preguntas WHERE id = $1', [id])
    if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' }, status: 404 }
    return { data: null, status: 204, error: null }
  } catch (err) {
    console.error('deletePreguntaFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updatePreguntaFormulario(id, { campo, orden, texto, textos } = {}) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }

  // Validate inputs up front (before opening a transaction).
  let campoNorm
  if (campo !== undefined) {
    campoNorm = String(campo).trim()
    if (!CAMPO_RE.test(campoNorm)) {
      return { data: null, error: { message: 'El campo debe ser camelCase (letras y números, comenzando por minúscula)' } }
    }
  }

  let requestedOrden = null
  if (orden !== undefined && orden !== null && orden !== '') {
    const parsed = parseInt(orden, 10)
    if (Number.isNaN(parsed)) return { data: null, error: { message: 'orden debe ser un número entero' } }
    if (parsed < 1) return { data: null, error: { message: 'orden debe ser mayor o igual que 1' } }
    requestedOrden = parsed
  }

  // Build merge object for texto
  let mergeObj
  if (textos !== undefined) {
    const sanitised = sanitiseTextos(textos)
    if (!sanitised || !Object.keys(sanitised).length) {
      return { data: null, error: { message: 'textos no puede estar vacío' } }
    }
    mergeObj = sanitised
  } else if (texto !== undefined) {
    if (!String(texto).trim()) return { data: null, error: { message: 'El texto no puede estar vacío' } }
    mergeObj = { es: String(texto).trim() }
  }

  if (campoNorm === undefined && requestedOrden === null && !mergeObj) {
    return { data: null, error: { message: 'No hay cambios que guardar' } }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock the table so reorder reads/writes are atomic with respect to
    // other concurrent create/update operations.
    await client.query('LOCK TABLE preguntas IN SHARE ROW EXCLUSIVE MODE')

    // Locate the target row to know its current orden (needed for the shift).
    const { rows: existing } = await client.query(
      `SELECT orden FROM preguntas WHERE id = $1`,
      [id]
    )
    if (!existing.length) {
      await client.query('ROLLBACK').catch(() => {})
      return { data: null, error: { message: 'Pregunta no encontrada' }, status: 404 }
    }
    const oldOrden = parseInt(existing[0].orden, 10)

    // If the orden is changing, shift the affected range so positions stay
    // contiguous and the target row ends up exactly where the caller asked.
    let nextOrden = oldOrden
    if (requestedOrden !== null) {
      const { rows: maxRows } = await client.query(
        `SELECT COALESCE(MAX(orden), 0)::int AS maxo FROM preguntas`
      )
      const maxo = maxRows[0].maxo
      // Target position is clamped to the current valid range [1, maxo]
      // since we are not adding a new row. (maxo >= 1 because the target
      // row was just located above.)
      nextOrden = Math.min(requestedOrden, maxo)

      if (nextOrden < oldOrden) {
        // Moving up: shift down rows in [nextOrden, oldOrden - 1] except self.
        await client.query(
          `UPDATE preguntas
              SET orden = orden + 1
            WHERE orden >= $1 AND orden < $2 AND id <> $3`,
          [nextOrden, oldOrden, id]
        )
      } else if (nextOrden > oldOrden) {
        // Moving down: shift up rows in (oldOrden, nextOrden] except self.
        await client.query(
          `UPDATE preguntas
              SET orden = orden - 1
            WHERE orden > $1 AND orden <= $2 AND id <> $3`,
          [oldOrden, nextOrden, id]
        )
      }
    }

    // Build the dynamic SET clause for the target row.
    const setClauses = []
    const params = []
    if (campoNorm !== undefined) {
      params.push(campoNorm)
      setClauses.push(`campo = $${params.length}`)
    }
    if (requestedOrden !== null) {
      params.push(nextOrden)
      setClauses.push(`orden = $${params.length}`)
    }
    if (mergeObj) {
      params.push(JSON.stringify(mergeObj))
      setClauses.push(`texto = COALESCE(texto, '{}'::jsonb) || $${params.length}::jsonb`)
    }
    setClauses.push(`actualizada_en = NOW()`)
    params.push(id)

    const { rowCount } = await client.query(
      `UPDATE preguntas SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    )
    if (!rowCount) {
      await client.query('ROLLBACK').catch(() => {})
      return { data: null, error: { message: 'Pregunta no encontrada' }, status: 404 }
    }

    const { rows } = await client.query(
      `SELECT id, campo, orden, texto, actualizada_en FROM preguntas WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')
    return { data: rowToPreguntaFormulario(rows[0]), error: null }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') {
      return { data: null, error: { message: 'Ya existe una pregunta con ese campo' }, status: 409 }
    }
    console.error('updatePreguntaFormulario error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  } finally {
    client.release()
  }
}

// ── Declaraciones ──────────────────────────────────────────────────────────

const REQUIRED_TEXT_FIELDS = ['nombre', 'apellidos', 'dniNie', 'telefono']
const PERSONAL_FIELDS = new Set([
  ...REQUIRED_TEXT_FIELDS,
  'email',
])

function toYN(val) {
  if (val === 'si' || val === 'no') return val
  return null
}

/**
 * Loads the campo→pregunta_id map from the DB.  Used by create/update to
 * resolve answer keys posted by the client.
 */
async function loadCampoToPreguntaId(client = pool) {
  const { rows } = await client.query(`SELECT id, campo FROM preguntas`)
  const map = new Map()
  for (const r of rows) map.set(r.campo, r.id)
  return map
}

/**
 * Loads all answers for a set of declaration ids, indexed by declaration id.
 * Returns Map<declId, { [campo]: 'si'|'no' }>.
 */
async function loadRespuestasFor(declIds, client = pool) {
  const out = new Map()
  if (!declIds.length) return out
  for (const id of declIds) out.set(id, {})
  const { rows } = await client.query(
    `SELECT r.declaracion_id, p.campo, r.respuesta
       FROM respuestas_declaracion r
       JOIN preguntas p ON p.id = r.pregunta_id
      WHERE r.declaracion_id = ANY($1::uuid[])`,
    [declIds]
  )
  for (const r of rows) {
    const m = out.get(r.declaracion_id)
    if (m) m[r.campo] = r.respuesta
  }
  return out
}

/**
 * Validates that any answer-style field in `body` (anything that isn't a
 * known personal field) is either undefined, empty, 'si' or 'no'.
 */
function validateRespuestasShape(body) {
  for (const [k, v] of Object.entries(body)) {
    if (PERSONAL_FIELDS.has(k)) continue
    if (v === undefined || v === null || v === '') continue
    if (v !== 'si' && v !== 'no') {
      return `El campo '${k}' debe ser 'si', 'no' o estar vacío`
    }
  }
  return null
}

function validateDeclaracionPersonalFields(body, { requireAll = false } = {}) {
  if (requireAll) {
    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!body[field]) return `Campo obligatorio: ${field}`
    }
  }
  return validateRespuestasShape(body)
}

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
    const respuestasMap = await loadRespuestasFor(rows.map(r => r.id))
    const declaraciones = rows.map(r => rowToDeclaracion(r, respuestasMap.get(r.id) ?? {}))
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
    const respuestasMap = await loadRespuestasFor(rows.map(r => r.id))
    const declaraciones = rows.map(r => rowToDeclaracion(r, respuestasMap.get(r.id) ?? {}))
    return { data: { data: declaraciones, total, page, limit }, error: null }
  } catch (err) {
    console.error('listDeclaracionesAll DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function createDeclaracion(body) {
  const { nombre, apellidos, dniNie, email, telefono } = body

  const validationError = validateDeclaracionPersonalFields(body, { requireAll: true })
  if (validationError) return { data: null, error: { message: validationError }, status: 400 }

  // Guard: refuse to create a declaration if no questions are configured
  let campoToId
  try {
    campoToId = await loadCampoToPreguntaId()
    if (campoToId.size === 0) {
      return { data: null, error: { message: 'No hay preguntas configuradas. Contacta con el administrador.' }, status: 422 }
    }
  } catch (err) {
    console.error('createDeclaracion preguntas-count error:', err.message)
    return { data: null, error: { message: 'Error verificando configuración de preguntas' }, status: 503 }
  }

  // Collect answers from the body: any property whose key matches a known
  // pregunta `campo` and whose value is 'si'|'no'.
  const respuestaEntries = []
  for (const [campo, preguntaId] of campoToId) {
    const v = toYN(body[campo])
    if (v) respuestaEntries.push([preguntaId, v])
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `INSERT INTO declaraciones (nombre, apellidos, dni_nie, email, telefono)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, estado, creado_en`,
      [nombre, apellidos, dniNie, email, telefono]
    )
    const row = rows[0]
    const declaracionId = row.id

    for (const [preguntaId, respuesta] of respuestaEntries) {
      await client.query(
        `INSERT INTO respuestas_declaracion (declaracion_id, pregunta_id, respuesta)
         VALUES ($1, $2, $3::respuesta_yn)`,
        [declaracionId, preguntaId, respuesta]
      )
    }

    await client.query('COMMIT')
    return { data: { id: declaracionId, estado: row.estado, creadoEn: row.creado_en }, error: null, status: 201 }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505' && err.constraint === 'uq_declaraciones_dni_nie') {
      return { data: null, error: { message: 'Ya existe una declaración con este DNI/NIE' }, status: 409 }
    }
    console.error('createDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  } finally {
    client.release()
  }
}

async function getDeclaracion(id) {
  try {
    const { rows } = await pool.query('SELECT * FROM declaraciones WHERE id = $1', [id])
    if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
    const respuestasMap = await loadRespuestasFor([rows[0].id])
    return { data: rowToDeclaracion(rows[0], respuestasMap.get(rows[0].id) ?? {}), error: null }
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
    const respuestasMap = await loadRespuestasFor([rows[0].id])
    return { data: rowToDeclaracion(rows[0], respuestasMap.get(rows[0].id) ?? {}), error: null }
  } catch (err) {
    console.error('getDeclaracionByToken DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateEstadoDeclaracion(id, estado) {
  try {
    const { rows } = await pool.query(
      'UPDATE declaraciones SET estado = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *',
      [estado, id]
    )
    if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
    const respuestasMap = await loadRespuestasFor([rows[0].id])
    return { data: rowToDeclaracion(rows[0], respuestasMap.get(rows[0].id) ?? {}), error: null }
  } catch (err) {
    console.error('updateEstadoDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateDeclaracion(id, body) {
  const validationError = validateDeclaracionPersonalFields(body, { requireAll: false })
  if (validationError) return { data: null, error: { message: validationError }, status: 400 }

  // Build a dynamic SET clause for personal fields only
  const PERSONAL_FIELD_MAP = {
    nombre: 'nombre',
    apellidos: 'apellidos',
    email: 'email',
    telefono: 'telefono',
    dniNie: 'dni_nie',
  }
  const setClauses = []
  const params = []
  for (const [camel, snake] of Object.entries(PERSONAL_FIELD_MAP)) {
    if (body[camel] !== undefined) {
      params.push(body[camel])
      setClauses.push(`${snake} = $${params.length}`)
    }
  }

  // Resolve campo→pregunta_id for any answer-style fields
  let campoToId
  try {
    campoToId = await loadCampoToPreguntaId()
  } catch (err) {
    console.error('updateDeclaracion campo lookup error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }

  // Collect answer changes: each key matching a configured pregunta `campo`.
  // 'si'/'no' → upsert; '' or null → delete the answer.
  const answerOps = [] // [{ preguntaId, action: 'set'|'delete', value? }]
  for (const [campo, preguntaId] of campoToId) {
    if (!Object.prototype.hasOwnProperty.call(body, campo)) continue
    const raw = body[campo]
    const v = toYN(raw)
    if (v) {
      answerOps.push({ preguntaId, action: 'set', value: v })
    } else if (raw === '' || raw === null) {
      answerOps.push({ preguntaId, action: 'delete' })
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let row
    if (setClauses.length) {
      setClauses.push(`actualizado_en = NOW()`)
      params.push(id)
      const { rows } = await client.query(
        `UPDATE declaraciones SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      )
      if (!rows.length) {
        await client.query('ROLLBACK')
        return { data: null, error: { message: 'Declaración no encontrada' } }
      }
      row = rows[0]
    } else {
      const { rows } = await client.query('SELECT * FROM declaraciones WHERE id = $1', [id])
      if (!rows.length) {
        await client.query('ROLLBACK')
        return { data: null, error: { message: 'Declaración no encontrada' } }
      }
      row = rows[0]
    }

    for (const op of answerOps) {
      if (op.action === 'set') {
        await client.query(
          `INSERT INTO respuestas_declaracion (declaracion_id, pregunta_id, respuesta)
           VALUES ($1, $2, $3::respuesta_yn)
           ON CONFLICT (declaracion_id, pregunta_id) DO UPDATE
             SET respuesta = EXCLUDED.respuesta`,
          [row.id, op.preguntaId, op.value]
        )
      } else {
        await client.query(
          `DELETE FROM respuestas_declaracion WHERE declaracion_id = $1 AND pregunta_id = $2`,
          [row.id, op.preguntaId]
        )
      }
    }

    await client.query('COMMIT')
    const respuestasMap = await loadRespuestasFor([row.id])
    return { data: rowToDeclaracion(row, respuestasMap.get(row.id) ?? {}), error: null }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('updateDeclaracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  } finally {
    client.release()
  }
}

async function deleteDeclaracion(id) {
  try {
    // respuestas_declaracion is removed automatically via ON DELETE CASCADE.
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
  changeEmail,
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
