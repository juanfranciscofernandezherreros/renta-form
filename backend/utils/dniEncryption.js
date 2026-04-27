'use strict'

// ---------------------------------------------------------------------------
// dniEncryption.js – AES-256-CBC helpers for storing DNI/NIE encrypted in DB.
//
// Set the environment variable DNI_ENCRYPTION_KEY to a 64-character hex string
// (32 random bytes). Example:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Design notes
// ────────────
// • A fixed IV is derived from the first 16 bytes of the key so that the same
//   plaintext always produces the same ciphertext.  This is intentional: it
//   preserves UNIQUE constraints and allows WHERE lookups without adding a
//   separate hash column.  The trade-off (same-plaintext → same-ciphertext)
//   is acceptable here because DNI/NIE values are already unique per person
//   and the cipher still requires the key to be reversed.
// • Every encrypted value is prefixed with "enc:" so it can be reliably
//   distinguished from legacy plain-text rows.
// • If DNI_ENCRYPTION_KEY is not set the functions are no-ops; they return
//   the value unchanged (backward-compatible plain-text fallback).
// ---------------------------------------------------------------------------

const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'
const ENC_PREFIX = 'enc:'

/**
 * Returns the 32-byte key buffer from the DNI_ENCRYPTION_KEY env var,
 * or null if the variable is not set (encryption disabled).
 * Throws if the variable is set but has the wrong length.
 */
function getKey() {
  const keyHex = process.env.DNI_ENCRYPTION_KEY
  if (!keyHex) return null
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    throw new Error('DNI_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  }
  return key
}

/**
 * Normalises a DNI/NIE to its canonical uppercase form before
 * encryption or hashing, matching the application's existing convention.
 */
function normalise(value) {
  return (value ?? '').trim().toUpperCase()
}

/**
 * Encrypts a DNI/NIE string with AES-256-CBC and returns a string of the
 * form "enc:<hexCiphertext>".
 *
 * Returns the original value unchanged when:
 *   - the input is falsy
 *   - DNI_ENCRYPTION_KEY is not configured
 */
function encryptDni(plaintext) {
  if (!plaintext) return plaintext
  const key = getKey()
  if (!key) return plaintext
  const norm = normalise(plaintext)
  const iv = key.slice(0, 16) // deterministic IV derived from the key
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(norm, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return ENC_PREFIX + encrypted
}

/**
 * Decrypts a value stored by encryptDni().
 *
 * Returns the original value unchanged when:
 *   - the input is falsy
 *   - DNI_ENCRYPTION_KEY is not configured
 *   - the value does not carry the "enc:" prefix (legacy plain-text row)
 *   - decryption fails for any reason
 */
function decryptDni(ciphertext) {
  if (!ciphertext) return ciphertext
  const key = getKey()
  if (!key) return ciphertext
  if (!ciphertext.startsWith(ENC_PREFIX)) {
    return ciphertext // legacy plain-text row – return as-is
  }
  try {
    const hex = ciphertext.slice(ENC_PREFIX.length)
    const iv = key.slice(0, 16)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(hex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[dniEncryption] decryptDni failed:', err.message)
    return ciphertext // return raw stored value on failure
  }
}

module.exports = { encryptDni, decryptDni, normalise }
