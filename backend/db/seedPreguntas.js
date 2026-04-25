'use strict'

// ---------------------------------------------------------------------------
// seedPreguntas.js – Seeds only preguntas (idempotent).
// ---------------------------------------------------------------------------

const pool = require('./pool')
const preguntas = require('../data/preguntas')

async function seedPreguntas(client) {
  const useLocalClient = !client
  if (useLocalClient) {
    client = await pool.connect()
  }

  try {
    console.log('[seedPreguntas] Seeding preguntas...')
    for (const p of preguntas) {
      await client.query(
        `INSERT INTO preguntas (texto, orden)
         VALUES ($1::jsonb, $2)
         ON CONFLICT (orden) DO UPDATE SET texto = EXCLUDED.texto`,
        [JSON.stringify(p.texto), p.orden]
      )
    }
    console.log(`[seedPreguntas] ${preguntas.length} preguntas seeded.`)
  } finally {
    if (useLocalClient) {
      client.release()
    }
  }
}

module.exports = seedPreguntas

// Allow running directly: node db/seedPreguntas.js
if (require.main === module) {
  seedPreguntas()
    .then(() => {
      console.log('[seedPreguntas] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seedPreguntas] Failed:', err)
      process.exit(1)
    })
}
