'use strict'

require('dotenv').config()

module.exports = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  // PostgreSQL
  // DATABASE_URL takes precedence over individual PG* variables.
  // Heroku and Neon both set DATABASE_URL automatically.
  pg: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'renta_form',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  },
}
