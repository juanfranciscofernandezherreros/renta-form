'use strict'

const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const { requireAdmin } = require('../middleware/auth')
const router = Router()

// Defence in depth: cap the number of admin API calls per IP to mitigate
// brute-force and abuse even when a token is present.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
})

// All routes mounted under /v1/admin require a valid admin bearer token.
router.use(adminLimiter)
router.use(requireAdmin)

function send(res, result) {
  if (result.error) {
    const status = result.status || (result.data === null ? 404 : 400)
    return res.status(status).json({ error: result.error.message })
  }
  return res.status(result.status || 200).json(result.data)
}

module.exports = function adminRoutes(svc) {
  // ── Preguntas del formulario (editables por el admin) ───────────────────

  router.get('/preguntas-formulario', async (req, res) => {
    const { page, limit } = req.query
    const result = await svc.listPreguntasFormulario({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    })
    send(res, result)
  })

  router.post('/preguntas-formulario', async (req, res) => {
    const result = await svc.createPreguntaFormulario(req.body ?? {})
    send(res, result)
  })

  router.put('/preguntas-formulario/:id', async (req, res) => {
    const result = await svc.updatePreguntaFormulario(req.params.id, req.body ?? {})
    send(res, result)
  })

  router.delete('/preguntas-formulario/:id', async (req, res) => {
    const result = await svc.deletePreguntaFormulario(req.params.id)
    if (result.status === 204) return res.status(204).end()
    send(res, result)
  })

  // ── Usuarios ─────────────────────────────────────────────────────────────

  router.get('/users', async (req, res) => {
    const { bloqueado, denunciado, search, page, limit } = req.query
    const result = await svc.listUsersAdmin({
      bloqueado: bloqueado !== undefined ? bloqueado === 'true' : undefined,
      denunciado: denunciado !== undefined ? denunciado === 'true' : undefined,
      search: search ? String(search).trim() : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    })
    send(res, result)
  })

  router.post('/users/assign', async (req, res) => {
    const result = await svc.assignUserAccount(req.body ?? {})
    send(res, result)
  })

  router.get('/users/:dniNie', async (req, res) => {
    const result = await svc.getUserByDniNie(req.params.dniNie)
    send(res, result)
  })

  router.patch('/users/:dniNie/block', async (req, res) => {
    const { bloqueado } = req.body ?? {}
    const result = await svc.blockUser(req.params.dniNie, bloqueado)
    send(res, result)
  })

  router.patch('/users/:dniNie/report', async (req, res) => {
    const { denunciado } = req.body ?? {}
    const result = await svc.reportUser(req.params.dniNie, denunciado)
    send(res, result)
  })

  router.delete('/users/:dniNie', async (req, res) => {
    const result = await svc.deleteUser(req.params.dniNie)
    send(res, result)
  })

  router.get('/users/:dniNie/roles', async (req, res) => {
    const result = await svc.getUserRolesAdmin(req.params.dniNie)
    send(res, result)
  })

  router.put('/users/:dniNie/roles', async (req, res) => {
    const result = await svc.setUserRolesAdmin(req.params.dniNie, req.body ?? {})
    send(res, result)
  })

  router.post('/users/:dniNie/email', async (req, res) => {
    const { email, mensaje } = req.body ?? {}
    const result = await svc.sendEmailToUser({ dniNie: req.params.dniNie, email, mensaje })
    send(res, result)
  })

  // ── Roles (catálogo con relación many-to-many con usuarios) ─────────────

  router.get('/roles', async (req, res) => {
    const result = await svc.listRolesAdmin()
    send(res, result)
  })

  router.post('/roles', async (req, res) => {
    const result = await svc.createRoleAdmin(req.body ?? {})
    send(res, result)
  })

  router.put('/roles/:id', async (req, res) => {
    const result = await svc.updateRoleAdmin(req.params.id, req.body ?? {})
    send(res, result)
  })

  router.delete('/roles/:id', async (req, res) => {
    const result = await svc.deleteRoleAdmin(req.params.id)
    if (result.status === 204) return res.status(204).end()
    send(res, result)
  })

  // ── Idiomas & Traducciones ───────────────────────────────────────────────

  router.get('/idiomas', async (req, res) => {
    const { activo, page, limit } = req.query
    const result = await svc.listIdiomasAdmin({
      activo: activo !== undefined ? activo === 'true' : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    })
    send(res, result)
  })

  router.post('/idiomas', async (req, res) => {
    const result = await svc.createIdiomaAdmin(req.body ?? {})
    send(res, result)
  })

  router.put('/idiomas/:idiomaId', async (req, res) => {
    const result = await svc.updateIdiomaAdmin(req.params.idiomaId, req.body ?? {})
    send(res, result)
  })

  router.delete('/idiomas/:idiomaId', async (req, res) => {
    const result = await svc.deleteIdiomaAdmin(req.params.idiomaId)
    if (result.status === 204) return res.status(204).end()
    send(res, result)
  })

  router.get('/idiomas/:idiomaId/content', async (req, res) => {
    const result = await svc.getIdiomaContent(req.params.idiomaId)
    send(res, result)
  })

  router.put('/idiomas/:idiomaId/content', async (req, res) => {
    const result = await svc.updateIdiomaContent(req.params.idiomaId, req.body ?? {})
    send(res, result)
  })

  // ── Configuración ─────────────────────────────────────────────────────

  router.get('/configuracion', async (req, res) => {
    const result = await svc.getConfiguracion()
    send(res, result)
  })

  router.put('/configuracion/:clave', async (req, res) => {
    const { valor } = req.body ?? {}
    const result = await svc.updateConfiguracion(req.params.clave, valor)
    send(res, result)
  })

  // ── Traducciones faltantes ─────────────────────────────────────────────

  router.get('/traducciones/faltantes', async (req, res) => {
    const ref = req.query.ref || 'static'
    const result = await svc.getMissingTranslations(ref)
    send(res, result)
  })

  return router
}
