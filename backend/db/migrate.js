'use strict'

const fs = require('fs')
const path = require('path')
const pool = require('./pool')

const INIT_SQL = path.join(__dirname, '../../database/init.sql')

// Mapeo histórico de columnas YN ↔ campo camelCase, usado SOLO para
// migrar bases de datos antiguas a la nueva tabla `respuestas_declaracion`.
const LEGACY_YN_COLUMNS = [
  ['vivienda_alquiler',         'viviendaAlquiler'],
  ['alquiler_menos_35',         'alquilerMenos35'],
  ['vivienda_propiedad',        'viviendaPropiedad'],
  ['propiedad_antes_2013',      'propiedadAntes2013'],
  ['pisos_alquilados_terceros', 'pisosAlquiladosTerceros'],
  ['segunda_residencia',        'segundaResidencia'],
  ['familia_numerosa',          'familiaNumerosa'],
  ['ayudas_gobierno',           'ayudasGobierno'],
  ['mayores_65_a_cargo',        'mayores65ACargo'],
  ['mayores_conviven',          'mayoresConviven'],
  ['hijos_menores_26',          'hijosMenores26'],
  ['hijos_conviven',            'hijosConviven'],
  ['ingresos_juego',            'ingresosJuego'],
  ['ingresos_inversiones',      'ingresosInversiones'],
]

async function columnExists(client, table, column) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  )
  return rowCount > 0
}

async function migrate() {
  const client = await pool.connect()
  try {
    // ── 1. Always run init.sql (idempotent CREATE IF NOT EXISTS) ───────────
    console.log('[migrate] Running init.sql ...')
    await client.query(fs.readFileSync(INIT_SQL, 'utf8'))
    console.log('[migrate] init.sql applied.')

    // ── 2. Drop legacy columns from `preguntas` if present ────────────────
    await client.query(`
      ALTER TABLE preguntas
        DROP COLUMN IF EXISTS seccion,
        DROP COLUMN IF EXISTS seccion_orden,
        DROP COLUMN IF EXISTS seccion_titulos
    `)

    // ── 3. Ensure `preguntas.campo` and `preguntas.orden` exist ───────────
    // (init.sql creates them, but legacy DBs may have only `id`/`texto`).
    if (!(await columnExists(client, 'preguntas', 'campo'))) {
      await client.query(`ALTER TABLE preguntas ADD COLUMN campo VARCHAR(100)`)
    }
    if (!(await columnExists(client, 'preguntas', 'orden'))) {
      await client.query(`ALTER TABLE preguntas ADD COLUMN orden INTEGER NOT NULL DEFAULT 0`)
    }

    // Backfill `campo` for canonical rows that still have it NULL by using
    // their UUID against the legacy hard-coded catalogue (only relevant for
    // very old dumps; new DBs have no rows yet).
    const LEGACY_ID_TO_CAMPO = {
      '13f97e52-5063-4eb2-b3f9-9a19da55f089': 'viviendaAlquiler',
      'c2079289-6e50-4941-bef4-74b99b0349a1': 'alquilerMenos35',
      'c73ad6e8-1ab5-4322-bead-3a7db2a79199': 'viviendaPropiedad',
      '396056b1-67af-4d30-8ab0-2c394c96be47': 'propiedadAntes2013',
      'efa32f52-0f2c-4c20-84b9-179d9a9da20d': 'pisosAlquiladosTerceros',
      '84181714-8c69-42e0-9f06-2105a2afa710': 'segundaResidencia',
      '5b5de695-c741-4e46-a030-9f42e534b96b': 'ayudasGobierno',
      '8900a959-6be0-4f65-a013-e25fbb922578': 'familiaNumerosa',
      'fb70e513-74d6-4a3c-ae22-9aa4021b5e0c': 'mayores65ACargo',
      'fa828bbd-41a9-42a0-833a-c7ee0080d0fe': 'mayoresConviven',
      'c0051878-24f8-43d8-a1e7-74d12c705b45': 'hijosMenores26',
      'f163ef74-3f25-4efa-bf92-aa384cfa3349': 'hijosConviven',
      '2e3c8e64-66d1-44b6-a958-3ed7f14e56f5': 'ingresosJuego',
      'd5a69bdf-b3a9-4052-85b1-764ebb6e5bdc': 'ingresosInversiones',
    }
    let i = 0
    for (const [uuid, campo] of Object.entries(LEGACY_ID_TO_CAMPO)) {
      await client.query(
        `UPDATE preguntas SET campo = $1, orden = $2 WHERE id = $3 AND campo IS NULL`,
        [campo, i + 1, uuid]
      )
      i++
    }

    // Drop any orphan rows that still have a NULL campo (cannot be exposed).
    await client.query(`DELETE FROM preguntas WHERE campo IS NULL`)

    // Finally enforce NOT NULL + UNIQUE on `campo`.
    await client.query(`ALTER TABLE preguntas ALTER COLUMN campo SET NOT NULL`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'preguntas_campo_key'
        ) THEN
          ALTER TABLE preguntas ADD CONSTRAINT preguntas_campo_key UNIQUE (campo);
        END IF;
      END $$;
    `)

    // ── 4. Migrate legacy YN columns from `declaraciones` → `respuestas_declaracion` ─
    const legacyPresent = []
    for (const [snake] of LEGACY_YN_COLUMNS) {
      if (await columnExists(client, 'declaraciones', snake)) legacyPresent.push(snake)
    }

    if (legacyPresent.length) {
      // Ensure the new respuestas table exists (init.sql already creates it,
      // but just in case the migration is being run partial).
      await client.query(`
        CREATE TABLE IF NOT EXISTS respuestas_declaracion (
          declaracion_id UUID         NOT NULL REFERENCES declaraciones(id) ON DELETE CASCADE,
          pregunta_id    UUID         NOT NULL REFERENCES preguntas(id)    ON DELETE CASCADE,
          respuesta      respuesta_yn NOT NULL,
          PRIMARY KEY (declaracion_id, pregunta_id)
        )
      `)

      // Copy each legacy YN column into respuestas_declaracion, joining
      // declaraciones with preguntas via the pregunta `campo`.
      for (const [snake, campo] of LEGACY_YN_COLUMNS) {
        if (!legacyPresent.includes(snake)) continue
        await client.query(
          `INSERT INTO respuestas_declaracion (declaracion_id, pregunta_id, respuesta)
           SELECT d.id, p.id, d."${snake}"
             FROM declaraciones d
             CROSS JOIN preguntas p
            WHERE p.campo = $1 AND d."${snake}" IS NOT NULL
           ON CONFLICT (declaracion_id, pregunta_id) DO NOTHING`,
          [campo]
        )
      }

      // Now drop the legacy columns; declaraciones keeps only personal data.
      const dropList = legacyPresent.map(c => `DROP COLUMN IF EXISTS "${c}"`).join(', ')
      await client.query(`ALTER TABLE declaraciones ${dropList}`)
    }

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
