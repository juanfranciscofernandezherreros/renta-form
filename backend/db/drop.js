'use strict'

// ---------------------------------------------------------------------------
// drop.js – Borra todas las tablas, tipos y funciones que crea
// database/init.sql, dejando la base lista para `npm run migrate`.
//
// Uso:
//   node db/drop.js          # ejecuta database/drop.sql
//   npm run db:drop          # alias
//   npm run db:reset         # drop + setup-all
// ---------------------------------------------------------------------------

const fs = require('fs')
const path = require('path')
const pool = require('./pool')

const DROP_SQL = path.join(__dirname, '../../database/drop.sql')

async function drop() {
  const client = await pool.connect()
  try {
    console.log('[drop] Running database/drop.sql ...')
    await client.query(fs.readFileSync(DROP_SQL, 'utf8'))
    console.log('[drop] All tables/types/functions dropped.')
  } finally {
    client.release()
  }
}

if (require.main === module) {
  drop()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[drop] Failed:', err.message)
      pool.end().finally(() => process.exit(1))
    })
}

module.exports = drop
