'use strict'

// ---------------------------------------------------------------------------
// seedAdmin.js – Creates (or updates) the administrator user.
// Idempotent: uses ON CONFLICT so it can be run multiple times safely.
//
// Usage:
//   node backend/db/seedAdmin.js
//   # or from the backend/ directory:
//   npm run seed:admin
//
// Environment variables (same as the rest of the backend):
//   DATABASE_URL  – full connection string (Heroku / Neon)
//   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD – individual PG vars
//   ADMIN_DNI     – DNI/NIE for the admin user  (default: admin)
//   ADMIN_EMAIL   – email for the admin user     (default: admin@example.com)
//   ADMIN_PASSWORD – plain-text password          (default: admin)
// ---------------------------------------------------------------------------

const bcrypt = require('bcrypt')
const pool = require('./pool')
const migrate = require('./migrate')
const { encryptDni } = require('../utils/dniEncryption')

const SALT_ROUNDS = 10

const DNI_NIE  = (process.env.ADMIN_DNI || 'admin').toUpperCase()
const NOMBRE   = 'Admin'
const APELLIDOS = 'Sistema'
const EMAIL    = process.env.ADMIN_EMAIL    || 'admin@example.com'
const TELEFONO = ''
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

async function seedAdmin() {
  const client = await pool.connect()
  try {
    console.log('[seedAdmin] Hashing password…')
    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS)

    await client.query(
      `INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6)
       ON CONFLICT (dni_nie) DO UPDATE SET
         nombre        = EXCLUDED.nombre,
         apellidos     = EXCLUDED.apellidos,
         email         = EXCLUDED.email,
         telefono      = EXCLUDED.telefono,
         role          = 'admin',
         password_hash = EXCLUDED.password_hash`,
      [encryptDni(DNI_NIE), NOMBRE, APELLIDOS, EMAIL, TELEFONO, passwordHash]
    )

    console.log(`[seedAdmin] ✅  Usuario administrador listo: ${DNI_NIE} / ${EMAIL}`)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
  .then(() => seedAdmin())
  .catch((err) => {
    console.error('[seedAdmin] ❌  Error:', err.message)
    process.exit(1)
  })
