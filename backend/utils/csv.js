'use strict'

// Minimal RFC 4180-compliant CSV helpers (no external dependencies).
//
// Supports:
//   * Comma separator
//   * Double-quoted fields (with escaped quotes via "")
//   * CRLF, LF and CR line endings
//   * Optional leading UTF-8 BOM (stripped automatically)
//
// parseCsv(text) → string[][]   (rows of fields, including the header row)
// rowsToCsv(rows) → string       (CRLF terminated, quotes when needed)

function parseCsv(input) {
  if (input === null || input === undefined) return []
  let text = String(input)
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  const rows = []
  let row = []
  let field = ''
  let i = 0
  let inQuotes = false
  const len = text.length

  while (i < len) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }

    if (c === '"') { inQuotes = true; i += 1; continue }
    if (c === ',') { row.push(field); field = ''; i += 1; continue }
    if (c === '\r') {
      row.push(field); field = ''
      rows.push(row); row = []
      if (text[i + 1] === '\n') i += 2
      else i += 1
      continue
    }
    if (c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      i += 1
      continue
    }
    field += c
    i += 1
  }

  // Flush the final field/row.  Skip a trailing empty row produced by a
  // file that ends with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const NEEDS_QUOTING = /[",\r\n]/

function escapeField(value) {
  const s = value === null || value === undefined ? '' : String(value)
  if (NEEDS_QUOTING.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(rows) {
  return rows.map(r => r.map(escapeField).join(',')).join('\r\n') + '\r\n'
}

module.exports = { parseCsv, rowsToCsv }
