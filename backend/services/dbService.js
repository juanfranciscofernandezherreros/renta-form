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
    comentarios: row.comentarios ?? '',
  }
}

function rowToPregunta(row) {
  if (!row) return null
  return {
    id: row.id,
    texto: row.texto,
    seccion: row.seccion,
    tipoRespuesta: row.tipo_respuesta,
    orden: row.orden,
    activa: row.activa,
    obligatoria: row.obligatoria ?? false,
    creadaEn: row.creada_en,
    actualizadaEn: row.actualizada_en,
  }
}

function rowToSeccion(row) {
  if (!row) return null
  return {
    id: row.id,
    nombre: row.nombre,
    orden: row.orden,
    activa: row.activa,
    creadaEn: row.creada_en,
    actualizadaEn: row.actualizada_en,
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
    seccionesAsignadas: row.secciones_asignadas ?? [],
    creadoEn: row.creado_en,
  }
}

function rowToIdioma(row) {
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    activo: row.activo,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  }
}

// ── Static catalogue – used as fallback / reference only ─────────────────
const { CATALOGO_PREGUNTAS } = require('../data/catalogoPreguntas')

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

// ── IRPF preguntas (loaded from DB, falls back to static catalogue) ──────

// Build a lookup of static titulos/textos for multilingual fallback
function buildStaticLookups() {
  const titulos = {}
  const textos = {}
  CATALOGO_PREGUNTAS.secciones.forEach(s => {
    titulos[s.id] = s.titulos
    s.preguntas.forEach(p => { textos[p.id] = p.textos })
  })
  return { titulos, textos }
}

async function getPreguntas() {
  try {
    const { rows: secRows } = await pool.query(
      'SELECT id, titulo, numero, orden FROM secciones_formulario ORDER BY orden'
    )
    const { rows: preRows } = await pool.query(
      `SELECT campo, seccion_id, texto, orden, indentada, condicion_campo, condicion_valor
       FROM preguntas_formulario ORDER BY seccion_id, orden`
    )

    if (secRows.length === 0 || preRows.length === 0) {
      // Tables exist but have no data – return static catalogue
      return { data: CATALOGO_PREGUNTAS, error: null }
    }

    const { titulos: staticTitulos, textos: staticTextos } = buildStaticLookups()

    const secciones = secRows.map(s => ({
      id: s.id,
      numero: s.numero,
      titulo: s.titulo,
      titulos: staticTitulos[s.id] ?? { es: s.titulo },
      preguntas: preRows
        .filter(p => p.seccion_id === s.id)
        .map(p => ({
          id: p.campo,
          texto: p.texto,
          textos: staticTextos[p.campo] ?? { es: p.texto },
          indentada: p.indentada,
          ...(p.condicion_campo
            ? { condicion: { campo: p.condicion_campo, valor: p.condicion_valor } }
            : {}),
        })),
    }))

    return { data: { secciones }, error: null }
  } catch (err) {
    // If tables don't exist yet (pre-migration), fall back to static data
    console.warn('[getPreguntas] Falling back to static catalogue:', err.message)
    return { data: CATALOGO_PREGUNTAS, error: null }
  }
}

// ── Admin: preguntas_formulario ───────────────────────────────────────────

function rowToPreguntaFormulario(r) {
  return {
    campo: r.campo,
    texto: r.texto,
    seccionId: r.seccion_id,
    seccionTitulo: r.seccion_titulo ?? null,
    orden: r.orden,
    indentada: r.indentada,
    condicionCampo: r.condicion_campo ?? null,
    condicionValor: r.condicion_valor ?? null,
    actualizadaEn: r.actualizada_en,
  }
}

async function listPreguntasFormulario() {
  const { rows } = await pool.query(
    `SELECT pf.campo, pf.texto, pf.seccion_id, sf.titulo AS seccion_titulo,
            pf.orden, pf.indentada, pf.condicion_campo, pf.condicion_valor, pf.actualizada_en
     FROM preguntas_formulario pf
     JOIN secciones_formulario sf ON sf.id = pf.seccion_id
     ORDER BY sf.orden, pf.orden`
  )
  return { data: rows.map(rowToPreguntaFormulario), error: null }
}

