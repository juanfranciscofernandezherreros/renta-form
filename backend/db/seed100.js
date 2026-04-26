'use strict'

// ---------------------------------------------------------------------------
// seed100.js – Seeds 14 preguntas, 100 usuarios, and 100 declaraciones.
// Idempotent: uses ON CONFLICT clauses so it can be run multiple times.
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('./pool')
const PREGUNTAS_14 = require('../data/preguntas')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the DNI-NIE letter cycle (A-Z) for index 0-based */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function dniLetter(i) {
  return LETTERS[i % 26]
}

/** Builds a valid DNI-NIE string: 0NNNNNNNL (matches ^[0-9XYZ][0-9]{7}[A-Z]$) */
function makeDni(prefix, n) {
  const digits = String(n).padStart(7, '0')
  const letter = dniLetter(n - 1)
  return `${prefix}${digits}${letter}`
}

// ---------------------------------------------------------------------------
// 100 Usuarios
// ---------------------------------------------------------------------------

const NOMBRES = ['Alejandro', 'María', 'Carlos', 'Laura', 'Miguel', 'Sofía', 'Javier', 'Lucía', 'Daniel', 'Ana']
const APELLIDOS_A = ['García', 'Martínez', 'López', 'Sánchez', 'González', 'Pérez', 'Rodríguez', 'Fernández', 'Torres', 'Ramírez']
const APELLIDOS_B = ['Mora', 'Ruiz', 'Jiménez', 'Herrera', 'Díaz', 'Vega', 'Castro', 'Romero', 'Navarro', 'Blanco']

function buildUsuarios() {
  const list = []
  for (let i = 1; i <= 100; i++) {
    const nombre = NOMBRES[(i - 1) % NOMBRES.length]
    const apellido1 = APELLIDOS_A[(i - 1) % APELLIDOS_A.length]
    const apellido2 = APELLIDOS_B[(i - 1) % APELLIDOS_B.length]
    const dni = makeDni('1', i) // e.g. 10000001A .. 10000100Z
    list.push({
      dni_nie: dni,
      nombre,
      apellidos: `${apellido1} ${apellido2}`,
      email: `usuario${String(i).padStart(3, '0')}@rentaform.test`,
      telefono: `6${String(600000000 + i).slice(1)}`,
      role: 'user',
      password: 'Password123!',
    })
  }
  return list
}

// ---------------------------------------------------------------------------
// 100 Declaraciones
// ---------------------------------------------------------------------------

const ESTADOS = ['recibido', 'en_revision', 'documentacion_pendiente', 'completado', 'archivado']
const YN = ['si', 'no']

function yn(i, offset = 0) {
  return YN[(i + offset) % 2]
}

