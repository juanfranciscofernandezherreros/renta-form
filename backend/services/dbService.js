'use strict'

// ---------------------------------------------------------------------------
//  DB service – all business logic backed by PostgreSQL.
//  Column names in the DB use snake_case; they are mapped to camelCase
//  before returning to the API consumer.
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('../db/pool')

const BCRYPT_ROUNDS = 12

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

async function loginUser({ dniNie, password }) {
  const { rows } = await pool.query(
    'SELECT password_hash, role, bloqueado FROM usuarios WHERE dni_nie = $1',
    [dniNie]
  )
  if (!rows.length) return { data: null, error: { message: 'DNI/NIE no encontrado' } }
  const user = rows[0]
  if (user.bloqueado) return { data: null, error: { message: 'USER_BLOCKED' } }
  if (!(await verifyPassword(password, user.password_hash))) {
    return { data: null, error: { message: 'Contraseña incorrecta' } }
  }
  return { data: { dniNie, role: user.role }, error: null }
}

async function changePassword({ dniNie, oldPassword, newPassword }) {
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
}

// ── IRPF preguntas (loaded from DB) ──────────────────────────────────────

async function getPreguntas() {
  try {
    const { rows } = await pool.query(
      `SELECT campo, texto, seccion, seccion_orden, seccion_titulos, orden
       FROM preguntas
       ORDER BY seccion_orden, orden`
    )
    if (!rows.length) return { data: { secciones: [] }, error: null }

    const seccionMap = new Map()
    for (const r of rows) {
      const key = r.seccion || 'general'
      if (!seccionMap.has(key)) {
        const titulos = typeof r.seccion_titulos === 'string'
          ? JSON.parse(r.seccion_titulos)
          : (r.seccion_titulos ?? {})
        seccionMap.set(key, {
          id: key,
          numero: r.seccion_orden + 1,
          titulo: titulos.es || key,
          titulos,
          preguntas: [],
        })
      }
      // texto column is JSONB with all translations: {"es": "...", "fr": "...", ...}
      const textos = typeof r.texto === 'string' ? JSON.parse(r.texto) : (r.texto ?? {})
      seccionMap.get(key).preguntas.push({
        id: r.campo,
        texto: textos.es || '',
        textos,
      })
    }
    return { data: { secciones: [...seccionMap.values()] }, error: null }
  } catch (err) {
    console.error('getPreguntas DB error:', err.message)
    return { data: null, error: { message: err.message } }
  }
}

// ── Admin: preguntas ─────────────────────────────────────────────────────

function rowToPreguntaFormulario(r) {
  // texto is JSONB – extract Spanish text for display, or stringify if needed
  const textoRaw = r.texto
  let textoDisplay = textoRaw
  if (textoRaw && typeof textoRaw === 'object') {
    textoDisplay = textoRaw.es || JSON.stringify(textoRaw)
  }
  return {
    id: r.id,
    texto: textoDisplay,
    tipo: 'sino',
    actualizadaEn: r.actualizada_en,
  }
}

async function listPreguntasFormulario() {
  const { rows } = await pool.query(
    `SELECT id, texto, actualizada_en
     FROM preguntas
     ORDER BY seccion_orden, orden`
  )
  return { data: rows.map(rowToPreguntaFormulario), error: null }
}

async function updatePreguntaFormulario(id, { texto }) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }
  if (texto === undefined) return { data: null, error: { message: 'No hay cambios que guardar' } }
  if (!String(texto).trim()) return { data: null, error: { message: 'El texto no puede estar vacío' } }

  const { rowCount } = await pool.query(
    `UPDATE preguntas SET texto = $1, actualizada_en = NOW() WHERE id = $2`,
    [texto.trim(), id]
  )
  if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' } }

  const { rows } = await pool.query(
    `SELECT id, texto, actualizada_en FROM preguntas WHERE id = $1`,
    [id]
  )
  return { data: rowToPreguntaFormulario(rows[0]), error: null }
}

async function createPreguntaFormulario({ texto }) {
  if (!texto || !String(texto).trim()) return { data: null, error: { message: 'El texto es obligatorio' } }

  const { rows } = await pool.query(
    `INSERT INTO preguntas (texto) VALUES ($1) RETURNING id`,
    [texto.trim()]
  )
  if (!rows.length) return { data: null, error: { message: 'No se pudo crear la pregunta' } }

  // Use the UUID as the internal campo key so the public form can reference it
  await pool.query(
    `UPDATE preguntas SET campo = id::text WHERE id = $1 AND (campo IS NULL OR campo = '')`,
    [rows[0].id]
  ).catch(err => console.error('Warning: could not auto-set campo for new question:', err.message))

  const { rows: full } = await pool.query(
    `SELECT id, texto, actualizada_en FROM preguntas WHERE id = $1`,
    [rows[0].id]
  )
  return { data: rowToPreguntaFormulario(full[0]), error: null, status: 201 }
}

async function deletePreguntaFormulario(id) {
  if (!id) return { data: null, error: { message: 'El id es obligatorio' } }
  const { rowCount } = await pool.query(
    'DELETE FROM preguntas WHERE id = $1',
    [id]
  )
  if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' } }
  return { data: { deleted: true }, error: null }
}

// ── Declaraciones ──────────────────────────────────────────────────────────

async function listDeclaraciones({ dniNie, estado, page = 1, limit = 10 }) {
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
}

async function listDeclaracionesAll({ dniNie, estado, page = 1, limit = 20 }) {
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
}

