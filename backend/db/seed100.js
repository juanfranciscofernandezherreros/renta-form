'use strict'

// ---------------------------------------------------------------------------
// seed100.js – Seeds 14 preguntas, 100 usuarios, and 100 declaraciones.
// Idempotent: uses ON CONFLICT clauses so it can be run multiple times.
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('./pool')
const migrate = require('./migrate')
const seedPreguntas = require('./seedPreguntas')
const { encryptDni, hashDni } = require('../utils/dniEncryption')

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
    })
  }
  return list
}

/**
 * Builds a deterministic but varied yes/no answer for declaration `i`
 * and the question at zero-based `qIndex`.
 */
function answerFor(i, qIndex) {
  return YN[(i + qIndex) % 2]
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
    // ── 1. Seed demo preguntas via the canonical seedPreguntas helper ──────
    await seedPreguntas(client)

    // Load the seeded preguntas so we can populate respuestas_declaracion.
    const { rows: preguntasRows } = await client.query(
      `SELECT id, campo, orden FROM preguntas ORDER BY orden, campo`
    )
    console.log(`[seed100] ${preguntasRows.length} preguntas available.`)

    // ── 2. Seed 100 usuarios ────────────────────────────────────────────────
    console.log('[seed100] Seeding 100 usuarios...')
    const SALT_ROUNDS = 10
    const usuarios = buildUsuarios()
    for (const u of usuarios) {
      const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS)
      await client.query(
        `INSERT INTO usuarios (dni_nie, dni_nie_hash, nombre, apellidos, email, telefono, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (dni_nie_hash) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellidos = EXCLUDED.apellidos,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono`,
        [encryptDni(u.dni_nie), hashDni(u.dni_nie), u.nombre, u.apellidos, u.email, u.telefono, u.role, passwordHash]
      )
    }
    console.log('[seed100] 100 usuarios seeded.')

    // ── 3. Seed 100 declaraciones (only personal data) ──────────────────────
    console.log('[seed100] Seeding 100 declaraciones...')
    const declaraciones = buildDeclaraciones()
    for (let i = 0; i < declaraciones.length; i++) {
      const d = declaraciones[i]
      const { rows: insertRows } = await client.query(
        `INSERT INTO declaraciones (
           nombre, apellidos, dni_nie, dni_nie_hash, email, telefono, estado
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7::estado_expediente
         )
         ON CONFLICT (dni_nie_hash) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellidos = EXCLUDED.apellidos,
           email = EXCLUDED.email,
           estado = EXCLUDED.estado
         RETURNING id`,
        [d.nombre, d.apellidos, encryptDni(d.dni_nie), hashDni(d.dni_nie), d.email, d.telefono, d.estado]
      )
      const declId = insertRows[0].id

      // Replace respuestas for this declaration with deterministic answers
      // for every currently configured pregunta.
      await client.query(`DELETE FROM respuestas_declaracion WHERE declaracion_id = $1`, [declId])
      for (let q = 0; q < preguntasRows.length; q++) {
        await client.query(
          `INSERT INTO respuestas_declaracion (declaracion_id, pregunta_id, respuesta)
           VALUES ($1, $2, $3::respuesta_yn)`,
          [declId, preguntasRows[q].id, answerFor(i + 1, q)]
        )
      }
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
  migrate()
    .then(() => seed100())
    .then(() => {
      console.log('[seed100] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seed100] Failed:', err)
      process.exit(1)
    })
}
