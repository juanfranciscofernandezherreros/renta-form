'use strict'

const { Pool } = require('pg')
const config = require('../config')

// When DATABASE_URL is set (Heroku, Neon, etc.) use it as a connection string.
// Heroku Postgres uses self-signed certificates, so certificate validation must
// be disabled there.  The DYNO env var is set on every Heroku dyno; when it is
// present we default rejectUnauthorized to false.  Override explicitly with
// PG_SSL_REJECT_UNAUTHORIZED=true|false.
let sslRejectUnauthorized
if (process.env.PG_SSL_REJECT_UNAUTHORIZED != null && process.env.PG_SSL_REJECT_UNAUTHORIZED !== '') {
  sslRejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'
} else {
  // false on Heroku (DYNO is set), true everywhere else
  sslRejectUnauthorized = !process.env.DYNO
}

const poolConfig = config.pg.connectionString
  ? {
      connectionString: config.pg.connectionString,
      ssl: { rejectUnauthorized: sslRejectUnauthorized },
    }
  : {
      host: config.pg.host,
      port: config.pg.port,
      database: config.pg.database,
      user: config.pg.user,
      password: config.pg.password,
    }

const pool = new Pool(poolConfig)

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

module.exports = pool