function buildDeclaraciones() {
  const list = []
  for (let i = 1; i <= 100; i++) {
    const nombre = NOMBRES[(i - 1) % NOMBRES.length]
    const apellido1 = APELLIDOS_A[(i - 1) % APELLIDOS_A.length]
    const apellido2 = APELLIDOS_B[(i - 1) % APELLIDOS_B.length]
    const dni = makeDni('2', i) // Different prefix from usuarios to keep DNIs unique
    const estado = ESTADOS[(i - 1) % ESTADOS.length]
    list.push({
      nombre,
      apellidos: `${apellido1} ${apellido2}`,
      dni_nie: dni,
      email: `decl${String(i).padStart(3, '0')}@rentaform.test`,
      telefono: `7${String(700000000 + i).slice(1)}`,
      estado,
      vivienda_alquiler:           yn(i, 0),
      alquiler_menos_35:           yn(i, 1),
      vivienda_propiedad:          yn(i, 1),
      propiedad_antes_2013:        yn(i, 0),
      pisos_alquilados_terceros:   yn(i, 1),
      segunda_residencia:          yn(i, 0),
      familia_numerosa:            yn(i, 1),
      ayudas_gobierno:             yn(i, 0),
      mayores_65_a_cargo:          yn(i, 1),
      mayores_conviven:            yn(i, 0),
      hijos_menores_26:            yn(i, 1),
      hijos_conviven:              yn(i, 0),
      ingresos_juego:              yn(i, 0),
      ingresos_inversiones:        yn(i, 1),
    })
  }
  return list
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed100(client) {
  const useLocalClient = !client
  if (useLocalClient) {
    client = await pool.connect()
  }

  try {
    // ── 1. Seed 14 preguntas ────────────────────────────────────────────────
    console.log('[seed100] Seeding 14 preguntas...')
    for (const p of PREGUNTAS_14) {
      await client.query(
        `INSERT INTO preguntas (texto, orden)
         VALUES ($1::jsonb, $2)
         ON CONFLICT (orden) DO UPDATE SET texto = EXCLUDED.texto`,
        [JSON.stringify(p.texto), p.orden]
      )
    }

    // Delete any old preguntas with orden > 14 (from a previous 60-question seed)
    await client.query('DELETE FROM preguntas WHERE orden > 14')

    console.log('[seed100] 14 preguntas seeded.')

    // ── 2. Seed 100 usuarios ────────────────────────────────────────────────
    console.log('[seed100] Seeding 100 usuarios...')
    const SALT_ROUNDS = 10
    const usuarios = buildUsuarios()
    for (const u of usuarios) {
      const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS)
      await client.query(
        `INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (dni_nie) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellidos = EXCLUDED.apellidos,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono`,
        [u.dni_nie, u.nombre, u.apellidos, u.email, u.telefono, u.role, passwordHash]
      )
    }
    console.log('[seed100] 100 usuarios seeded.')

    // ── 3. Seed 100 declaraciones ───────────────────────────────────────────
    console.log('[seed100] Seeding 100 declaraciones...')
    const declaraciones = buildDeclaraciones()
    for (const d of declaraciones) {
      await client.query(
        `INSERT INTO declaraciones (
           nombre, apellidos, dni_nie, email, telefono, estado,
           vivienda_alquiler, alquiler_menos_35, vivienda_propiedad, propiedad_antes_2013,
           pisos_alquilados_terceros, segunda_residencia, familia_numerosa, ayudas_gobierno,
           mayores_65_a_cargo, mayores_conviven, hijos_menores_26, hijos_conviven,
           ingresos_juego, ingresos_inversiones
         ) VALUES (
           $1, $2, $3, $4, $5, $6::estado_expediente,
           $7::respuesta_yn, $8::respuesta_yn, $9::respuesta_yn, $10::respuesta_yn,
           $11::respuesta_yn, $12::respuesta_yn, $13::respuesta_yn, $14::respuesta_yn,
           $15::respuesta_yn, $16::respuesta_yn, $17::respuesta_yn, $18::respuesta_yn,
           $19::respuesta_yn, $20::respuesta_yn
         )
         ON CONFLICT (dni_nie) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellidos = EXCLUDED.apellidos,
           email = EXCLUDED.email,
           estado = EXCLUDED.estado`,
        [
          d.nombre, d.apellidos, d.dni_nie, d.email, d.telefono, d.estado,
          d.vivienda_alquiler, d.alquiler_menos_35, d.vivienda_propiedad, d.propiedad_antes_2013,
          d.pisos_alquilados_terceros, d.segunda_residencia, d.familia_numerosa, d.ayudas_gobierno,
          d.mayores_65_a_cargo, d.mayores_conviven, d.hijos_menores_26, d.hijos_conviven,
          d.ingresos_juego, d.ingresos_inversiones,
        ]
      )
    }
    console.log('[seed100] 100 declaraciones seeded.')
  } finally {
    if (useLocalClient) {
      client.release()
    }
  }
}

module.exports = seed100

// Allow running directly: node db/seed100.js
if (require.main === module) {
  seed100()
    .then(() => {
      console.log('[seed100] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seed100] Failed:', err)
      process.exit(1)
    })
}
