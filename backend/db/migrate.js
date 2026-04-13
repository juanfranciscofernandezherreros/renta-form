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

    // Ensure documentos table exists (may be missing if DB was created before this table was added)
    if (!(await tableExists(client, 'documentos'))) {
      console.log('[migrate] Creating documentos table ...')
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
