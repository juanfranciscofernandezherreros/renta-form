'use strict'

// ---------------------------------------------------------------------------
// seedUsuarios.js – Seeds only usuarios (idempotent, includes one admin).
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('./pool')
const migrate = require('./migrate')
const { encryptDni, hashDni } = require('../utils/dniEncryption')

const SALT_ROUNDS = 10

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

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

const NOMBRES = ['Alejandro', 'María', 'Carlos', 'Laura', 'Miguel', 'Sofía', 'Javier', 'Lucía', 'Daniel', 'Ana']
const APELLIDOS_A = ['García', 'Martínez', 'López', 'Sánchez', 'González', 'Pérez', 'Rodríguez', 'Fernández', 'Torres', 'Ramírez']
const APELLIDOS_B = ['Mora', 'Ruiz', 'Jiménez', 'Herrera', 'Díaz', 'Vega', 'Castro', 'Romero', 'Navarro', 'Blanco']

function buildUsuarios() {
  const list = []
  for (let i = 1; i <= 100; i++) {
    const nombre = NOMBRES[(i - 1) % NOMBRES.length]
    const apellido1 = APELLIDOS_A[(i - 1) % APELLIDOS_A.length]
    const apellido2 = APELLIDOS_B[(i - 1) % APELLIDOS_B.length]
    const dni = makeDni('1', i)
    list.push({
      dni_nie: dni,
      nombre,
      apellidos: `${apellido1} ${apellido2}`,
      email: `usuario${String(i).padStart(3, '0')}@rentaform.test`,
      telefono: `6${String(600000000 + i).slice(1)}`,
      role: 'user',
    })
  }
  return list
}

async function seedUsuarios(client) {
  const useLocalClient = !client
  if (useLocalClient) {
    client = await pool.connect()
  }

  try {
    console.log('[seedUsuarios] Seeding admin user...')
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS)
    const { rows: adminRows } = await client.query(
      `INSERT INTO usuarios (username, dni_nie, dni_nie_hash, nombre, apellidos, email, telefono, password_hash)
       VALUES ($1, NULL, NULL, $2, $3, $4, $5, $6)
       ON CONFLICT (username) WHERE username IS NOT NULL DO UPDATE SET
         nombre        = EXCLUDED.nombre,
         apellidos     = EXCLUDED.apellidos,
         email         = EXCLUDED.email,
         telefono      = EXCLUDED.telefono,
         password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [ADMIN_USERNAME, 'Admin', 'Sistema', ADMIN_EMAIL, '', adminHash]
    )
    await client.query(
      `INSERT INTO roles (nombre) VALUES ('admin'), ('user') ON CONFLICT (nombre) DO NOTHING`
    )
    await client.query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       SELECT $1, r.id FROM roles r WHERE r.nombre = 'admin'
       ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
      [adminRows[0].id]
    )

    console.log('[seedUsuarios] Seeding 100 usuarios...')
    const usuarios = buildUsuarios()
    // Citizens have no login, so password_hash stays NULL.
    for (const u of usuarios) {
      const { rows: userRows } = await client.query(
        `INSERT INTO usuarios (dni_nie, dni_nie_hash, nombre, apellidos, email, telefono, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         ON CONFLICT (dni_nie_hash) WHERE dni_nie_hash IS NOT NULL DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellidos = EXCLUDED.apellidos,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono
         RETURNING id`,
        [encryptDni(u.dni_nie), hashDni(u.dni_nie), u.nombre, u.apellidos, u.email, u.telefono]
      )
      await client.query(
        `INSERT INTO usuarios_roles (usuario_id, rol_id)
         SELECT $1, r.id FROM roles r WHERE r.nombre = $2
         ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
        [userRows[0].id, u.role || 'user']
      )
    }
    console.log('[seedUsuarios] Usuarios seeded.')
  } finally {
    if (useLocalClient) {
      client.release()
    }
  }
}

module.exports = seedUsuarios

// Allow running directly: node db/seedUsuarios.js
if (require.main === module) {
  migrate()
    .then(() => seedUsuarios())
    .then(() => {
      console.log('[seedUsuarios] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seedUsuarios] Failed:', err)
      process.exit(1)
    })
}
