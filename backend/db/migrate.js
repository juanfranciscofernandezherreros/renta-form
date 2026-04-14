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

    // Run schema_formulario.sql – drop old secciones_formulario + campo-based table if present,
    // then create the simplified preguntas (UUID id, no seccion_id/campo)
    if (await tableExists(client, 'preguntas_formulario')) {
      console.log('[migrate] Renaming preguntas_formulario → preguntas ...')
      await client.query(`ALTER TABLE preguntas_formulario RENAME TO preguntas`)
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_preguntas_formulario_actualizado_en') THEN
            ALTER TRIGGER trg_preguntas_formulario_actualizado_en ON preguntas RENAME TO trg_preguntas_actualizado_en;
          END IF;
        END $$;
      `)
      console.log('[migrate] preguntas_formulario renamed to preguntas.')
    } else if (!(await tableExists(client, 'preguntas'))) {
      console.log('[migrate] Running schema_formulario.sql ...')
      await client.query(fs.readFileSync(FORMULARIO_SQL, 'utf8'))
      console.log('[migrate] schema_formulario.sql applied.')
    } else {
      console.log('[migrate] schema_formulario.sql already applied, skipping.')
    }

    // Ensure documentos table exists (may be missing if DB was created before this table was added)
    if (!(await tableExists(client, 'documentos'))) {
      console.log('[migrate] Creating documentos table ...')
      // Ensure tipo_documento enum exists first
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
            CREATE TYPE tipo_documento AS ENUM ('dni_anverso', 'dni_reverso', 'adicional');
          END IF;
        END $$;
      `)
      await client.query(`
        CREATE TABLE IF NOT EXISTS documentos (
          id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
          declaracion_id      UUID            NOT NULL
                                  REFERENCES declaraciones (id)
                                  ON DELETE CASCADE,
          tipo                tipo_documento  NOT NULL,
          nombre_original     VARCHAR(255)    NOT NULL,
          mime_type           VARCHAR(100)    NOT NULL,
          tamanyo_bytes       BIGINT          NOT NULL CHECK (tamanyo_bytes > 0),
          url                 TEXT,
          contenido           BYTEA,
          subido_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_doc_storage CHECK (url IS NOT NULL OR contenido IS NOT NULL)
        );
        CREATE INDEX IF NOT EXISTS idx_documentos_declaracion ON documentos (declaracion_id);
        CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos (tipo);
      `)
      console.log('[migrate] documentos table created.')
    }

    // Ensure tipo_respuesta enum has all required values (may be missing if DB predates this feature)
    // Each value is validated against the hardcoded safe list before being used in ALTER TYPE
    const TIPO_RESPUESTA_VALUES = ['yn', 'texto', 'numero', 'fecha', 'importe', 'porcentaje', 'multilinea']
    const SAFE_ENUM_PATTERN = /^[a-z]+$/
    for (const val of TIPO_RESPUESTA_VALUES) {
      if (!SAFE_ENUM_PATTERN.test(val)) continue // guard: only lowercase letters
      const { rows: enumRows } = await client.query(
        `SELECT 1 FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'tipo_respuesta' AND e.enumlabel = $1`,
        [val]
      )
      if (!enumRows.length) {
        // ALTER TYPE ADD VALUE cannot use parameterized queries in PostgreSQL,
        // but val is validated against a strict pattern above
        await client.query(`ALTER TYPE tipo_respuesta ADD VALUE IF NOT EXISTS '${val}'`)
      }
    }

    // Ensure preguntas_adicionales table exists (may be missing if DB was created before this feature)
    if (!(await tableExists(client, 'preguntas_adicionales'))) {
      console.log('[migrate] Creating preguntas_adicionales table ...')
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_respuesta') THEN
            CREATE TYPE tipo_respuesta AS ENUM ('yn', 'texto', 'numero', 'fecha', 'importe', 'porcentaje', 'multilinea');
          END IF;
        END $$;
        CREATE TABLE IF NOT EXISTS preguntas_adicionales (
          id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
          texto           TEXT            NOT NULL,
          seccion         VARCHAR(100)    NOT NULL DEFAULT 'General',
          tipo_respuesta  tipo_respuesta  NOT NULL DEFAULT 'yn',
          orden           INTEGER         NOT NULL DEFAULT 0,
          activa          BOOLEAN         NOT NULL DEFAULT TRUE,
          obligatoria     BOOLEAN         NOT NULL DEFAULT FALSE,
          creada_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_preguntas_adicionales_activa ON preguntas_adicionales (activa);
      `)
      console.log('[migrate] preguntas_adicionales table created.')
    }

    // Ensure declaracion_pregunta table exists (may be missing if DB was created before this feature)
    if (!(await tableExists(client, 'declaracion_pregunta'))) {
      console.log('[migrate] Creating declaracion_pregunta table ...')
      await client.query(`
        CREATE TABLE IF NOT EXISTS declaracion_pregunta (
          id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
          declaracion_id  UUID            NOT NULL
                              REFERENCES declaraciones (id)
                              ON DELETE CASCADE,
          pregunta_id     UUID            NOT NULL
                              REFERENCES preguntas_adicionales (id)
                              ON DELETE CASCADE,
          respuesta       TEXT,
          asignada_en     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          respondida_en   TIMESTAMPTZ,
          CONSTRAINT uq_declaracion_pregunta UNIQUE (declaracion_id, pregunta_id)
        );
        CREATE INDEX IF NOT EXISTS idx_decpregunta_declaracion ON declaracion_pregunta (declaracion_id);
        CREATE INDEX IF NOT EXISTS idx_decpregunta_pregunta ON declaracion_pregunta (pregunta_id);
      `)
      console.log('[migrate] declaracion_pregunta table created.')
    }

    // Ensure unique constraint on declaraciones.dni_nie exists (may be missing in older DBs)
    const { rows: uqRows } = await client.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'declaraciones'::regclass
         AND conname = 'uq_declaraciones_dni_nie'`
    )
    if (!uqRows.length) {
      console.log('[migrate] Adding unique constraint on declaraciones.dni_nie ...')
      await client.query(
        'ALTER TABLE declaraciones ADD CONSTRAINT uq_declaraciones_dni_nie UNIQUE (dni_nie)'
      )
      console.log('[migrate] uq_declaraciones_dni_nie constraint added.')
    }

    // Seed translations if the table is empty
    const { rows: tCount } = await client.query('SELECT COUNT(*) FROM traducciones')
    if (parseInt(tCount[0].count, 10) === 0) {
      console.log('[migrate] Seeding traducciones ...')
      const rows = []
      const params = []
      let idx = 1
      for (const [code, keys] of Object.entries(staticTranslations)) {
        for (const [clave, valor] of Object.entries(keys)) {
          rows.push(`($${idx}, $${idx + 1}, $${idx + 2})`)
          params.push(code, clave, String(valor))
          idx += 3
        }
      }
      await client.query(
        `INSERT INTO traducciones (code, clave, valor) VALUES ${rows.join(', ')}
         ON CONFLICT (code, clave) DO NOTHING`,
        params
      )
      console.log('[migrate] traducciones seeded.')
    } else {
      console.log('[migrate] traducciones already seeded, skipping.')
    }
  } finally {
    client.release()
  }
}

module.exports = migrate
