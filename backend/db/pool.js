'use strict'

const { Pool } = require('pg')
const config = require('../config')

// When DATABASE_URL is set (Heroku, Neon, etc.) use it as a connection string.
// SSL is enabled for cloud-hosted databases; certificate validation is kept on
// unless PG_SSL_REJECT_UNAUTHORIZED=false is explicitly set (e.g. for local dev
// with a self-signed cert).
const sslRejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'

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
