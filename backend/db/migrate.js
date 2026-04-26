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

    // Ensure preguntas has the campo column (replaces the legacy orden column)
    await client.query(`ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS campo VARCHAR(100)`)

    // Backfill campo for legacy rows that still rely on the `orden` column
    // before we drop it.  This mapping mirrors the canonical 14-question
    // catalogue so that pre-existing rows keep their identity.
    const ordenExists = await client.query(`
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'preguntas'
         AND column_name = 'orden'
    `)
    if (ordenExists.rowCount) {
      const ORDEN_TO_CAMPO = {
        1:  'viviendaAlquiler',
        2:  'alquilerMenos35',
        3:  'viviendaPropiedad',
        4:  'propiedadAntes2013',
        5:  'pisosAlquiladosTerceros',
        6:  'segundaResidencia',
        7:  'ayudasGobierno',
        8:  'familiaNumerosa',
        9:  'mayores65ACargo',
        10: 'mayoresConviven',
        11: 'hijosMenores26',
        12: 'hijosConviven',
        13: 'ingresosJuego',
        14: 'ingresosInversiones',
      }
      for (const [orden, campo] of Object.entries(ORDEN_TO_CAMPO)) {
        await client.query(
          `UPDATE preguntas SET campo = $1 WHERE campo IS NULL AND orden = $2`,
          [campo, Number(orden)]
        )
      }
    }
    // Any remaining rows without a campo are orphans from legacy schemas
    // (they have no mapping to the canonical 14-question catalogue) and
    // would otherwise pollute the admin/preguntas list.  Drop them.
    await client.query(
      `DELETE FROM preguntas WHERE campo IS NULL`
    )

    // Drop the legacy orden column and its unique constraint if they still exist
    await client.query(`ALTER TABLE preguntas DROP CONSTRAINT IF EXISTS uq_preguntas_orden`)
    await client.query(`ALTER TABLE preguntas DROP COLUMN IF EXISTS orden`)

    // Enforce NOT NULL now that all rows have a value
    await client.query(`ALTER TABLE preguntas ALTER COLUMN campo SET NOT NULL`)

    // Ensure campo is unique so seeding can use ON CONFLICT (campo)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_preguntas_campo'
            AND conrelid = 'preguntas'::regclass
        ) THEN
          ALTER TABLE preguntas ADD CONSTRAINT uq_preguntas_campo UNIQUE (campo);
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

    // Add columns that may be missing from older declaraciones schemas
    await client.query(`
      ALTER TABLE declaraciones
        ADD COLUMN IF NOT EXISTS mayores_conviven     respuesta_yn,
        ADD COLUMN IF NOT EXISTS hijos_conviven       respuesta_yn,
        ADD COLUMN IF NOT EXISTS ingresos_inversiones respuesta_yn
    `)
    // Backfill NOT NULL default for ingresos_inversiones if rows already exist
    await client.query(`
      UPDATE declaraciones SET ingresos_inversiones = 'no' WHERE ingresos_inversiones IS NULL
    `)
    await client.query(`
      ALTER TABLE declaraciones
        ALTER COLUMN ingresos_inversiones SET NOT NULL
    `)

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
