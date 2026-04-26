'use strict'

const { Pool } = require('pg')
const config = require('../config')

// When DATABASE_URL is set (Heroku, Neon, Render, Railway, Fly.io, Supabase, etc.)
// use it as a connection string.  Most managed cloud databases use certificates
// signed by their own CA that the pg client may not trust, so rejectUnauthorized
// defaults to false whenever DATABASE_URL is present.
// Override explicitly with PG_SSL_REJECT_UNAUTHORIZED=true|false.
let sslRejectUnauthorized
if (process.env.PG_SSL_REJECT_UNAUTHORIZED != null && process.env.PG_SSL_REJECT_UNAUTHORIZED !== '') {
  sslRejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'
} else {
  // When DATABASE_URL is provided we are connecting to a cloud/managed database.
  // All major providers (Heroku, Neon, Supabase, Render, Railway, Fly.io …) use
  // certificates that would be rejected by the default pg SSL verification, so
  // we disable strict cert checking and rely on the encrypted transport instead.
  sslRejectUnauthorized = false
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
