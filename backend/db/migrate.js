'use strict'

const fs = require('fs')
const path = require('path')
const pool = require('./pool')

const INIT_SQL = path.join(__dirname, '../../database/init.sql')

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
      console.log('[migrate] Tables already exist, skipping init.sql.')
    }

    // Drop legacy section columns from preguntas if they still exist
    await client.query(`
      ALTER TABLE preguntas
        DROP COLUMN IF EXISTS seccion,
        DROP COLUMN IF EXISTS seccion_orden,
        DROP COLUMN IF EXISTS seccion_titulos
    `)

    // Create idiomas/traducciones tables if they were not in the original schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS idiomas (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        code           VARCHAR(10)  NOT NULL UNIQUE,
        label          VARCHAR(100) NOT NULL,
        activo         BOOLEAN      NOT NULL DEFAULT TRUE,
        creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS traducciones (
        id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        idioma_id UUID         NOT NULL REFERENCES idiomas(id) ON DELETE CASCADE,
        clave     VARCHAR(200) NOT NULL,
        valor     TEXT         NOT NULL DEFAULT '',
        UNIQUE (idioma_id, clave)
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_traducciones_idioma ON traducciones (idioma_id)`)
    await client.query(`
      INSERT INTO idiomas (code, label, activo) VALUES
        ('es', 'Español',  TRUE),
        ('fr', 'Français', TRUE),
        ('en', 'English',  TRUE),
        ('ca', 'Català',   TRUE)
      ON CONFLICT (code) DO NOTHING
    `)
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
