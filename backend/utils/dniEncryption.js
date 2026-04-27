'use strict'

// ---------------------------------------------------------------------------
// dniEncryption.js – AES-256-CBC helpers for storing DNI/NIE encrypted in DB.
//
// Set the environment variable DNI_ENCRYPTION_KEY to a 64-character hex string
// (32 random bytes). Example:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Encryption is deterministic: the IV is derived from the first 16 bytes of
// the key so the same plaintext always produces the same ciphertext. This
// preserves UNIQUE constraints and allows WHERE lookups without a separate
// hash column.
//
// If DNI_ENCRYPTION_KEY is not set, the functions are no-ops and return the
// value unchanged (backward-compatible plaintext fallback).
// ---------------------------------------------------------------------------

const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'

/**
 * Returns the 32-byte key buffer from the DNI_ENCRYPTION_KEY env var,
 * or null if the variable is not set (encryption disabled).
 * Throws if the variable is set but invalid.
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
 * Encrypts a DNI/NIE string with AES-256-CBC and returns a lowercase hex
 * string. Returns the original value unchanged when:
 *   - the input is falsy
 *   - DNI_ENCRYPTION_KEY is not configured
 */
function encryptDni(plaintext) {
  if (!plaintext) return plaintext
  const key = getKey()
  if (!key) return plaintext
  const iv = key.slice(0, 16) // deterministic IV derived from the key
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

/**
 * Decrypts a value that was stored by encryptDni(). Returns the original
 * value unchanged when:
 *   - the input is falsy
 *   - DNI_ENCRYPTION_KEY is not configured
 *   - the value does not look like a hex-encoded ciphertext (legacy rows)
 *   - decryption fails for any reason
 */
function decryptDni(ciphertext) {
  if (!ciphertext) return ciphertext
  const key = getKey()
  if (!key) return ciphertext
  // Only attempt decryption on values that look like hex ciphertext.
  if (!/^[0-9a-f]+$/i.test(ciphertext) || ciphertext.length % 2 !== 0) {
    return ciphertext // legacy plaintext row – return as-is
  }
  try {
    const iv = key.slice(0, 16)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ciphertext // decryption failed – return raw value
  }
}

module.exports = { encryptDni, decryptDni }