async function createDeclaracion(body) {
  const {
    nombre, apellidos, dniNie, email, telefono,
    viviendaAlquiler, alquilerMenos35, viviendaPropiedad, propiedadAntes2013,
    pisosAlquiladosTerceros, segundaResidencia,
    familiaNumerosa, ayudasGobierno, mayores65ACargo, mayoresConviven,
    hijosMenores26, ingresosJuego, ingresosInversiones,
  } = body

  let rows
  try {
    ({ rows } = await pool.query(
      `INSERT INTO declaraciones (
        nombre, apellidos, dni_nie, email, telefono,
        vivienda_alquiler, alquiler_menos_35, vivienda_propiedad, propiedad_antes_2013,
        pisos_alquilados_terceros, segunda_residencia,
        familia_numerosa, ayudas_gobierno, mayores_65_a_cargo, mayores_conviven,
        hijos_menores_26, ingresos_juego, ingresos_inversiones
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
      ) RETURNING id, estado, creado_en`,
      [
        nombre, apellidos, dniNie, email, telefono,
        viviendaAlquiler, alquilerMenos35 ?? null, viviendaPropiedad, propiedadAntes2013 ?? null,
        pisosAlquiladosTerceros, segundaResidencia,
        familiaNumerosa, ayudasGobierno, mayores65ACargo, mayoresConviven ?? null,
        hijosMenores26, ingresosJuego, ingresosInversiones,
      ]
    ))
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'uq_declaraciones_dni_nie') {
      return { data: null, error: { message: 'Ya existe una declaración con este DNI/NIE' }, status: 409 }
    }
    throw err
  }
  const row = rows[0]
  const declaracionId = row.id

  return { data: { id: declaracionId, estado: row.estado, creadoEn: row.creado_en }, error: null, status: 201 }
}

async function getDeclaracion(id) {
  const { rows } = await pool.query('SELECT * FROM declaraciones WHERE id = $1', [id])
  if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
  const dec = rowToDeclaracion(rows[0])
  return { data: dec, error: null }
}

async function getDeclaracionByToken(token) {
  if (!token) return { data: null, error: { message: 'Token requerido' } }
  const { rows } = await pool.query('SELECT * FROM declaraciones WHERE id = $1', [token.trim()])
  if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
  const dec = rowToDeclaracion(rows[0])
  return { data: dec, error: null }
}

async function updateEstadoDeclaracion(id, estado) {
  const { rows } = await pool.query(
    'UPDATE declaraciones SET estado = $1 WHERE id = $2 RETURNING *',
    [estado, id]
  )
  if (!rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
  return { data: rowToDeclaracion(rows[0]), error: null }
}

async function updateDeclaracion(id, body) {
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
    ingresosJuego: 'ingresos_juego',
    ingresosInversiones: 'ingresos_inversiones',
  }
  const setClauses = []
  const params = []
  for (const [camel, snake] of Object.entries(FIELD_MAP)) {
    if (body[camel] !== undefined) {
      params.push(body[camel])
      setClauses.push(`${snake} = $${params.length}`)
    }
  }

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
}

async function deleteDeclaracion(id) {
  const { rowCount } = await pool.query('DELETE FROM declaraciones WHERE id = $1', [id])
  if (!rowCount) return { data: null, error: { message: 'Declaración no encontrada' } }
  return { data: { success: true }, error: null }
}

async function sendEmailDeclaracion({ declaracionId, email, mensaje }) {
  console.info(`[DB EMAIL] → ${email} (declaracion: ${declaracionId}): ${mensaje ?? 'Notificación enviada.'}`)
  return { data: { success: true, to: email }, error: null }
}

// ── Admin: Secciones ───────────────────────────────────────────────────────

// (secciones table removed – no longer used)

// ── Admin: Usuarios ────────────────────────────────────────────────────────

async function listUsersAdmin({ bloqueado, denunciado, page = 1, limit = 10 }) {
  const conditions = []
  const params = []
  if (bloqueado !== undefined) { conditions.push(`bloqueado = $${params.length + 1}`); params.push(bloqueado) }
  if (denunciado !== undefined) { conditions.push(`denunciado = $${params.length + 1}`); params.push(denunciado) }
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
}

async function blockUser(dniNie, bloqueado) {
  const { rowCount } = await pool.query(
    'UPDATE usuarios SET bloqueado = $1 WHERE dni_nie = $2',
    [!!bloqueado, dniNie]
  )
  if (!rowCount) return { data: null, error: { message: 'Usuario no encontrado' } }
  return { data: { success: true }, error: null }
}

async function reportUser(dniNie, denunciado) {
  const { rowCount } = await pool.query(
    'UPDATE usuarios SET denunciado = $1 WHERE dni_nie = $2',
    [!!denunciado, dniNie]
  )
  if (!rowCount) return { data: null, error: { message: 'Usuario no encontrado' } }
  return { data: { success: true }, error: null }
}

async function deleteUser(dniNie) {
  const { rowCount } = await pool.query('DELETE FROM usuarios WHERE dni_nie = $1', [dniNie])
  if (!rowCount) return { data: null, error: { message: 'Usuario no encontrado' } }
  return { data: { success: true }, error: null }
}

async function assignUserAccount({ dniNie, password, declaracionId }) {
  if (!dniNie || !password) {
    return { data: null, error: { message: 'DNI/NIE y contraseña son obligatorios' } }
  }
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
}

async function getUserByDniNie(dniNie) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE dni_nie = $1', [dniNie])
  return { data: rows.length ? rowToUser(rows[0]) : null, error: null }
}

async function sendEmailToUser({ dniNie, email, mensaje }) {
  console.info(`[DB EMAIL → USUARIO] → ${email} (${dniNie}): ${mensaje ?? 'Notificación enviada.'}`)
  return { data: { success: true, to: email }, error: null }
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
  sendEmailToUser,
}
