'use strict'

const { Pool } = require('pg')
const config = require('../config')

const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  database: config.pg.database,
  user: config.pg.user,
  password: config.pg.password,
})

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

module.exports = pool
