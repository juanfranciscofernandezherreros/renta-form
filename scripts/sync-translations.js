#!/usr/bin/env node
/**
 * sync-translations.js
 *
 * Scans the frontend source files for t('key') calls, compares them with the
 * translation keys already defined in database/init.sql and any existing
 * migration files, then generates a new SQL migration file for any missing
 * keys so that no translation is left out of the database.
 *
 * Usage:  node scripts/sync-translations.js [--dry-run]
 *
 * Exit codes:
 *   0 – nothing to do (all keys already present)
 *   1 – unexpected error
 *   2 – new migration file created (handled by the workflow)
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT       = path.resolve(__dirname, '..')
const SRC_DIR    = path.join(ROOT, 'src')
const DB_DIR     = path.join(ROOT, 'database')
const LANGUAGES  = ['es', 'fr', 'en', 'ca']

const DRY_RUN    = process.argv.includes('--dry-run')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk a directory recursively and collect files matching an extension list.
 */
function walkDir(dir, exts) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full, exts))
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(full)
    }
  }
  return results
}

/**
 * Extract every unique translation key referenced via t('key') or t("key")
 * in the given source files.
 */
function extractKeysFromSource(files) {
  const keys = new Set()
  // Matches t('key') and t("key") – single or double quotes
  const re = /\bt\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    let m
    while ((m = re.exec(content)) !== null) {
      keys.add(m[1])
    }
  }
  return keys
}

/**
 * Extract every translation key already defined in a SQL file.
 * Matches lines like:  ('someKey', 'some value'),
 *                      ('someKey', 'some value')
 * inside a VALUES block.
 */
function extractKeysFromSql(sqlContent) {
  const keys = new Set()
  // Each row in a VALUES block starts with  ('key', 'value')
  const re = /^\s*\('([^']+)',\s*'[^']*'\)/gm
  let m
  while ((m = re.exec(sqlContent)) !== null) {
    keys.add(m[1])
  }
  return keys
}

/**
 * Collect all .sql files in the database directory.
 */
function getAllSqlFiles() {
  return fs.readdirSync(DB_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => path.join(DB_DIR, f))
}

/**
 * Build the combined set of keys already present in all SQL files.
 */
function getExistingKeys() {
  const existing = new Set()
  for (const file of getAllSqlFiles()) {
    const content = fs.readFileSync(file, 'utf8')
    for (const k of extractKeysFromSql(content)) {
      existing.add(k)
    }
  }
  return existing
}

/**
 * Determine the next migration file number (e.g. 003).
 */
function nextMigrationNumber() {
  const pattern = /^(\d+)_/
  let max = 0
  for (const f of fs.readdirSync(DB_DIR)) {
    const m = pattern.exec(f)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return String(max + 1).padStart(3, '0')
}

/**
 * Escape a SQL string value (single-quote doubling).
 */
function sqlEscape(str) {
  return str.replace(/'/g, "''")
}

/**
 * Generate the SQL migration content for the given new keys.
 */
function buildMigrationSql(newKeys) {
  const sortedKeys = [...newKeys].sort()
  const timestamp  = new Date().toISOString()

  let sql = `-- =============================================================\n`
  sql    += `--  Auto-generated translation migration\n`
  sql    += `--  Generated at: ${timestamp}\n`
  sql    += `--  New keys: ${sortedKeys.length}\n`
  sql    += `-- =============================================================\n\n`
  sql    += `BEGIN;\n\n`

  for (const lang of LANGUAGES) {
    const rows = sortedKeys
      .map(k => `  ('${sqlEscape(k)}', '[PENDIENTE: ${sqlEscape(k)}]')`)
      .join(',\n')

    sql += `-- Translations for language: ${lang}\n`
    sql += `INSERT INTO traducciones (idioma_id, clave, valor)\n`
    sql += `SELECT i.id, k.clave, k.valor\n`
    sql += `FROM idiomas i\n`
    sql += `CROSS JOIN (VALUES\n`
    sql += rows + '\n'
    sql += `) AS k(clave, valor)\n`
    sql += `WHERE i.code = '${lang}'\n`
    sql += `ON CONFLICT (idioma_id, clave) DO NOTHING;\n\n`
  }

  sql += `COMMIT;\n`
  return sql
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. Collect source files
  const exts  = ['.js', '.jsx', '.ts', '.tsx']
  const files = walkDir(SRC_DIR, exts)
  console.log(`Scanning ${files.length} source file(s) in ${SRC_DIR}`)

  // 2. Extract keys used in the source
  const usedKeys = extractKeysFromSource(files)
  console.log(`Found ${usedKeys.size} unique translation key(s) in source`)

  // 3. Get keys already in SQL files
  const existingKeys = getExistingKeys()
  console.log(`Found ${existingKeys.size} key(s) already defined in SQL file(s)`)

  // 4. Compute the diff
  const newKeys = new Set([...usedKeys].filter(k => !existingKeys.has(k)))

  if (newKeys.size === 0) {
    console.log('✅ All translation keys are already present in the SQL files. Nothing to do.')
    process.exit(0)
  }

  console.log(`\n🆕 ${newKeys.size} new translation key(s) detected:`)
  for (const k of [...newKeys].sort()) {
    console.log(`   • ${k}`)
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] No files written.')
    process.exit(2)
  }

  // 5. Generate migration file
  const num      = nextMigrationNumber()
  const filename = `${num}_new_translations.sql`
  const filepath = path.join(DB_DIR, filename)
  const content  = buildMigrationSql(newKeys)

  fs.writeFileSync(filepath, content, 'utf8')
  console.log(`\n✅ Migration file created: database/${filename}`)

  process.exit(2)
}

main()
