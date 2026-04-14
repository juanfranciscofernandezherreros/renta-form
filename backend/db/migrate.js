'use strict'

const fs = require('fs')
const path = require('path')
const pool = require('./pool')

const INIT_SQL = path.join(__dirname, '../../database/init.sql')
const IDIOMAS_SQL = path.join(__dirname, '../../database/002_idiomas_traducciones.sql')

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     )`,
    [tableName]
  )
  return rows[0].exists
}

async function migrate() {
  const client = await pool.connect()
  try {
    // Run init.sql only if core tables are not yet created
    if (!(await tableExists(client, 'declaraciones'))) {
      console.log('[migrate] Running init.sql ...')
      await client.query(fs.readFileSync(INIT_SQL, 'utf8'))
      console.log('[migrate] init.sql applied.')
    } else {
      console.log('[migrate] init.sql already applied, skipping.')
    }

    // Run idiomas/traducciones migration if not yet created
    if (!(await tableExists(client, 'idiomas'))) {
      console.log('[migrate] Running 002_idiomas_traducciones.sql ...')
      await client.query(fs.readFileSync(IDIOMAS_SQL, 'utf8'))
      console.log('[migrate] 002_idiomas_traducciones.sql applied.')
    } else {
      console.log('[migrate] idiomas table already exists, skipping.')
    }
  } finally {
    client.release()
  }

  // Seed translations from static data (idempotent)
  const seedTraducciones = require('./seedTraducciones')
  await seedTraducciones()
}

module.exports = migrate
