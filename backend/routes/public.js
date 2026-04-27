'use strict'

// ---------------------------------------------------------------------------
//  Public routes – mounted at /v1/public.
//
//  These endpoints are intentionally **not** protected by any authentication
//  middleware. They exist so that anonymous citizens can submit their
//  declaration even when they do not have (or have lost) a valid session
//  token. The legacy POST /v1/irpf/declaraciones endpoint is also public,
//  but to remove any possibility of an upstream proxy rejecting the request
//  because of a stale Authorization header, the front-end calls this
//  alternative endpoint without sending one.
// ---------------------------------------------------------------------------

const { Router } = require('express')
const rateLimit = require('express-rate-limit')

const router = Router()

// Light rate limit to mitigate abuse on this anonymous endpoint while still
// being permissive enough for normal users.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
})

function send(res, result) {
  if (result.error) {
    const status = result.status || (result.data === null ? 404 : 400)
    return res.status(status).json({ error: result.error.message })
  }
  return res.status(result.status || 200).json(result.data)
}

module.exports = function publicRoutes(svc) {
  // POST /v1/public/declaraciones
  // Public endpoint – no authentication required. Mirrors the behaviour of
  // POST /v1/irpf/declaraciones but is guaranteed to never be wrapped by any
  // auth middleware.
  router.post('/declaraciones', publicLimiter, async (req, res) => {
    const result = await svc.createDeclaracion(req.body ?? {})
    send(res, result)
  })

  return router
}
