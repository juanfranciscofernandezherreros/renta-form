'use strict'

require('dotenv').config()

const VALID_PROFILES = ['mock', 'db']

const PROFILE = (process.env.PROFILE || 'mock').toLowerCase()

if (!VALID_PROFILES.includes(PROFILE)) {
  console.error(`[config] Unknown PROFILE "${PROFILE}". Valid values: ${VALID_PROFILES.join(', ')}`)
  process.exit(1)
}

module.exports = {
  PROFILE,
  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
  isMock: PROFILE === 'mock',
  isDb: PROFILE === 'db',

  // PostgreSQL (only relevant when PROFILE=db)
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'renta_form',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  },

  // Admin password (mock profile only)
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin',
}
