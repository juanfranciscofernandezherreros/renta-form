'use strict'

const fs = require('fs')
const path = require('path')
const pool = require('./pool')
const staticTranslations = require('../data/translations')

const SCHEMA_SQL = path.join(__dirname, '../../database/schema.sql')
const BACKEND_SQL = path.join(__dirname, '../../database/schema_backend.sql')
const FORMULARIO_SQL = path.join(__dirname, '../../database/schema_formulario.sql')

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
    // Run schema.sql only if 'declaraciones' table is not yet created
    if (!(await tableExists(client, 'declaraciones'))) {
      console.log('[migrate] Running schema.sql ...')
      await client.query(fs.readFileSync(SCHEMA_SQL, 'utf8'))
      console.log('[migrate] schema.sql applied.')
    } else {
      console.log('[migrate] schema.sql already applied, skipping.')
    }

    // Run schema_backend.sql only if 'usuarios' table is not yet created
    if (!(await tableExists(client, 'usuarios'))) {
      console.log('[migrate] Running schema_backend.sql ...')
      await client.query(fs.readFileSync(BACKEND_SQL, 'utf8'))
      console.log('[migrate] schema_backend.sql applied.')
    } else {
      console.log('[migrate] schema_backend.sql already applied, skipping.')
    }

    // Run schema_formulario.sql only if 'preguntas_formulario' table is not yet created
    if (!(await tableExists(client, 'preguntas_formulario'))) {
      console.log('[migrate] Running schema_formulario.sql ...')
      await client.query(fs.readFileSync(FORMULARIO_SQL, 'utf8'))
      console.log('[migrate] schema_formulario.sql applied.')
    } else {
      console.log('[migrate] schema_formulario.sql already applied, skipping.')
    }

    // Seed translations if the table is empty
    const { rows: tCount } = await client.query('SELECT COUNT(*) FROM traducciones')
    if (parseInt(tCount[0].count, 10) === 0) {
      console.log('[migrate] Seeding traducciones ...')
      for (const [code, keys] of Object.entries(staticTranslations)) {
        for (const [clave, valor] of Object.entries(keys)) {
          await client.query(
            `INSERT INTO traducciones (code, clave, valor) VALUES ($1, $2, $3)
             ON CONFLICT (code, clave) DO NOTHING`,
            [code, clave, String(valor)]
          )
        }
      }
      console.log('[migrate] traducciones seeded.')
    } else {
      console.log('[migrate] traducciones already seeded, skipping.')
    }
  } finally {
    client.release()
  }
}

module.exports = migrate
