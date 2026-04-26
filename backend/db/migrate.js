'use strict'

const fs = require('fs')
const path = require('path')
const pool = require('./pool')

const INIT_SQL = path.join(__dirname, '../../database/init.sql')

async function migrate() {
  const client = await pool.connect()
  try {
    // init.sql is fully idempotent (CREATE TABLE IF NOT EXISTS, guarded type
    // creation, CREATE OR REPLACE triggers/functions), so we always run it.
    // Skipping it based on the existence of `declaraciones` alone left DBs
    // partially migrated (e.g. missing `preguntas`/`idiomas`/`traducciones`)
    // and caused subsequent ALTER TABLE statements to fail with
    // `relation "preguntas" does not exist`.
    console.log('[migrate] Running init.sql ...')
    await client.query(fs.readFileSync(INIT_SQL, 'utf8'))
    console.log('[migrate] init.sql applied.')

    // Drop legacy section columns from preguntas if they still exist
    await client.query(`
      ALTER TABLE preguntas
        DROP COLUMN IF EXISTS seccion,
        DROP COLUMN IF EXISTS seccion_orden,
        DROP COLUMN IF EXISTS seccion_titulos
    `)

    // ──────────────────────────────────────────────────────────────────────
    // Migrate the legacy `campo` column away.  The DB no longer stores the
    // camelCase `campo` identifier; the canonical mapping campo→UUID lives
    // in backend/data/preguntas.js and is exposed by the API.  For DBs that
    // still have a `campo` column, we re-key existing rows to the canonical
    // UUIDs (so admins keep their localised text), drop any orphan rows,
    // and finally drop the column + its unique constraint.
    // ──────────────────────────────────────────────────────────────────────
    const campoExists = await client.query(`
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'preguntas'
         AND column_name = 'campo'
    `)
    if (campoExists.rowCount) {
      // First, backfill `campo` for legacy rows that still rely on the
      // even older `orden` column before we look at it.
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
        await client.query(`ALTER TABLE preguntas DROP CONSTRAINT IF EXISTS uq_preguntas_orden`)
        await client.query(`ALTER TABLE preguntas DROP COLUMN IF EXISTS orden`)
      }

      // Re-key existing rows to the canonical UUIDs from the static
      // catalogue so the UUID PK becomes the stable identity.
      const PREGUNTAS_CATALOGO = require('../data/preguntas')
      for (const p of PREGUNTAS_CATALOGO) {
        await client.query(
          `UPDATE preguntas SET id = $1 WHERE campo = $2 AND id <> $1`,
          [p.id, p.campo]
        )
      }

      // Drop any orphan rows whose campo isn't part of the canonical
      // 14-question catalogue (these would otherwise pollute the API).
      await client.query(
        `DELETE FROM preguntas
          WHERE campo IS NULL
             OR NOT (campo = ANY($1::text[]))`,
        [PREGUNTAS_CATALOGO.map(p => p.campo)]
      )

      // Finally drop the unique constraint and the column itself.
      await client.query(`ALTER TABLE preguntas DROP CONSTRAINT IF EXISTS uq_preguntas_campo`)
      await client.query(`ALTER TABLE preguntas DROP COLUMN IF EXISTS campo`)
    }

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

    // All Sí/No answer columns are now optional — drop legacy NOT NULL
    // constraints so empty responses are allowed. (DROP NOT NULL on an
    // already-nullable column is a no-op; we list every YN column for
    // consistency with init.sql.)
    await client.query(`
      ALTER TABLE declaraciones
        ALTER COLUMN vivienda_alquiler         DROP NOT NULL,
        ALTER COLUMN alquiler_menos_35         DROP NOT NULL,
        ALTER COLUMN vivienda_propiedad        DROP NOT NULL,
        ALTER COLUMN propiedad_antes_2013      DROP NOT NULL,
        ALTER COLUMN pisos_alquilados_terceros DROP NOT NULL,
        ALTER COLUMN segunda_residencia        DROP NOT NULL,
        ALTER COLUMN familia_numerosa          DROP NOT NULL,
        ALTER COLUMN ayudas_gobierno           DROP NOT NULL,
        ALTER COLUMN mayores_65_a_cargo        DROP NOT NULL,
        ALTER COLUMN mayores_conviven          DROP NOT NULL,
        ALTER COLUMN hijos_menores_26          DROP NOT NULL,
        ALTER COLUMN hijos_conviven            DROP NOT NULL,
        ALTER COLUMN ingresos_juego            DROP NOT NULL,
        ALTER COLUMN ingresos_inversiones      DROP NOT NULL
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