async function updatePreguntaFormulario(campo, { texto, orden, indentada }) {
  if (!campo) return { data: null, error: { message: 'El campo es obligatorio' } }

  const sets = []
  const params = []

  if (texto !== undefined) {
    if (!String(texto).trim()) return { data: null, error: { message: 'El texto no puede estar vacío' } }
    params.push(texto)
    sets.push(`texto = $${params.length}`)
  }
  if (orden !== undefined) {
    params.push(Number(orden))
    sets.push(`orden = $${params.length}`)
  }
  if (indentada !== undefined) {
    params.push(Boolean(indentada))
    sets.push(`indentada = $${params.length}`)
  }

  if (sets.length === 0) return { data: null, error: { message: 'No hay cambios que guardar' } }

  params.push(campo)
  const { rowCount } = await pool.query(
    `UPDATE preguntas_formulario SET ${sets.join(', ')}, actualizada_en = NOW()
     WHERE campo = $${params.length}`,
    params
  )
  if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' } }

  // Fetch the updated row with its section title via JOIN
  const { rows } = await pool.query(
    `SELECT pf.campo, pf.texto, pf.seccion_id, sf.titulo AS seccion_titulo,
            pf.orden, pf.indentada, pf.condicion_campo, pf.condicion_valor, pf.actualizada_en
     FROM preguntas_formulario pf
     JOIN secciones_formulario sf ON sf.id = pf.seccion_id
     WHERE pf.campo = $1`,
    [campo]
  )
  return { data: rowToPreguntaFormulario(rows[0]), error: null }
}

async function listSeccionesFormulario() {
  const { rows } = await pool.query(
    'SELECT id, titulo, numero, orden FROM secciones_formulario ORDER BY orden'
  )
  return { data: rows.map(r => ({ id: r.id, titulo: r.titulo, numero: r.numero, orden: r.orden })), error: null }
}

async function createPreguntaFormulario({ campo, texto, seccionId, orden = 0, indentada = false, condicionCampo, condicionValor }) {
  if (!campo || !String(campo).trim()) return { data: null, error: { message: 'El campo es obligatorio' } }
  if (!texto || !String(texto).trim()) return { data: null, error: { message: 'El texto es obligatorio' } }
  if (!seccionId || !String(seccionId).trim()) return { data: null, error: { message: 'La sección es obligatoria' } }

  const { rows } = await pool.query(
    `INSERT INTO preguntas_formulario (campo, seccion_id, texto, orden, indentada, condicion_campo, condicion_valor)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING campo`,
    [
      campo.trim(), seccionId.trim(), texto.trim(), Number(orden), Boolean(indentada),
      condicionCampo ?? null, condicionValor ?? null,
    ]
  )
  if (!rows.length) return { data: null, error: { message: 'No se pudo crear la pregunta' } }

  const { rows: full } = await pool.query(
    `SELECT pf.campo, pf.texto, pf.seccion_id, sf.titulo AS seccion_titulo,
            pf.orden, pf.indentada, pf.condicion_campo, pf.condicion_valor, pf.actualizada_en
     FROM preguntas_formulario pf
     JOIN secciones_formulario sf ON sf.id = pf.seccion_id
     WHERE pf.campo = $1`,
    [rows[0].campo]
  )
  return { data: rowToPreguntaFormulario(full[0]), error: null, status: 201 }
}

