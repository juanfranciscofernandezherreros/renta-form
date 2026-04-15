'use strict'

const { Router } = require('express')
const router = Router()

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

  router.post('/users/:dniNie/email', async (req, res) => {
    const { email, mensaje } = req.body ?? {}
    const result = await svc.sendEmailToUser({ dniNie: req.params.dniNie, email, mensaje })
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

  // ── Traducciones faltantes ─────────────────────────────────────────────

  router.get('/traducciones/faltantes', async (req, res) => {
    const ref = req.query.ref || 'es'
    const result = await svc.getMissingTranslations(ref)
    send(res, result)
  })

  return router
}
