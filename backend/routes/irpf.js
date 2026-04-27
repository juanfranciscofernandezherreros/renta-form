'use strict'

const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const { requireAdmin } = require('../middleware/auth')

const router = Router()

// Defence in depth: cap the number of admin API calls per IP on the
// admin-only IRPF endpoints to mitigate brute-force / abuse even when
// a token is present.  Mirrors the limiter used in routes/admin.js.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
})

// Combined middleware applied to admin-only routes: rate-limit first, then
// require an admin bearer token.
const adminOnly = [adminLimiter, requireAdmin]

function send(res, result) {
  if (result.error) {
    const status = result.status || (result.data === null ? 404 : 400)
    return res.status(status).json({ error: result.error.message })
  }
  return res.status(result.status || 200).json(result.data)
}

module.exports = function irpfRoutes(svc) {
  // GET /v1/irpf/preguntas
  router.get('/preguntas', async (req, res) => {
    const result = await svc.getPreguntas(req.query.lang || null)
    send(res, result)
  })

  // GET /v1/irpf/idiomas
  router.get('/idiomas', async (_req, res) => {
    const result = await svc.getIdiomas()
    send(res, result)
  })

  // GET /v1/irpf/traducciones
  router.get('/traducciones', async (_req, res) => {
    const result = await svc.getTraducciones()
    send(res, result)
  })

  // GET /v1/irpf/declaraciones/all  (admin – must come BEFORE /:id)
  router.get('/declaraciones/all', adminOnly, async (req, res) => {
    const { dniNie, estado, page, limit } = req.query
    const result = await svc.listDeclaracionesAll({
      dniNie,
      estado,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    })
    send(res, result)
  })

  // GET /v1/irpf/declaraciones
  router.get('/declaraciones', async (req, res) => {
    const { dniNie, estado, page, limit } = req.query
    const result = await svc.listDeclaraciones({
      dniNie,
      estado,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    })
    send(res, result)
  })

  // POST /v1/irpf/declaraciones
  router.post('/declaraciones', async (req, res) => {
    const result = await svc.createDeclaracion(req.body)
    send(res, result)
  })

  // GET /v1/irpf/declaraciones/:id
  router.get('/declaraciones/:id', async (req, res) => {
    const result = await svc.getDeclaracion(req.params.id)
    send(res, result)
  })

  // PATCH /v1/irpf/declaraciones/:id  (admin – update estado)
  router.patch('/declaraciones/:id', adminOnly, async (req, res) => {
    const { estado } = req.body ?? {}
    if (!estado) return res.status(400).json({ error: 'estado es obligatorio' })
    const result = await svc.updateEstadoDeclaracion(req.params.id, estado)
    send(res, result)
  })

  // PUT /v1/irpf/declaraciones/:id  (update all fields)
  router.put('/declaraciones/:id', async (req, res) => {
    const result = await svc.updateDeclaracion(req.params.id, req.body ?? {})
    send(res, result)
  })

  // DELETE /v1/irpf/declaraciones/:id  (admin)
  router.delete('/declaraciones/:id', adminOnly, async (req, res) => {
    const result = await svc.deleteDeclaracion(req.params.id)
    send(res, result)
  })

  // POST /v1/irpf/declaraciones/:id/email  (admin)
  router.post('/declaraciones/:id/email', adminOnly, async (req, res) => {
    const { email, mensaje } = req.body ?? {}
    const result = await svc.sendEmailDeclaracion({ declaracionId: req.params.id, email, mensaje })
    send(res, result)
  })

  // GET /v1/irpf/consulta/:token  (public – no auth)
  router.get('/consulta/:token', async (req, res) => {
    const result = await svc.getDeclaracionByToken(req.params.token)
    send(res, result)
  })

  return router
}