async function deletePreguntaFormulario(campo) {
  if (!campo) return { data: null, error: { message: 'El campo es obligatorio' } }
  const { rowCount } = await pool.query(
    'DELETE FROM preguntas_formulario WHERE campo = $1',
    [campo]
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
    hijosMenores26, ingresosJuego, ingresosInversiones, comentarios,
  } = body

  const { rows } = await pool.query(
    `INSERT INTO declaraciones (
      nombre, apellidos, dni_nie, email, telefono,
      vivienda_alquiler, alquiler_menos_35, vivienda_propiedad, propiedad_antes_2013,
      pisos_alquilados_terceros, segunda_residencia,
      familia_numerosa, ayudas_gobierno, mayores_65_a_cargo, mayores_conviven,
      hijos_menores_26, ingresos_juego, ingresos_inversiones, comentarios
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    ) RETURNING id, estado, creado_en`,
    [
      nombre, apellidos, dniNie, email, telefono,
      viviendaAlquiler, alquilerMenos35 ?? null, viviendaPropiedad, propiedadAntes2013 ?? null,
      pisosAlquiladosTerceros, segundaResidencia,
      familiaNumerosa, ayudasGobierno, mayores65ACargo, mayoresConviven ?? null,
      hijosMenores26, ingresosJuego, ingresosInversiones, comentarios ?? null,
    ]
  )
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
    comentarios: 'comentarios',
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
// NOTE: The "secciones" table is not part of the current schema.sql but we keep
// the mock store concept alive here using preguntas_adicionales.seccion.
// For the DB profile we store secciones in a simple table that must be created.

async function listSeccionesAdmin({ activa, page = 1, limit = 10 }) {
  const conditions = []
  const params = []
  if (activa !== undefined) { conditions.push(`activa = $${params.length + 1}`); params.push(activa) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRes = await pool.query(`SELECT COUNT(*) FROM secciones ${where}`, params)
  const total = parseInt(countRes.rows[0].count, 10)
  const offset = (page - 1) * limit
  params.push(limit, offset)
  const { rows } = await pool.query(
    `SELECT * FROM secciones ${where} ORDER BY orden ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { data: { data: rows.map(rowToSeccion), total, page, limit }, error: null }
}

async function createSeccionAdmin(body) {
  if (!body.nombre || !body.nombre.trim()) {
    return { data: null, error: { message: 'El nombre es obligatorio' }, status: 400 }
  }
  const dup = await pool.query('SELECT id FROM secciones WHERE LOWER(nombre) = LOWER($1)', [body.nombre.trim()])
  if (dup.rows.length) return { data: null, error: { message: 'Ya existe una sección con ese nombre' }, status: 409 }
  const countRes = await pool.query('SELECT COUNT(*) FROM secciones')
  const orden = body.orden ?? (parseInt(countRes.rows[0].count, 10) + 1)
  const { rows } = await pool.query(
    'INSERT INTO secciones (nombre, orden, activa) VALUES ($1, $2, $3) RETURNING *',
    [body.nombre.trim(), orden, body.activa !== undefined ? body.activa : true]
  )
  return { data: rowToSeccion(rows[0]), error: null, status: 201 }
}

async function updateSeccionAdmin(id, body) {
  if (body.nombre !== undefined) {
    const dup = await pool.query(
      'SELECT id FROM secciones WHERE LOWER(nombre) = LOWER($1) AND id != $2',
      [body.nombre.trim(), id]
    )
    if (dup.rows.length) return { data: null, error: { message: 'Ya existe una sección con ese nombre' } }
  }
  const FIELD_MAP = { nombre: 'nombre', orden: 'orden', activa: 'activa' }
  const setClauses = []
  const params = []
  for (const [camel, snake] of Object.entries(FIELD_MAP)) {
    if (body[camel] !== undefined) {
      params.push(camel === 'nombre' ? body.nombre.trim() : body[camel])
      setClauses.push(`${snake} = $${params.length}`)
    }
  }
  if (!setClauses.length) return getSeccionById(id)
  params.push(id)
  const { rows } = await pool.query(
    `UPDATE secciones SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  )
  if (!rows.length) return { data: null, error: { message: 'Sección no encontrada' } }
  return { data: rowToSeccion(rows[0]), error: null }
}

async function getSeccionById(id) {
  const { rows } = await pool.query('SELECT * FROM secciones WHERE id = $1', [id])
  if (!rows.length) return { data: null, error: { message: 'Sección no encontrada' } }
  return { data: rowToSeccion(rows[0]), error: null }
}

async function deleteSeccionAdmin(id) {
  const sec = await getSeccionById(id)
  if (sec.error) return sec
  const enUso = await pool.query(
    'SELECT COUNT(*) FROM preguntas_adicionales WHERE seccion = $1',
    [sec.data.nombre]
  )
  if (parseInt(enUso.rows[0].count, 10) > 0) {
    return { data: null, error: { message: 'No se puede eliminar: hay preguntas asignadas a esta sección' } }
  }
  await pool.query('DELETE FROM secciones WHERE id = $1', [id])
  return { data: { success: true }, error: null }
}

async function getSeccionDeclaraciones(id) {
  const sec = await getSeccionById(id)
  if (sec.error) return sec
  const { rows } = await pool.query(
    `SELECT DISTINCT d.id, d.dni_nie, d.nombre || ' ' || d.apellidos AS nombre_completo
     FROM declaraciones d
     JOIN declaracion_pregunta dp ON dp.declaracion_id = d.id
     JOIN preguntas_adicionales pa ON pa.id = dp.pregunta_id
     WHERE pa.seccion = $1`,
    [sec.data.nombre]
  )
  const data = rows.map((r) => ({ id: r.id, dniNie: r.dni_nie, nombre: r.nombre_completo }))
  return { data: { data, total: data.length }, error: null }
}

async function getSeccionPreguntas(id) {
  const sec = await getSeccionById(id)
  if (sec.error) return sec
  const { rows } = await pool.query(
    'SELECT * FROM preguntas_adicionales WHERE seccion = $1',
    [sec.data.nombre]
  )
  return { data: { data: rows.map(rowToPregunta), total: rows.length }, error: null }
}

// ── Admin: Preguntas adicionales ──────────────────────────────────────────

async function listPreguntasAdmin({ activa, page = 1, limit = 10 } = {}) {
  const conditions = []
  const params = []
  if (activa !== undefined) { conditions.push(`activa = $${params.length + 1}`); params.push(activa) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRes = await pool.query(`SELECT COUNT(*) FROM preguntas_adicionales ${where}`, params)
  const total = parseInt(countRes.rows[0].count, 10)
  const offset = (page - 1) * limit
  params.push(limit, offset)
  const { rows } = await pool.query(
    `SELECT * FROM preguntas_adicionales ${where} ORDER BY seccion, orden LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { data: { data: rows.map(rowToPregunta), total, page, limit }, error: null }
}

async function createPreguntaAdmin(body) {
  if (!body.texto?.trim() || !body.seccion?.trim() || !body.tipoRespuesta) {
    return { data: null, error: { message: 'texto, seccion y tipoRespuesta son obligatorios' }, status: 400 }
  }
  const { rows } = await pool.query(
    `INSERT INTO preguntas_adicionales (texto, seccion, tipo_respuesta, orden, activa, obligatoria)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      body.texto.trim(),
      body.seccion.trim(),
      body.tipoRespuesta,
      body.orden ?? 0,
      body.activa !== undefined ? body.activa : true,
      body.obligatoria !== undefined ? body.obligatoria : false,
    ]
  )
  return { data: rowToPregunta(rows[0]), error: null, status: 201 }
}

async function updatePreguntaAdmin(id, body) {
  const FIELD_MAP = {
    texto: 'texto',
    seccion: 'seccion',
    tipoRespuesta: 'tipo_respuesta',
    orden: 'orden',
    activa: 'activa',
    obligatoria: 'obligatoria',
  }
  const sets = []
  const params = []
  for (const [camel, snake] of Object.entries(FIELD_MAP)) {
    if (body[camel] !== undefined) {
      params.push(body[camel])
      sets.push(`${snake} = $${params.length}`)
    }
  }
  if (!sets.length) {
    const { rows } = await pool.query('SELECT * FROM preguntas_adicionales WHERE id = $1', [id])
    if (!rows.length) return { data: null, error: { message: 'Pregunta no encontrada' } }
    return { data: rowToPregunta(rows[0]), error: null }
  }
  sets.push('actualizada_en = NOW()')
  params.push(id)
  const { rows } = await pool.query(
    `UPDATE preguntas_adicionales SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  )
  if (!rows.length) return { data: null, error: { message: 'Pregunta no encontrada' } }
  return { data: rowToPregunta(rows[0]), error: null }
}

async function deletePreguntaAdmin(id) {
  const { rowCount } = await pool.query('DELETE FROM preguntas_adicionales WHERE id = $1', [id])
  if (!rowCount) return { data: null, error: { message: 'Pregunta no encontrada' } }
  return { data: { success: true }, error: null }
}

// ── Declaración ↔ Preguntas adicionales ──────────────────────────────────

async function getDeclaracionPreguntas(declaracionId) {
  const dec = await pool.query('SELECT id FROM declaraciones WHERE id = $1', [declaracionId])
  if (!dec.rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }
  const { rows } = await pool.query(
    `SELECT dp.id, dp.declaracion_id, dp.pregunta_id, dp.respuesta, dp.asignada_en, dp.respondida_en,
            pa.id as pa_id, pa.texto, pa.seccion, pa.tipo_respuesta, pa.orden, pa.activa, pa.obligatoria
     FROM declaracion_pregunta dp
     JOIN preguntas_adicionales pa ON pa.id = dp.pregunta_id
     WHERE dp.declaracion_id = $1
     ORDER BY pa.seccion, pa.orden`,
    [declaracionId]
  )
  const data = rows.map(r => ({
    id: r.id,
    declaracionId: r.declaracion_id,
    preguntaId: r.pregunta_id,
    respuesta: r.respuesta,
    asignadaEn: r.asignada_en,
    respondidaEn: r.respondida_en,
    pregunta: {
      id: r.pa_id,
      texto: r.texto,
      seccion: r.seccion,
      tipoRespuesta: r.tipo_respuesta,
      orden: r.orden,
      activa: r.activa,
      obligatoria: r.obligatoria,
    },
  }))
  return { data: { data, total: data.length }, error: null }
}

async function upsertDeclaracionPreguntas(declaracionId, asignaciones) {
  const dec = await pool.query('SELECT id FROM declaraciones WHERE id = $1', [declaracionId])
  if (!dec.rows.length) return { data: null, error: { message: 'Declaración no encontrada' } }

  // Validate all preguntaIds in a single query to avoid N+1
  const preguntaIds = asignaciones.map(a => a.preguntaId)
  if (preguntaIds.length > 0) {
    const { rows: found } = await pool.query(
      'SELECT id FROM preguntas_adicionales WHERE id = ANY($1)',
      [preguntaIds]
    )
    const foundSet = new Set(found.map(r => r.id))
    const missing = preguntaIds.find(id => !foundSet.has(id))
    if (missing) return { data: null, error: { message: `Pregunta ${missing} no encontrada` } }
  }

  for (const a of asignaciones) {
    await pool.query(
      `INSERT INTO declaracion_pregunta (declaracion_id, pregunta_id, respuesta, respondida_en)
       VALUES ($1, $2, $3, CASE WHEN $3 IS NOT NULL THEN NOW() ELSE NULL END)
       ON CONFLICT (declaracion_id, pregunta_id) DO UPDATE SET
         respuesta = EXCLUDED.respuesta,
         respondida_en = CASE
           WHEN EXCLUDED.respuesta IS NOT NULL THEN NOW()
           ELSE declaracion_pregunta.respondida_en
         END`,
      [declaracionId, a.preguntaId, a.respuesta ?? null]
    )
  }

  return getDeclaracionPreguntas(declaracionId)
}

async function removeDeclaracionPregunta(declaracionId, preguntaId) {
  const { rowCount } = await pool.query(
    'DELETE FROM declaracion_pregunta WHERE declaracion_id = $1 AND pregunta_id = $2',
    [declaracionId, preguntaId]
  )
  if (!rowCount) return { data: null, error: { message: 'Asignación no encontrada' } }
  return { data: { success: true }, error: null }
}

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

async function setUserSecciones(dniNie, seccionIds) {
  const check = await pool.query('SELECT dni_nie FROM usuarios WHERE dni_nie = $1', [dniNie])
  if (!check.rows.length) return { data: null, error: { message: 'Usuario no encontrado' } }
  await pool.query('UPDATE usuarios SET secciones_asignadas = $1 WHERE dni_nie = $2', [JSON.stringify(seccionIds), dniNie])
  return { data: { success: true }, error: null }
}

// ── Admin: Idiomas ─────────────────────────────────────────────────────────

async function listIdiomasAdmin({ activo, page = 1, limit = 10 }) {
  const conditions = []
  const params = []
  if (activo !== undefined && activo !== '') {
    const flag = activo === true || activo === 'true'
    conditions.push(`activo = $${params.length + 1}`)
    params.push(flag)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRes = await pool.query(`SELECT COUNT(*) FROM idiomas ${where}`, params)
  const total = parseInt(countRes.rows[0].count, 10)
  const offset = (page - 1) * limit
  params.push(limit, offset)
  const { rows } = await pool.query(
    `SELECT * FROM idiomas ${where} ORDER BY creado_en ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { data: { data: rows.map(rowToIdioma), total, page, limit }, error: null }
}

async function createIdiomaAdmin(body) {
  const { code, label } = body
  if (!code?.trim() || !label?.trim()) {
    return { data: null, error: { message: 'El código y la etiqueta son obligatorios' } }
  }
  const dup = await pool.query('SELECT id FROM idiomas WHERE code = $1', [code.trim()])
  if (dup.rows.length) return { data: null, error: { message: `Ya existe un idioma con el código "${code}"` } }
  const { rows } = await pool.query(
    'INSERT INTO idiomas (code, label, activo) VALUES ($1, $2, $3) RETURNING *',
    [code.trim(), label.trim(), body.activo !== false]
  )
  return { data: rowToIdioma(rows[0]), error: null }
}

async function updateIdiomaAdmin(id, body) {
  const FIELD_MAP = { label: 'label', activo: 'activo' }
  const setClauses = []
  const params = []
  for (const [camel, snake] of Object.entries(FIELD_MAP)) {
    if (body[camel] !== undefined) {
      params.push(camel === 'label' ? body.label.trim() : body[camel])
      setClauses.push(`${snake} = $${params.length}`)
    }
  }
  if (!setClauses.length) {
    const { rows } = await pool.query('SELECT * FROM idiomas WHERE id = $1', [id])
    if (!rows.length) return { data: null, error: { message: 'Idioma no encontrado' } }
    return { data: rowToIdioma(rows[0]), error: null }
  }
  params.push(id)
  const { rows } = await pool.query(
    `UPDATE idiomas SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  )
  if (!rows.length) return { data: null, error: { message: 'Idioma no encontrado' } }
  return { data: rowToIdioma(rows[0]), error: null }
}

async function deleteIdiomaAdmin(id) {
  const { rows } = await pool.query('SELECT code FROM idiomas WHERE id = $1', [id])
  if (!rows.length) return { data: null, error: { message: 'Idioma no encontrado' } }
  if (rows[0].code === 'es') {
    return { data: null, error: { message: 'No se puede eliminar el idioma por defecto (es)' } }
  }
  await pool.query('DELETE FROM idiomas WHERE id = $1', [id])
  return { data: { success: true }, error: null }
}

async function getIdiomaContent(id) {
  const { rows } = await pool.query('SELECT * FROM idiomas WHERE id = $1', [id])
  if (!rows.length) return { data: null, error: { message: 'Idioma no encontrado' } }
  const idioma = rows[0]
  const { rows: tRows } = await pool.query(
    'SELECT clave, valor FROM traducciones WHERE code = $1',
    [idioma.code]
  )
  const content = Object.fromEntries(tRows.map((r) => [r.clave, r.valor]))
  return { data: { code: idioma.code, content }, error: null }
}

async function updateIdiomaContent(id, body) {
  const { rows } = await pool.query('SELECT code FROM idiomas WHERE id = $1', [id])
  if (!rows.length) return { data: null, error: { message: 'Idioma no encontrado' } }
  const { code } = rows[0]
  const entries = Object.entries(body.content ?? {})
  for (const [clave, valor] of entries) {
    await pool.query(
      `INSERT INTO traducciones (code, clave, valor) VALUES ($1, $2, $3)
       ON CONFLICT (code, clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [code, clave, valor]
    )
  }
  const { rows: tRows } = await pool.query(
    'SELECT clave, valor FROM traducciones WHERE code = $1',
    [code]
  )
  const content = Object.fromEntries(tRows.map((r) => [r.clave, r.valor]))
  return { data: { code, content }, error: null }
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
  listSeccionesFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
  listPreguntasAdmin,
  createPreguntaAdmin,
  updatePreguntaAdmin,
  deletePreguntaAdmin,
  getDeclaracionPreguntas,
  upsertDeclaracionPreguntas,
  removeDeclaracionPregunta,
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
}
