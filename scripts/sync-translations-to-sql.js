#!/usr/bin/env node
/**
 * sync-translations-to-sql.js
 *
 * Reads translations/es.json, translations/fr.json, translations/en.json,
 * translations/ca.json and ensures every key/value pair is present in the
 * corresponding INSERT block inside database/init.sql.
 *
 * New keys are appended to the VALUES list; existing ones are left untouched.
 * The script exits with code 1 if any SQL file could not be updated.
 *
 * Usage:
 *   node scripts/sync-translations-to-sql.js [--sql path/to/file.sql]
 *
 * Options:
 *   --sql  Path to the SQL file to update (default: database/init.sql)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LANGS = ['es', 'fr', 'en', 'ca'];
const ROOT = resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const sqlIdx = args.indexOf('--sql');
const sqlRelPath = sqlIdx !== -1 ? args[sqlIdx + 1] : 'database/init.sql';
const SQL_FILE = resolve(ROOT, sqlRelPath);
const TRANSLATIONS_DIR = join(ROOT, 'translations');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string value for use inside a SQL single-quoted literal.
 * Only single-quotes need to be doubled in PostgreSQL dollar-free strings.
 */
function sqlEscape(str) {
  return str.replace(/'/g, "''");
}

/**
 * Parse the VALUES block for a given language from the SQL content.
 * Returns a Set of keys already present.
 */
function parseExistingKeys(sql, lang) {
  const keys = new Set();

  // Locate the closing marker for this language block first, then find
  // the nearest CROSS JOIN (VALUES that precedes it to avoid spanning
  // across multiple language blocks (which a lazy [\s\S]*? would do).
  const closingMarker = `) AS k(clave, valor)\nWHERE i.code = '${lang}'`;
  const closingIdx = sql.indexOf(closingMarker);
  if (closingIdx === -1) return keys;

  // Find the last "CROSS JOIN (VALUES" before the closing marker
  const crossJoinToken = 'CROSS JOIN (VALUES';
  const startIdx = sql.lastIndexOf(crossJoinToken, closingIdx);
  if (startIdx === -1) return keys;

  const valuesBlock = sql.slice(startIdx + crossJoinToken.length, closingIdx);
  const entryRe = /\('([^']*(?:''[^']*)*)',\s*'(?:[^']*(?:''[^']*)*)'\)/g;
  let m;
  while ((m = entryRe.exec(valuesBlock)) !== null) {
    keys.add(m[1].replace(/''/g, "'"));
  }
  return keys;
}

/**
 * Insert new translation entries into the VALUES block for a given language.
 * Returns the updated SQL string (unchanged if nothing to add).
 */
function insertEntries(sql, lang, newEntries) {
  if (newEntries.length === 0) return sql;

  // Find the closing marker ) AS k(clave, valor) WHERE i.code = 'LANG'
  const insertMarker = `) AS k(clave, valor)\nWHERE i.code = '${lang}'`;
  const idx = sql.indexOf(insertMarker);
  if (idx === -1) {
    console.error(`Could not find closing marker for language '${lang}' in SQL file.`);
    process.exit(1);
  }

  const newLines = newEntries
    .map(([k, v]) => `  ('${sqlEscape(k)}', '${sqlEscape(v)}')`)
    .join(',\n');

  // Ensure there is no trailing blank line before the closing marker
  // and place the comma at the end of the last existing entry line.
  const before = sql.slice(0, idx).replace(/\n+$/, '');
  return before + ',\n' + newLines + '\n' + sql.slice(idx);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(SQL_FILE)) {
  console.error(`SQL file not found: ${SQL_FILE}`);
  process.exit(1);
}

let sql = readFileSync(SQL_FILE, 'utf8');
let totalAdded = 0;

for (const lang of LANGS) {
  const jsonFile = join(TRANSLATIONS_DIR, `${lang}.json`);
  if (!existsSync(jsonFile)) {
    console.warn(`Warning: translations/${lang}.json not found, skipping.`);
    continue;
  }

  let translations;
  try {
    translations = JSON.parse(readFileSync(jsonFile, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse ${jsonFile}: ${err.message}`);
    process.exit(1);
  }

  const existingKeys = parseExistingKeys(sql, lang);
  const newEntries = Object.entries(translations).filter(
    ([k]) => !existingKeys.has(k)
  );

  if (newEntries.length === 0) {
    console.log(`[${lang}] No new keys to add.`);
    continue;
  }

  console.log(
    `[${lang}] Adding ${newEntries.length} new key(s): ${newEntries
      .map(([k]) => k)
      .join(', ')}`
  );
  sql = insertEntries(sql, lang, newEntries);
  totalAdded += newEntries.length;
}

if (totalAdded > 0) {
  writeFileSync(SQL_FILE, sql, 'utf8');
  console.log(`\nSQL file updated: ${relative(ROOT, SQL_FILE)} (+${totalAdded} entries)`);
} else {
  console.log('\nSQL file is already up to date. No changes made.');
}
