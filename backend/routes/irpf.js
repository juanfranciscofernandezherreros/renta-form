'use strict'

const { Router } = require('express')
const multer = require('multer')

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed',
])

function multerFileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Se admiten PDF, JPG, PNG y ZIP.`))
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: multerFileFilter,
})

const uploadFields = upload.fields([
  { name: 'docDniAnverso', maxCount: 1 },
  { name: 'docDniReverso', maxCount: 1 },
  { name: 'docAdicional', maxCount: 10 },
])

/** Wraps multer so that file-type/size errors are returned as JSON 400. */
function uploadMiddleware(req, res, next) {
  uploadFields(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}

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

  // POST /v1/irpf/declaraciones  (multipart)
  router.post('/declaraciones', uploadMiddleware, async (req, res) => {
    const result = await svc.createDeclaracion(req.body, req.files ?? {})
    send(res, result)
  })

  // GET /v1/irpf/documentos/:docId  (download attachment)
  router.get('/documentos/:docId', async (req, res) => {
    const result = await svc.getDocumento(req.params.docId)
    if (result.error) {
      const status = result.status || (result.data === null ? 404 : 400)
      return res.status(status).json({ error: result.error.message })
    }
    const { nombreOriginal, mimeType, contenido } = result.data
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nombreOriginal)}`)
    res.send(contenido)
  })

  // GET /v1/irpf/declaraciones/:id/preguntas
  router.get('/declaraciones/:id/preguntas', async (req, res) => {
    const result = await svc.getDeclaracionPreguntas(req.params.id)
    send(res, result)
  })

  // PUT /v1/irpf/declaraciones/:id/preguntas
  router.put('/declaraciones/:id/preguntas', async (req, res) => {
    const { asignaciones } = req.body ?? {}
    const result = await svc.upsertDeclaracionPreguntas(req.params.id, asignaciones)
    send(res, result)
  })

  // DELETE /v1/irpf/declaraciones/:id/preguntas/:preguntaId
  router.delete('/declaraciones/:id/preguntas/:preguntaId', async (req, res) => {
    const result = await svc.removeDeclaracionPregunta(req.params.id, req.params.preguntaId)
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

  // PUT /v1/irpf/declaraciones/:id  (update all fields, optional multipart)
  router.put('/declaraciones/:id', uploadMiddleware, async (req, res) => {
    const result = await svc.updateDeclaracion(req.params.id, req.body ?? {}, req.files ?? {})
    send(res, result)
  })

  // DELETE /v1/irpf/documentos/:docId  (delete a single attachment)
  router.delete('/documentos/:docId', async (req, res) => {
    const result = await svc.deleteDocumento(req.params.docId)
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
