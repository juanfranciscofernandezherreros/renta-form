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

module.exports = function irpfRoutes(svc) {
  // GET /v1/irpf/preguntas
  router.get('/preguntas', async (_req, res) => {
    const result = await svc.getPreguntas()
    send(res, result)
  })

  // GET /v1/irpf/declaraciones/all  (admin – must come BEFORE /:id)
  router.get('/declaraciones/all', async (req, res) => {
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

  // POST /v1/irpf/declaraciones/:id/email
  router.post('/declaraciones/:id/email', async (req, res) => {
    const { email, mensaje } = req.body ?? {}
    const result = await svc.sendEmailDeclaracion({
      declaracionId: req.params.id,
      email,
      mensaje,
    })
    send(res, result)
  })

  // GET /v1/irpf/declaraciones/:id/preguntas  (preguntas adicionales asignadas)
  router.get('/declaraciones/:id/preguntas', async (req, res) => {
    const result = await svc.getDeclaracionPreguntas(req.params.id)
    send(res, result)
  })

  // POST /v1/irpf/declaraciones/:id/preguntas  (assign / update respuestas)
  router.post('/declaraciones/:id/preguntas', async (req, res) => {
    const { asignaciones = [] } = req.body ?? {}
    const result = await svc.upsertDeclaracionPreguntas(req.params.id, asignaciones)
    send(res, result)
  })

  // DELETE /v1/irpf/declaraciones/:id/preguntas/:preguntaId
  router.delete('/declaraciones/:id/preguntas/:preguntaId', async (req, res) => {
    const result = await svc.removeDeclaracionPregunta(req.params.id, req.params.preguntaId)
    send(res, result)
  })

  // GET /v1/irpf/declaraciones/:id
  router.get('/declaraciones/:id', async (req, res) => {
    const result = await svc.getDeclaracion(req.params.id)
    send(res, result)
  })

  // PATCH /v1/irpf/declaraciones/:id  (update estado)
  router.patch('/declaraciones/:id', async (req, res) => {
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

  // DELETE /v1/irpf/declaraciones/:id
  router.delete('/declaraciones/:id', async (req, res) => {
    const result = await svc.deleteDeclaracion(req.params.id)
    send(res, result)
  })

  // GET /v1/irpf/consulta/:token  (public – no auth)
  router.get('/consulta/:token', async (req, res) => {
    const result = await svc.getDeclaracionByToken(req.params.token)
    send(res, result)
  })

  return router
}
