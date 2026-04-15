#!/usr/bin/env node
/**
 * check-translations.js
 *
 * Compares the static translation JSON files in /translations/ and reports
 * any keys that are missing or extra in each language relative to the
 * reference language (es.json by default).
 *
 * Usage:
 *   node scripts/check-translations.js [--ref <lang>] [--strict]
 *
 * Options:
 *   --ref <lang>   Reference language to compare against (default: es)
 *   --strict       Exit with code 1 if any missing keys are found
 *
 * Exit codes:
 *   0 – all languages are complete
 *   1 – one or more languages have missing keys (only when --strict is used)
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, join, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const TRANSLATIONS_DIR = join(ROOT, 'translations')

// ─── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const refIdx = args.indexOf('--ref')
const REF_LANG = refIdx !== -1 ? args[refIdx + 1] : 'es'
const STRICT = args.includes('--strict')

// ─── Load JSON files ──────────────────────────────────────────────────────────

function loadTranslations() {
  const files = readdirSync(TRANSLATIONS_DIR).filter(f => f.endsWith('.json'))
  const result = {}
  for (const file of files) {
    const lang = basename(file, '.json')
    const content = JSON.parse(readFileSync(join(TRANSLATIONS_DIR, file), 'utf8'))
    result[lang] = content
  }
  return result
}

// ─── Compare ──────────────────────────────────────────────────────────────────

function compare(refKeys, targetKeys) {
  const missing = refKeys.filter(k => !(k in targetKeys))
  const extra   = Object.keys(targetKeys).filter(k => !refKeys.includes(k))
  return { missing, extra }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const translations = loadTranslations()

  if (!translations[REF_LANG]) {
    console.error(`❌  Reference language "${REF_LANG}" not found in ${TRANSLATIONS_DIR}`)
    process.exit(1)
  }

  const refKeys = Object.keys(translations[REF_LANG])
  const langs   = Object.keys(translations).filter(l => l !== REF_LANG).sort()

  console.log(`\n📋  Translation check — reference: ${REF_LANG}.json (${refKeys.length} keys)\n`)
  console.log(`   Languages checked: ${langs.join(', ')}\n`)

  let totalMissing = 0

  for (const lang of langs) {
    const { missing, extra } = compare(refKeys, translations[lang])
    totalMissing += missing.length

    if (missing.length === 0 && extra.length === 0) {
      console.log(`   ✅  ${lang}.json — complete (${refKeys.length}/${refKeys.length} keys)`)
    } else {
      const total = Object.keys(translations[lang]).length
      console.log(`   ⚠️   ${lang}.json — ${total} keys (${missing.length} missing, ${extra.length} extra)`)

      if (missing.length > 0) {
        console.log(`\n       Missing keys in "${lang}":`)
        for (const k of missing) {
          console.log(`         • ${k}  →  "${translations[REF_LANG][k]}"`)
        }
      }

      if (extra.length > 0) {
        console.log(`\n       Extra keys in "${lang}" (not in "${REF_LANG}"):`)
        for (const k of extra) {
          console.log(`         + ${k}`)
        }
      }
      console.log()
    }
  }

  console.log()

  if (totalMissing === 0) {
    console.log('✅  All languages are complete. No missing keys found.\n')
    process.exit(0)
  } else {
    console.log(`⚠️   Total missing keys across all languages: ${totalMissing}\n`)
    if (STRICT) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  }
}

main()
