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

    // Remove campo column (replaced by static ORDEN_TO_CAMPO mapping in code)
    await client.query(`ALTER TABLE preguntas DROP COLUMN IF EXISTS campo`)

    // Ensure orden is unique so seeding can use ON CONFLICT (orden)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_preguntas_orden'
            AND conrelid = 'preguntas'::regclass
        ) THEN
          ALTER TABLE preguntas ADD CONSTRAINT uq_preguntas_orden UNIQUE (orden);
        END IF;
      END $$
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

  } finally {
    client.release()
  }
}

module.exports = migrate

// Allow running directly: node db/migrate.js
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[migrate] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[migrate] Failed:', err)
      process.exit(1)
    })
}
