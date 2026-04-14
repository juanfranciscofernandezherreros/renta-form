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
  // POST /v1/auth/login
  router.post('/login', authLimiter, async (req, res) => {
    const { dniNie, password } = req.body ?? {}
    if (!dniNie || !password) {
      return res.status(400).json({ error: 'dniNie y password son obligatorios' })
    }
    const result = await svc.loginUser({ dniNie, password })
    send(res, result)
  })

  // POST /v1/auth/change-password
  router.post('/change-password', async (req, res) => {
    const { dniNie, oldPassword, newPassword } = req.body ?? {}
    if (!dniNie || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'dniNie, oldPassword y newPassword son obligatorios' })
    }
    const result = await svc.changePassword({ dniNie, oldPassword, newPassword })
    send(res, result)
  })

  return router
}
