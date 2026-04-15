'use strict'

const fs = require('fs')
const path = require('path')
const pool = require('./pool')

const INIT_SQL = path.join(__dirname, '../../database/init.sql')
const IDIOMAS_SQL = path.join(__dirname, '../../database/002_idiomas_traducciones.sql')
const SECCIONES_SQL = path.join(__dirname, '../../database/003_preguntas_secciones.sql')

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

async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     )`,
    [tableName, columnName]
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

    // Run secciones migration if preguntas.seccion column is missing
    if (!(await columnExists(client, 'preguntas', 'seccion'))) {
      console.log('[migrate] Running 003_preguntas_secciones.sql ...')
      await client.query(fs.readFileSync(SECCIONES_SQL, 'utf8'))
      console.log('[migrate] 003_preguntas_secciones.sql applied.')
    } else {
      console.log('[migrate] preguntas.seccion column already exists, skipping.')
    }
  } finally {
    client.release()
  }

  // Seed translations from static data (idempotent)
  try {
    const seedTraducciones = require('./seedTraducciones')
    await seedTraducciones()
  } catch (err) {
    console.error('[migrate] Failed to seed translations:', err)
  }
}

module.exports = migrate
