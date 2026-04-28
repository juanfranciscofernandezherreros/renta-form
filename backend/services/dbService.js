'use strict'

// ---------------------------------------------------------------------------
//  DB service – all business logic backed by PostgreSQL.
//  Column names in the DB use snake_case; they are mapped to camelCase
//  before returning to the API consumer.
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('../db/pool')
const mailer = require('./mailer')
const pdfGenerator = require('./pdfGenerator')
const { signToken } = require('../middleware/auth')
const { encryptDni, decryptDni, hashDni } = require('../utils/dniEncryption')
const { parseCsv, rowsToCsv } = require('../utils/csv')

const BCRYPT_ROUNDS = 12
const ADMIN_SESSION_TTL_SECONDS = 5 * 60 // 5 minutes

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
  'btnFinalize',
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
  'emailEnvioTitle',
  'emailEnvioLabel',
  'emailEnvioSaved',
  'rentaPdfBtn',
  'rentaPdfBtnTitle',
  'section1',
  'section5',
  'sectionConfirm',
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
    dniNie: decryptDni(row.dni_nie),
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
    dniNie: decryptDni(row.dni_nie),
    nombre: row.nombre,
    apellidos: row.apellidos,
    email: row.email,
    telefono: row.telefono ?? '',
    roles: Array.isArray(row.roles) ? row.roles.filter(Boolean) : [],
    bloqueado: row.bloqueado ?? false,
    denunciado: row.denunciado ?? false,
    preguntasAsignadas: row.preguntas_asignadas ?? [],
    creadoEn: row.creado_en,
  }
}

// SQL fragment that aggregates the role names of each user as a TEXT[].
// Use as `${USER_SELECT_WITH_ROLES} FROM usuarios u ${USER_ROLES_JOIN} ...`.
const USER_SELECT_WITH_ROLES =
  `SELECT u.*, COALESCE(ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles`
const USER_ROLES_JOIN =
  `LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
   LEFT JOIN roles r           ON r.id = ur.rol_id`

async function loadRolesForDniNie(dniNie) {
  const { rows } = await pool.query(
    `SELECT COALESCE(ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
       FROM usuarios u
       LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r           ON r.id = ur.rol_id
      WHERE u.dni_nie_hash = $1
      GROUP BY u.id`,
    [hashDni(dniNie)]
  )
  return rows.length ? rows[0].roles : null
}

// ── Auth ───────────────────────────────────────────────────────────────────

