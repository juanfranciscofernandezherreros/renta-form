'use strict'

// ---------------------------------------------------------------------------
// Seed the idiomas table from the static translations map.
// This script is idempotent: it uses ON CONFLICT DO UPDATE so it can be
// run multiple times safely.
// ---------------------------------------------------------------------------

const pool = require('./pool')
const translations = require('../data/translations')

async function seedLanguages(client) {
  const useLocalClient = !client
  if (useLocalClient) {
    client = await pool.connect()
  }
  try {
    for (const [code, { label }] of Object.entries(translations)) {
      await client.query(
        `INSERT INTO idiomas (code, label, activo)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label`,
        [code, label]
      )
    }
  } finally {
    if (useLocalClient) {
      client.release()
    }
  }
}

module.exports = seedLanguages

// Allow running directly: node db/seedLanguages.js
if (require.main === module) {
  seedLanguages()
    .then(() => {
      console.log('[seed] Languages seeded successfully.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seed] Failed to seed languages:', err)
      process.exit(1)
    })
}
