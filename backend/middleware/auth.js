'use strict'

// ---------------------------------------------------------------------------
//  Auth middleware – stateless bearer tokens signed with HMAC-SHA256.
//
//  Tokens are JWT-like compact strings (header.payload.signature, base64url),
//  but verified with a single shared HMAC secret.  No external dependency is
//  used – we rely on Node's built-in `crypto` module.
//
//  The secret comes from `AUTH_SECRET`.  In development a random per-process
//  secret is generated (so all sessions are invalidated on restart) and a
//  warning is logged on startup.  The dev fallback is intentionally NOT
//  considered safe for production.
// ---------------------------------------------------------------------------

const crypto = require('crypto')

const DEFAULT_TTL_SECONDS = 8 * 60 * 60 // 8 hours

let _warned = false
let _devSecret = null
function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 16) return secret
  if (!_warned) {
    console.warn(
      '[auth] AUTH_SECRET is not set or is too short. Generating a random ' +
        'per-process development secret. All sessions will be invalidated on ' +
        'restart. Set AUTH_SECRET (>=16 chars) in production.'
    )
    _warned = true
  }
  if (!_devSecret) {
    _devSecret = crypto.randomBytes(32).toString('hex')
  }
  return _devSecret
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8')
  return buf
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(str) {
  const pad = 4 - (str.length % 4)
  const padded = pad === 4 ? str : str + '='.repeat(pad)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(data) {
  return base64UrlEncode(
    crypto.createHmac('sha256', getSecret()).update(data).digest()
  )
}

/**
 * Sign an arbitrary payload object and return a compact bearer token.
 * `exp` (seconds since epoch) is added automatically based on `ttlSeconds`.
 */
function signToken(payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + ttlSeconds }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const bodyB64 = base64UrlEncode(JSON.stringify(body))
  const data = `${headerB64}.${bodyB64}`
  const signature = sign(data)
  return `${data}.${signature}`
}

/**
 * Verify a bearer token. Returns the decoded payload object on success,
 * or `null` if the token is missing/malformed/invalid/expired.
 */
function verifyToken(token) {
  if (typeof token !== 'string' || !token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, bodyB64, signatureB64] = parts
  const data = `${headerB64}.${bodyB64}`
  const expected = sign(data)
  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(signatureB64)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  let payload
  try {
    payload = JSON.parse(base64UrlDecode(bodyB64).toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    return null
  }
  return payload
}

/** Extract the bearer token from the Authorization header, if any. */
function extractBearer(req) {
  const header = req.headers && req.headers.authorization
  if (!header || typeof header !== 'string') return null
  // Avoid backtracking-prone regex: do a case-insensitive prefix check then
  // split off the scheme.  The token is the rest of the header trimmed.
  if (header.length < 8) return null
  const prefix = header.slice(0, 7)
  if (prefix.toLowerCase() !== 'bearer ') return null
  const token = header.slice(7).trim()
  return token || null
}

/**
 * Express middleware – requires any authenticated user (valid bearer token).
 * Populates `req.user` with the token payload on success.
 */
function requireAuth(req, res, next) {
  const token = extractBearer(req)
  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.user = payload
  next()
}

/**
 * Express middleware – requires an authenticated user with admin role.
 * Returns 401 if the token is missing/invalid, 403 if it is valid but the
 * user is not an admin.
 */
function requireAdmin(req, res, next) {
  const token = extractBearer(req)
  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  req.user = payload
  next()
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  requireAdmin,
}
