'use strict'

const { Router } = require('express')
const rateLimit = require('express-rate-limit')

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
})

/** Sends a service result as an HTTP response. */
function send(res, result) {
  if (result.error) {
    const status = result.status || 400
    return res.status(status).json({ error: result.error.message })
  }
  return res.status(result.status || 200).json(result.data)
}

module.exports = function authRoutes(svc) {
  // POST /v1/auth/admin-login
  router.post('/admin-login', authLimiter, async (req, res) => {
    const { username, password } = req.body ?? {}
    if (!username || !password) {
      return res.status(400).json({ error: 'username y password son obligatorios' })
    }
    const result = await svc.loginAdmin({ username, password })
    send(res, result)
  })

  // POST /v1/auth/change-password
  // Sólo se usa para cambiar la contraseña del administrador.
  router.post('/change-password', async (req, res) => {
    const { username, oldPassword, newPassword } = req.body ?? {}
    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'username, oldPassword y newPassword son obligatorios' })
    }
    const result = await svc.changePassword({ username, oldPassword, newPassword })
    send(res, result)
  })

  // POST /v1/auth/change-email
  // Sólo se usa para cambiar el email del administrador.
  router.post('/change-email', authLimiter, async (req, res) => {
    const { username, newEmail } = req.body ?? {}
    if (!username || !newEmail) {
      return res.status(400).json({ error: 'username y newEmail son obligatorios' })
    }
    const result = await svc.changeEmail({ username, newEmail })
    send(res, result)
  })

  return router
}
