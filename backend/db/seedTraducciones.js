'use strict'

// ---------------------------------------------------------------------------
//  Seeds the `traducciones` table from the static translations.js data.
//  Idempotent – uses ON CONFLICT DO NOTHING.
// ---------------------------------------------------------------------------

const pool = require('./pool')
const translations = require('../data/translations')

async function seedTraducciones() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const [langCode, entries] of Object.entries(translations)) {
      // Get the idioma UUID for this code
      const { rows } = await client.query(
        'SELECT id FROM idiomas WHERE code = $1',
        [langCode]
      )
      if (!rows.length) {
        console.warn(`[seed] Idioma '${langCode}' not found in idiomas table, skipping.`)
        continue
      }
      const idiomaId = rows[0].id

      // Bulk-insert all translation keys
      const keys = Object.entries(entries)
      if (!keys.length) continue

      const values = []
      const placeholders = []
      let idx = 1
      for (const [clave, valor] of keys) {
        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`)
        values.push(idiomaId, clave, valor)
        idx += 3
      }

      await client.query(
        `INSERT INTO traducciones (idioma_id, clave, valor)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (idioma_id, clave) DO NOTHING`,
        values
      )
      console.log(`[seed] ${langCode}: ${keys.length} translation keys seeded.`)
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = seedTraducciones

// Allow running directly: node db/seedTraducciones.js
if (require.main === module) {
  seedTraducciones()
    .then(() => {
      console.log('[seed] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seed] Failed:', err)
      process.exit(1)
    })
}