async function loginAdmin({ username, password }) {
  try {
    const normalised = (username ?? '').trim()
    if (!normalised) return { data: null, error: { message: 'Usuario no encontrado' } }
    const { rows } = await pool.query(
      `${USER_SELECT_WITH_ROLES}
         FROM usuarios u ${USER_ROLES_JOIN}
        WHERE LOWER(u.username) = LOWER($1)
        GROUP BY u.id`,
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    const user = rows[0]
    const roles = (user.roles || []).filter(Boolean)
    if (!roles.includes('admin')) return { data: null, error: { message: 'No tienes permisos de administrador' } }
    if (user.bloqueado) return { data: null, error: { message: 'USER_BLOCKED' } }
    if (!user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return { data: null, error: { message: 'Contraseña incorrecta' } }
    }
    return {
      data: {
        username: user.username,
        roles,
        email: user.email,
        token: signToken({ sub: user.username, roles }, ADMIN_SESSION_TTL_SECONDS),
      },
      error: null,
    }
  } catch (err) {
    console.error('loginAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function changePassword({ username, oldPassword, newPassword }) {
  try {
    const normalised = (username ?? '').trim()
    if (!normalised) return { data: null, error: { message: 'Usuario no encontrado' } }
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE LOWER(username) = LOWER($1)',
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    if (!rows[0].password_hash || !(await verifyPassword(oldPassword, rows[0].password_hash))) {
      return { data: null, error: { message: 'La contraseña actual es incorrecta' } }
    }
    const hashed = await hashPassword(newPassword)
    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE LOWER(username) = LOWER($2)',
      [hashed, normalised]
    )
    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('changePassword DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function changeEmail({ username, newEmail }) {
  try {
    const trimmedEmail = (newEmail ?? '').trim()
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return { data: null, error: { message: 'El formato del email no es válido' } }
    }
    const normalised = (username ?? '').trim()
    if (!normalised) return { data: null, error: { message: 'Usuario no encontrado' } }
    const { rows } = await pool.query(
      `SELECT u.email,
              COALESCE(ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
         FROM usuarios u ${USER_ROLES_JOIN}
        WHERE LOWER(u.username) = LOWER($1)
        GROUP BY u.id`,
      [normalised]
    )
    if (!rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
    const user = rows[0]
    // Only admins can change their own email through this endpoint.
    if (!Array.isArray(user.roles) || !user.roles.includes('admin')) {
      return { data: null, error: { message: 'No tienes permisos para cambiar el email' }, status: 403 }
    }
    if (user.email === trimmedEmail) {
      return { data: { success: true, email: user.email }, error: null }
    }
    await pool.query(
      'UPDATE usuarios SET email = $1 WHERE LOWER(username) = LOWER($2)',
      [trimmedEmail, normalised]
    )
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
    estado: r.estado ?? 'activa',
    creadaEn: r.creada_en,
    actualizadaEn: r.actualizada_en,
  }
}

async function listPreguntasFormulario({ page = 1, limit = 10 } = {}) {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM preguntas')
    const total = parseInt(countRes.rows[0].count, 10)
    const offset = (page - 1) * limit
    const { rows } = await pool.query(
      `SELECT id, campo, orden, texto, estado, creada_en, actualizada_en
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

const VALID_ESTADO_PREGUNTA = new Set(['activa', 'inactiva', 'borrador', 'archivada'])

async function createPreguntaFormulario({ campo, orden, texto, textos, estado } = {}) {
  // Validate campo (mandatory, camelCase, unique)
  if (!campo || typeof campo !== 'string' || !campo.trim()) {
    return { data: null, error: { message: 'El campo es obligatorio' } }
  }
  const campoNorm = campo.trim()
  if (!CAMPO_RE.test(campoNorm)) {
    return { data: null, error: { message: 'El campo debe ser camelCase (letras y números, comenzando por minúscula)' } }
  }

  // Validate estado
  let estadoNorm = 'activa'
  if (estado !== undefined && estado !== null && estado !== '') {
    const v = String(estado).trim()
    if (!VALID_ESTADO_PREGUNTA.has(v)) {
      return { data: null, error: { message: `estado debe ser uno de: ${[...VALID_ESTADO_PREGUNTA].join(', ')}` } }
    }
    estadoNorm = v
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
      `INSERT INTO preguntas (campo, orden, texto, estado)
       VALUES ($1, $2, $3::jsonb, $4::estado_pregunta)
       RETURNING id, campo, orden, texto, estado, creada_en, actualizada_en`,
      [campoNorm, ordenNum, JSON.stringify(mergeObj), estadoNorm]
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

async function updatePreguntaFormulario(id, { campo, orden, texto, textos, estado } = {}) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }

  // Validate inputs up front (before opening a transaction).
  let campoNorm
  if (campo !== undefined) {
    campoNorm = String(campo).trim()
    if (!CAMPO_RE.test(campoNorm)) {
      return { data: null, error: { message: 'El campo debe ser camelCase (letras y números, comenzando por minúscula)' } }
    }
  }

  let estadoNorm
  if (estado !== undefined && estado !== null && estado !== '') {
    const v = String(estado).trim()
    if (!VALID_ESTADO_PREGUNTA.has(v)) {
      return { data: null, error: { message: `estado debe ser uno de: ${[...VALID_ESTADO_PREGUNTA].join(', ')}` } }
    }
    estadoNorm = v
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

  if (campoNorm === undefined && requestedOrden === null && !mergeObj && estadoNorm === undefined) {
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
    if (estadoNorm !== undefined) {
      params.push(estadoNorm)
      setClauses.push(`estado = $${params.length}::estado_pregunta`)
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
      `SELECT id, campo, orden, texto, estado, creada_en, actualizada_en FROM preguntas WHERE id = $1`,
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
    if (dniNie) { conditions.push(`dni_nie_hash = $${params.length + 1}`); params.push(hashDni(dniNie)) }
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
      conditions.push(`dni_nie_hash = $${params.length + 1}`)
      params.push(hashDni(dniNie))
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

async function isEmailEnvioActivo() {
  try {
    const { rows } = await pool.query(
      `SELECT valor FROM configuracion WHERE clave = 'email_envio_activo'`
    )
    if (rows.length === 0) return true
    return rows[0].valor !== 'false'
  } catch (err) {
    console.error('isEmailEnvioActivo DB error:', err.message)
    return true
  }
}

async function getConfiguracion() {
  try {
    const { rows } = await pool.query('SELECT clave, valor FROM configuracion ORDER BY clave')
    const data = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
    return { data, error: null }
  } catch (err) {
    console.error('getConfiguracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateConfiguracion(clave, valor) {
  try {
    await pool.query(
      `INSERT INTO configuracion (clave, valor) VALUES ($1, $2)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [clave, String(valor)]
    )
    return { data: { clave, valor: String(valor) }, error: null }
  } catch (err) {
    console.error('updateConfiguracion DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function notifyAdminsOfDeclaracion(dec, attachments) {
  try {
    if (!(await isEmailEnvioActivo())) {
      console.info('[mailer] Email sending disabled by configuration; skipping admin notification')
      return
    }
    const { rows } = await pool.query(
      `SELECT DISTINCT u.email
         FROM usuarios u
         JOIN usuarios_roles ur ON ur.usuario_id = u.id
         JOIN roles r           ON r.id = ur.rol_id
        WHERE r.nombre = 'admin'
          AND u.email IS NOT NULL
          AND u.email <> ''`
    )
    const recipients = rows.map((r) => r.email).filter(Boolean)
    if (recipients.length === 0) {
      console.info('[mailer] No admin recipients found for declaration notification')
      return
    }
    const subject = `Nueva declaración de renta guardada (${dec.dniNie || dec.id})`
    const lines = [
      'Se ha guardado correctamente una nueva declaración de renta.',
      '',
      `ID: ${dec.id}`,
      `Nombre: ${dec.nombre || ''} ${dec.apellidos || ''}`.trim(),
      `DNI/NIE: ${dec.dniNie || ''}`,
      `Email del contribuyente: ${dec.email || ''}`,
      `Teléfono: ${dec.telefono || ''}`,
      '',
      'Adjunto encontrarás el cuestionario respondido en formato PDF.',
    ]
    await mailer.sendMail({
      to: recipients,
      subject,
      text: lines.join('\n'),
      attachments,
    })
  } catch (err) {
    console.error('notifyAdminsOfDeclaracion DB error:', err.message)
  }
}

async function notifyClientOfDeclaracion(dec, attachments) {
  try {
    if (!(await isEmailEnvioActivo())) {
      console.info('[mailer] Email sending disabled by configuration; skipping client notification')
      return
    }
    const to = (dec.email || '').trim()
    if (!to) return
    const subject = 'Tu cuestionario de la Renta 2025'
    const nombre = (dec.nombre || '').trim()
    const greeting = nombre ? `Hola ${nombre},` : 'Hola,'
    const lines = [
      greeting,
      '',
      'Hemos recibido correctamente tu cuestionario para la Campaña de la Renta 2025.',
      'Adjunto a este correo encontrarás el PDF con las respuestas que has facilitado.',
      '',
      'Si necesitas modificar algún dato, ponte en contacto con nosotros.',
      '',
      'Un saludo,',
      'NH Gestión Integral',
    ]
    await mailer.sendMail({
      to,
      subject,
      text: lines.join('\n'),
      attachments,
    })
  } catch (err) {
    console.error('notifyClientOfDeclaracion error:', err.message)
  }
}

async function buildDeclaracionPdfAttachment(dec) {
  if (!pdfGenerator.isAvailable()) return null
  try {
    // Load preguntas (ES text) so the PDF shows the full question along with the answer.
    const { rows } = await pool.query(
      `SELECT campo, texto FROM preguntas ORDER BY orden NULLS LAST, actualizada_en, campo`
    )
    const preguntas = rows.map((r) => {
      const t = r.texto
      let texto = ''
      if (t === null || t === undefined) texto = ''
      else if (typeof t === 'object') texto = t.es || Object.values(t)[0] || ''
      else texto = String(t)
      return { campo: r.campo, texto }
    })
    const buffer = await pdfGenerator.generateDeclaracionPDFBuffer(dec, preguntas)
    return [{
      filename: pdfGenerator.buildPdfFilename(dec),
      content: buffer,
      contentType: 'application/pdf',
    }]
  } catch (err) {
    console.error('buildDeclaracionPdfAttachment error:', err.message)
    return null
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
  const respuestasByCampo = {}
  for (const [campo, preguntaId] of campoToId) {
    const v = toYN(body[campo])
    if (v) {
      respuestaEntries.push([preguntaId, v])
      respuestasByCampo[campo] = v
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `INSERT INTO declaraciones (nombre, apellidos, dni_nie, dni_nie_hash, email, telefono)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, estado, creado_en`,
      [nombre, apellidos, encryptDni(dniNie), hashDni(dniNie), email, telefono]
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
    // Fire-and-forget: notify administrators that a new declaration was saved
    // and (if email was provided) send the contributor a copy of their answers.
    // We don't await this to keep the API response fast, and any failure is
    // logged inside the helpers / mailer.sendMail.
    const decForPdf = {
      id: declaracionId,
      estado: row.estado,
      creadoEn: row.creado_en,
      nombre,
      apellidos,
      dniNie,
      email,
      telefono,
      ...respuestasByCampo,
    }
    ;(async () => {
      const attachments = await buildDeclaracionPdfAttachment(decForPdf)
      await Promise.all([
        notifyAdminsOfDeclaracion(decForPdf, attachments),
        notifyClientOfDeclaracion(decForPdf, attachments),
      ])
    })().catch((err) => {
      console.error('post-create notifications error:', err.message)
    })
    return { data: { id: declaracionId, estado: row.estado, creadoEn: row.creado_en }, error: null, status: 201 }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505' && (err.constraint === 'uq_declaraciones_dni_nie' || err.constraint === 'uq_declaraciones_dni_nie_hash')) {
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

// ── Bulk import (CSV) ────────────────────────────────────────────────────
//
// CSV format expected (one declaration per row):
//
//   nombre,apellidos,dniNie,email,telefono,<campo1>,<campo2>,...
//
// where <campoN> is the `campo` of each pregunta currently configured in
// the database.  Answer cells must be empty, "si" or "no".  For resilience
// we also accept common variants ("sí", "yes"/"y", "true", "1", "no"/"n",
// "false", "0", case-insensitive).  Personal fields (nombre, apellidos,
// dniNie, telefono) are required; `email` is optional.

const PERSONAL_HEADERS = ['nombre', 'apellidos', 'dniNie', 'email', 'telefono']
const BULK_IMPORT_MAX_ROWS = 30

function normaliseAnswerCell(raw) {
  if (raw === null || raw === undefined) return ''
  const s = String(raw).trim().toLowerCase()
  if (s === '') return ''
  if (s === 'si' || s === 'sí' || s === 'yes' || s === 'y' || s === 'true' || s === '1') return 'si'
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return 'no'
  return null // invalid sentinel
}

/**
 * Builds a CSV template with a header row that includes the personal-data
 * columns followed by every pregunta `campo` currently configured in the DB,
 * in the same order returned by `getPreguntas()`.  No example row is
 * included so the admin can simply append data rows below the header.
 */
async function getDeclaracionesImportTemplate() {
  try {
    const { rows } = await pool.query(
      `SELECT campo FROM preguntas ORDER BY orden NULLS LAST, actualizada_en, campo`
    )
    const campos = rows.map(r => r.campo)
    const header = [...PERSONAL_HEADERS, ...campos]
    return { data: rowsToCsv([header]), error: null }
  } catch (err) {
    console.error('getDeclaracionesImportTemplate DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

/**
 * Imports many declarations from a CSV string.  Each row is processed
 * inside its own transaction (via createDeclaracion) so a failed row does
 * not abort the import.  Returns a per-row report so the admin can correct
 * and re-upload.
 */
async function bulkImportDeclaraciones(csvText) {
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    return { data: null, error: { message: 'CSV vacío' }, status: 400 }
  }

  let rows
  try {
    rows = parseCsv(csvText)
  } catch (err) {
    return { data: null, error: { message: `CSV inválido: ${err.message}` }, status: 400 }
  }
  // Drop fully-empty rows (e.g. trailing blank lines)
  rows = rows.filter(r => r.some(c => String(c ?? '').trim() !== ''))
  if (rows.length < 2) {
    return { data: null, error: { message: 'CSV debe tener cabecera y al menos una fila' }, status: 400 }
  }

  const header = rows[0].map(h => String(h ?? '').trim())
  const dataRows = rows.slice(1)

  if (dataRows.length > BULK_IMPORT_MAX_ROWS) {
    return {
      data: null,
      error: { message: `Se permiten como máximo ${BULK_IMPORT_MAX_ROWS} declaraciones por importación (recibidas ${dataRows.length})` },
      status: 400,
    }
  }

  for (const required of REQUIRED_TEXT_FIELDS) {
    if (!header.includes(required)) {
      return { data: null, error: { message: `Cabecera CSV: falta la columna obligatoria '${required}'` }, status: 400 }
    }
  }

  let campoToId
  try {
    campoToId = await loadCampoToPreguntaId()
  } catch (err) {
    console.error('bulkImportDeclaraciones preguntas error:', err.message)
    return { data: null, error: { message: 'Error verificando configuración de preguntas' }, status: 503 }
  }
  if (campoToId.size === 0) {
    return { data: null, error: { message: 'No hay preguntas configuradas. Contacta con el administrador.' }, status: 422 }
  }

  const knownPersonal = new Set(PERSONAL_HEADERS)
  const headerKinds = header.map(h => {
    if (knownPersonal.has(h)) return { kind: 'personal', key: h }
    if (campoToId.has(h)) return { kind: 'pregunta', key: h }
    return { kind: 'unknown', key: h }
  })
  const unknownHeaders = headerKinds.filter(h => h.kind === 'unknown').map(h => h.key)

  const report = {
    total: dataRows.length,
    imported: 0,
    failed: 0,
    unknownHeaders,
    rows: [],
  }

  for (let r = 0; r < dataRows.length; r += 1) {
    const csvLine = r + 2 // +1 for header, +1 for 1-based humans
    const cells = dataRows[r]

    const body = {}
    let invalidAnswerErr = null
    for (let c = 0; c < headerKinds.length; c += 1) {
      const meta = headerKinds[c]
      const raw = cells[c]
      if (meta.kind === 'unknown') continue
      if (meta.kind === 'personal') {
        body[meta.key] = raw === undefined || raw === null ? '' : String(raw).trim()
        continue
      }
      const v = normaliseAnswerCell(raw)
      if (v === null) {
        invalidAnswerErr = `Valor inválido para '${meta.key}': '${raw}'. Usa 'si', 'no' o vacío`
        break
      }
      if (v !== '') body[meta.key] = v
    }

    if (invalidAnswerErr) {
      report.failed += 1
      report.rows.push({ line: csvLine, ok: false, error: invalidAnswerErr })
      continue
    }

    const result = await createDeclaracion(body)
    if (result.error) {
      report.failed += 1
      report.rows.push({ line: csvLine, ok: false, error: result.error.message })
    } else {
      report.imported += 1
      report.rows.push({ line: csvLine, ok: true, id: result.data?.id })
    }
  }

  return { data: report, error: null, status: 200 }
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
      params.push(camel === 'dniNie' ? encryptDni(body[camel]) : body[camel])
      setClauses.push(`${snake} = $${params.length}`)
      // Keep the hash column in sync whenever dni_nie changes.
      if (camel === 'dniNie') {
        params.push(hashDni(body[camel]))
        setClauses.push(`dni_nie_hash = $${params.length}`)
      }
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
    if (err.code === '23505' && (err.constraint === 'uq_declaraciones_dni_nie_hash' || err.constraint === 'uq_declaraciones_dni_nie')) {
      return { data: null, error: { message: 'Ya existe una declaración con este DNI/NIE' }, status: 409 }
    }
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

async function bulkDeleteDeclaraciones(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { data: null, error: { message: 'Se requiere al menos un id' }, status: 400 }
  }
  try {
    // Build parameterised placeholders: $1, $2, …
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const { rowCount } = await pool.query(
      `DELETE FROM declaraciones WHERE id IN (${placeholders})`,
      ids,
    )
    return { data: { deleted: rowCount }, error: null }
  } catch (err) {
    console.error('bulkDeleteDeclaraciones DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: Secciones ───────────────────────────────────────────────────────

// (secciones table removed – no longer used)

// ── Admin: Usuarios ────────────────────────────────────────────────────────

async function listUsersAdmin({ bloqueado, denunciado, search, page = 1, limit = 10 }) {
  try {
    // The admin user is not a citizen and must never appear in this list.
    const conditions = [
      `NOT EXISTS (
         SELECT 1 FROM usuarios_roles ur
           JOIN roles r ON r.id = ur.rol_id
          WHERE ur.usuario_id = u.id AND r.nombre = 'admin'
       )`,
    ]
    const params = []
    if (bloqueado !== undefined) { conditions.push(`u.bloqueado = $${params.length + 1}`); params.push(bloqueado) }
    if (denunciado !== undefined) { conditions.push(`u.denunciado = $${params.length + 1}`); params.push(denunciado) }
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&')
      const like = `%${escaped}%`
      const hashedSearch = hashDni(search)
      conditions.push(`(u.nombre ILIKE $${params.length + 1} OR u.apellidos ILIKE $${params.length + 2} OR u.email ILIKE $${params.length + 3} OR u.dni_nie_hash = $${params.length + 4})`)
      params.push(like, like, like, hashedSearch)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM usuarios u ${where}`, params)
    const total = parseInt(countRes.rows[0].count, 10)
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const { rows } = await pool.query(
      `${USER_SELECT_WITH_ROLES}
         FROM usuarios u ${USER_ROLES_JOIN}
         ${where}
        GROUP BY u.id
        ORDER BY u.creado_en DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
      'UPDATE usuarios SET bloqueado = $1 WHERE dni_nie_hash = $2',
      [!!bloqueado, hashDni(dniNie)]
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
      'UPDATE usuarios SET denunciado = $1 WHERE dni_nie_hash = $2',
      [!!denunciado, hashDni(dniNie)]
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
    const roles = await loadRolesForDniNie(dniNie)
    if (roles === null) return { data: null, error: { message: 'Usuario no encontrado' } }
    if (roles.includes('admin')) {
      return { data: null, error: { message: 'No se pueden eliminar usuarios administradores' }, status: 403 }
    }
    await pool.query('DELETE FROM declaraciones WHERE dni_nie_hash = $1', [hashDni(dniNie)])
    await pool.query('DELETE FROM usuarios WHERE dni_nie_hash = $1', [hashDni(dniNie)])
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
    const existing = await pool.query('SELECT id FROM usuarios WHERE dni_nie_hash = $1', [hashDni(dniNie)])
    const isNew = !existing.rows.length
    const hashed = await hashPassword(password)
    let usuarioId
    if (isNew) {
      const { rows: insertedRows } = await pool.query(
        `INSERT INTO usuarios (dni_nie, dni_nie_hash, nombre, apellidos, email, telefono, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [encryptDni(dniNie), hashDni(dniNie), dec.nombre, dec.apellidos, dec.email, dec.telefono ?? '', hashed]
      )
      usuarioId = insertedRows[0].id
      // Assign default 'user' role to the newly created account.
      await pool.query(
        `INSERT INTO usuarios_roles (usuario_id, rol_id)
         SELECT $1, r.id FROM roles r WHERE r.nombre = 'user'
         ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
        [usuarioId]
      )
    } else {
      await pool.query('UPDATE usuarios SET password_hash = $1 WHERE dni_nie_hash = $2', [hashed, hashDni(dniNie)])
    }
    return { data: { created: isNew, dniNie }, error: null }
  } catch (err) {
    console.error('assignUserAccount DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function getUserByDniNie(dniNie) {
  try {
    const { rows } = await pool.query(
      `${USER_SELECT_WITH_ROLES}
         FROM usuarios u ${USER_ROLES_JOIN}
        WHERE u.dni_nie_hash = $1
        GROUP BY u.id`,
      [hashDni(dniNie)]
    )
    return { data: rows.length ? rowToUser(rows[0]) : null, error: null }
  } catch (err) {
    console.error('getUserByDniNie DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

// ── Admin: Roles & asignación usuario↔rol (many-to-many) ───────────────────

const RESERVED_ROLE_NAMES = new Set(['admin', 'user'])
const ROLE_NAME_REGEX = /^[a-zA-Z0-9_-]{2,50}$/

function rowToRole(row) {
  if (!row) return null
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? '',
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    usuarios: typeof row.usuarios === 'string' ? parseInt(row.usuarios, 10) : (row.usuarios ?? 0),
  }
}

async function listRolesAdmin() {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.nombre, r.descripcion, r.creado_en, r.actualizado_en,
              COUNT(ur.usuario_id)::int AS usuarios
         FROM roles r
         LEFT JOIN usuarios_roles ur ON ur.rol_id = r.id
        GROUP BY r.id
        ORDER BY r.nombre ASC`
    )
    return { data: rows.map(rowToRole), error: null }
  } catch (err) {
    console.error('listRolesAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function createRoleAdmin({ nombre, descripcion } = {}) {
  const name = (nombre ?? '').trim()
  if (!ROLE_NAME_REGEX.test(name)) {
    return { data: null, error: { message: 'El nombre del rol no es válido (2-50 caracteres alfanuméricos, guión o guión bajo)' } }
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO roles (nombre, descripcion)
       VALUES ($1, $2)
       RETURNING id, nombre, descripcion, creado_en, actualizado_en`,
      [name, (descripcion ?? '').trim()]
    )
    return { data: { ...rowToRole(rows[0]), usuarios: 0 }, status: 201, error: null }
  } catch (err) {
    if (err.code === '23505') {
      return { data: null, error: { message: 'Ya existe un rol con ese nombre' }, status: 409 }
    }
    console.error('createRoleAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function updateRoleAdmin(id, { nombre, descripcion } = {}) {
  try {
    const { rows: existingRows } = await pool.query('SELECT nombre FROM roles WHERE id = $1', [id])
    if (!existingRows.length) return { data: null, error: { message: 'Rol no encontrado' }, status: 404 }
    const currentName = existingRows[0].nombre

    const fields = []
    const params = []
    if (nombre !== undefined) {
      const name = (nombre ?? '').trim()
      if (!ROLE_NAME_REGEX.test(name)) {
        return { data: null, error: { message: 'El nombre del rol no es válido (2-50 caracteres alfanuméricos, guión o guión bajo)' } }
      }
      // Reserved roles cannot be renamed (they are referenced by name in code).
      if (RESERVED_ROLE_NAMES.has(currentName) && name !== currentName) {
        return { data: null, error: { message: 'Los roles reservados del sistema no se pueden renombrar' }, status: 403 }
      }
      params.push(name)
      fields.push(`nombre = $${params.length}`)
    }
    if (descripcion !== undefined) {
      params.push(String(descripcion ?? '').trim())
      fields.push(`descripcion = $${params.length}`)
    }
    if (!fields.length) {
      return { data: null, error: { message: 'No hay campos para actualizar' } }
    }
    params.push(id)
    const { rows } = await pool.query(
      `UPDATE roles SET ${fields.join(', ')} WHERE id = $${params.length}
       RETURNING id, nombre, descripcion, creado_en, actualizado_en`,
      params
    )
    return { data: rowToRole(rows[0]), error: null }
  } catch (err) {
    if (err.code === '23505') {
      return { data: null, error: { message: 'Ya existe un rol con ese nombre' }, status: 409 }
    }
    console.error('updateRoleAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function deleteRoleAdmin(id) {
  try {
    const { rows } = await pool.query('SELECT nombre FROM roles WHERE id = $1', [id])
    if (!rows.length) return { data: null, error: { message: 'Rol no encontrado' }, status: 404 }
    if (RESERVED_ROLE_NAMES.has(rows[0].nombre)) {
      return { data: null, error: { message: 'Los roles reservados del sistema no se pueden eliminar' }, status: 403 }
    }
    // ON DELETE CASCADE on usuarios_roles removes any assignments.
    await pool.query('DELETE FROM roles WHERE id = $1', [id])
    return { data: null, status: 204, error: null }
  } catch (err) {
    console.error('deleteRoleAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function getUserRolesAdmin(dniNie) {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.nombre, r.descripcion, r.creado_en, r.actualizado_en
         FROM usuarios u
         JOIN usuarios_roles ur ON ur.usuario_id = u.id
         JOIN roles r           ON r.id = ur.rol_id
        WHERE u.dni_nie_hash = $1
        ORDER BY r.nombre ASC`,
      [hashDni(dniNie)]
    )
    // 404 if the user does not exist at all.
    const exists = await pool.query('SELECT 1 FROM usuarios WHERE dni_nie_hash = $1', [hashDni(dniNie)])
    if (!exists.rowCount) return { data: null, error: { message: 'Usuario no encontrado' }, status: 404 }
    return { data: rows.map(rowToRole), error: null }
  } catch (err) {
    console.error('getUserRolesAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }
}

async function setUserRolesAdmin(dniNie, { roles } = {}) {
  if (!Array.isArray(roles)) {
    return { data: null, error: { message: 'El campo "roles" debe ser un array de nombres de rol' } }
  }
  const wantedNames = [...new Set(roles.map(r => String(r ?? '').trim()).filter(Boolean))]
  const client = await pool.connect()
  try {
    const userRes = await client.query('SELECT id FROM usuarios WHERE dni_nie_hash = $1', [hashDni(dniNie)])
    if (!userRes.rows.length) {
      return { data: null, error: { message: 'Usuario no encontrado' }, status: 404 }
    }
    const usuarioId = userRes.rows[0].id

    let rolIds = []
    if (wantedNames.length) {
      const { rows: roleRows } = await client.query(
        `SELECT id, nombre FROM roles WHERE nombre = ANY($1::text[])`,
        [wantedNames]
      )
      const foundNames = new Set(roleRows.map(r => r.nombre))
      const missing = wantedNames.filter(n => !foundNames.has(n))
      if (missing.length) {
        return { data: null, error: { message: `Roles desconocidos: ${missing.join(', ')}` } }
      }
      rolIds = roleRows.map(r => r.id)
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM usuarios_roles WHERE usuario_id = $1', [usuarioId])
    if (rolIds.length) {
      await client.query(
        `INSERT INTO usuarios_roles (usuario_id, rol_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [usuarioId, rolIds]
      )
    }
    await client.query('COMMIT')
    return { data: { dniNie, roles: wantedNames }, error: null }
  } catch (err) {
    await client.query('ROLLBACK').catch(rbErr => {
      console.error('setUserRolesAdmin rollback failed:', rbErr.message)
    })
    console.error('setUserRolesAdmin DB error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  } finally {
    client.release()
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

  // Load the full declaration (with respuestas spread) so we can build the
  // PDF attachment exactly like the auto-notification on creation does.
  let dec
  try {
    const result = await getDeclaracion(declaracionId)
    if (result.error) return result
    dec = result.data
    if (!dec) {
      return { data: null, error: { message: 'Declaración no encontrada' }, status: 404 }
    }
  } catch (err) {
    console.error('sendEmailDeclaracion lookup error:', err.message)
    return { data: null, error: { message: 'Error de base de datos' }, status: 503 }
  }

  const to = (dec.email || '').trim()
  if (!to) {
    return { data: null, error: { message: 'La declaración no tiene email asociado' }, status: 400 }
  }

  if (!(await isEmailEnvioActivo())) {
    return { data: null, error: { message: 'El envío de correo está desactivado en la configuración' }, status: 503 }
  }
  if (!mailer.isConfigured()) {
    return { data: null, error: { message: 'El envío de correo no está configurado en este servidor' }, status: 501 }
  }

  const attachments = await buildDeclaracionPdfAttachment(dec)
  const subject = 'Tu cuestionario de la Renta 2025'
  const nombre = (dec.nombre || '').trim()
  const greeting = nombre ? `Hola ${nombre},` : 'Hola,'
  const lines = [
    greeting,
    '',
    'Te enviamos de nuevo el cuestionario para la Campaña de la Renta 2025 que has facilitado.',
    'Adjunto a este correo encontrarás el PDF con las respuestas registradas.',
    '',
    'Si necesitas modificar algún dato, ponte en contacto con nosotros.',
    '',
    'Un saludo,',
    'NH Gestión Integral',
  ]
  const result = await mailer.sendMail({
    to,
    subject,
    text: lines.join('\n'),
    attachments,
  })
  if (!result.sent) {
    return {
      data: null,
      error: { message: result.error || 'No se pudo enviar el email' },
      status: 502,
    }
  }
  return { data: { sent: true, to, messageId: result.messageId }, error: null }
}

async function sendEmailToUser({ dniNie }) {
  if (!dniNie) {
    return { data: null, error: { message: 'dniNie es obligatorio' }, status: 400 }
  }
  // Verify the user exists before responding
  try {
    const { rows } = await pool.query('SELECT dni_nie FROM usuarios WHERE dni_nie_hash = $1', [hashDni(dniNie)])
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
  changePassword,
  changeEmail,
  getPreguntas,
  listDeclaraciones,
  listDeclaracionesAll,
  createDeclaracion,
  bulkImportDeclaraciones,
  getDeclaracionesImportTemplate,
  getDeclaracion,
  getDeclaracionByToken,
  updateEstadoDeclaracion,
  updateDeclaracion,
  deleteDeclaracion,
  bulkDeleteDeclaraciones,
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
  listRolesAdmin,
  createRoleAdmin,
  updateRoleAdmin,
  deleteRoleAdmin,
  getUserRolesAdmin,
  setUserRolesAdmin,
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
  getConfiguracion,
  updateConfiguracion,
}
