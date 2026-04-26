'use strict'

// ---------------------------------------------------------------------------
// Seed idiomas and traducciones tables from the static translations map.
// This script is idempotent: it uses ON CONFLICT DO UPDATE so it can be
// run multiple times safely.
// ---------------------------------------------------------------------------

const pool = require('./pool')
const migrate = require('./migrate')
const translations = require('../data/translations')

async function seedTraducciones(client) {
  const useLocalClient = !client
  if (useLocalClient) {
    client = await pool.connect()
  }
  try {
    for (const [code, { label, keys }] of Object.entries(translations)) {
      // Upsert the language row
      const idiomaRes = await client.query(
        `INSERT INTO idiomas (code, label, activo)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
         RETURNING id`,
        [code, label]
      )
      const idiomaId = idiomaRes.rows[0].id

      // Upsert each translation key
      for (const [clave, valor] of Object.entries(keys)) {
        await client.query(
          `INSERT INTO traducciones (idioma_id, clave, valor)
           VALUES ($1, $2, $3)
           ON CONFLICT (idioma_id, clave) DO UPDATE SET valor = EXCLUDED.valor`,
          [idiomaId, clave, valor]
        )
      }
    }
  } finally {
    if (useLocalClient) {
      client.release()
    }
  }
}

module.exports = seedTraducciones

// Allow running directly: node db/seedTraducciones.js
if (require.main === module) {
  migrate()
    .then(() => seedTraducciones())
    .then(() => {
      console.log('[seed] Translations seeded successfully.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seed] Failed to seed translations:', err)
      process.exit(1)
    })
}
