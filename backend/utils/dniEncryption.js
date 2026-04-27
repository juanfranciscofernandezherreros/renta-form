'use strict'

// ---------------------------------------------------------------------------
// dniEncryption.js – Helpers for storing DNI/NIE encrypted in the database.
//
// Set the environment variable DNI_ENCRYPTION_KEY to a 64-character hex string
// (32 random bytes).  Example:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Design
// ──────
// Two separate operations are used:
//
//  1. encryptDni(plaintext)  – AES-256-CBC with a fresh random 16-byte IV.
//     The stored format is "enc:<ivHex>:<ciphertextHex>".  Because the IV is
//     random, equal plaintext values produce different ciphertexts on each
//     call, so the column cannot be used directly for UNIQUE constraints or
//     WHERE lookups.
//
//  2. hashDni(plaintext)     – HMAC-SHA256 keyed with DNI_ENCRYPTION_KEY.
//     Always returns the same value for the same input ("hash:<hex>").
//     Stored in a separate `dni_nie_hash` column which carries the UNIQUE
//     constraint and is used in all WHERE clauses.
//
// When DNI_ENCRYPTION_KEY is not set, both functions return the normalised
// plaintext unchanged so the application continues to work out of the box.
// ---------------------------------------------------------------------------

const crypto = require('crypto')

const CIPHER_ALG = 'aes-256-cbc'
const ENC_PREFIX  = 'enc:'
const HASH_PREFIX = 'hash:'

/**
 * Returns the 32-byte key buffer from DNI_ENCRYPTION_KEY, or null when the
 * variable is not set.  Throws if the variable is set but has the wrong length.
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
 * Normalises a DNI/NIE to its canonical uppercase form (trim + toUpperCase).
 * Exported so callers that already have a normalised value can skip re-encoding.
 */
function normalise(value) {
  return (value ?? '').trim().toUpperCase()
}

/**
 * Encrypts a DNI/NIE with AES-256-CBC using a fresh random IV.
 * Returns a string of the form "enc:<ivHex>:<ciphertextHex>".
 *
 * Returns the normalised plaintext unchanged when DNI_ENCRYPTION_KEY is not set.
 */
function encryptDni(plaintext) {
  if (!plaintext) return plaintext
  const key = getKey()
  const norm = normalise(plaintext)
  if (!key) return norm
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(CIPHER_ALG, key, iv)
  let encrypted = cipher.update(norm, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return ENC_PREFIX + iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypts a value stored by encryptDni().
 *
 * Returns the original value unchanged when:
 *   - the input is falsy
 *   - DNI_ENCRYPTION_KEY is not configured
 *   - the value does not carry the "enc:" prefix (legacy plain-text row)
 *
 * Throws on decryption failure so the caller is explicitly aware of the error.
 */
function decryptDni(ciphertext) {
  if (!ciphertext) return ciphertext
  const key = getKey()
  if (!key) return ciphertext
  if (!ciphertext.startsWith(ENC_PREFIX)) {
    return ciphertext // legacy plain-text row – return as-is
  }
  try {
    const payload = ciphertext.slice(ENC_PREFIX.length)
    const colonIdx = payload.indexOf(':')
    if (colonIdx === -1) throw new Error('invalid format: missing IV separator')
    const iv = Buffer.from(payload.slice(0, colonIdx), 'hex')
    const encryptedHex = payload.slice(colonIdx + 1)
    const decipher = crypto.createDecipheriv(CIPHER_ALG, key, iv)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[dniEncryption] decryptDni failed – check DNI_ENCRYPTION_KEY configuration')
    throw err
  }
}

/**
 * Returns an HMAC-SHA256 of the normalised DNI/NIE keyed with
 * DNI_ENCRYPTION_KEY.  The result is stable (same input → same output) and
 * is used in the `dni_nie_hash` column for UNIQUE constraints and WHERE
 * lookups.
 *
 * Returns the normalised plaintext when DNI_ENCRYPTION_KEY is not set so the
 * application continues to work in non-encrypted mode.
 */
function hashDni(plaintext) {
  if (!plaintext) return plaintext
  const key = getKey()
  const norm = normalise(plaintext)
  if (!key) return norm
  return HASH_PREFIX + crypto.createHmac('sha256', key).update(norm).digest('hex')
}

module.exports = { encryptDni, decryptDni, hashDni, normalise }
