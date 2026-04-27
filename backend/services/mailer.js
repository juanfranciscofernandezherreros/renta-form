'use strict'

// ---------------------------------------------------------------------------
//  Email service – thin wrapper around nodemailer.
//
//  Configuration is taken from environment variables.  When SMTP is not
//  configured, sendMail() becomes a no-op that just logs the intent, so the
//  rest of the app can call it unconditionally without crashing in dev/CI.
//
//  Required env vars to actually deliver mail:
//    SMTP_HOST   – e.g. smtp.gmail.com
//    SMTP_PORT   – e.g. 587 (defaults to 587)
//    SMTP_USER   – SMTP username
//    SMTP_PASS   – SMTP password / app password
//    MAIL_FROM   – From address (defaults to SMTP_USER)
//  Optional:
//    SMTP_SECURE – 'true' to use TLS on connect (port 465). Default: false
// ---------------------------------------------------------------------------

let nodemailer
try {
  // Lazy require so that environments without the dependency installed
  // (e.g. very old deploys) still load the rest of the service module.
  // eslint-disable-next-line global-require
  nodemailer = require('nodemailer')
} catch (err) {
  console.warn('[mailer] nodemailer not available:', err.message)
  nodemailer = null
}

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER

let transporter = null

function isConfigured() {
  return Boolean(nodemailer && SMTP_HOST && SMTP_USER && SMTP_PASS)
}

function getTransporter() {
  if (!isConfigured()) return null
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

/**
 * Send an email.  Never throws; resolves with `{ sent: boolean, error?: string }`.
 * If SMTP is not configured the call is logged and treated as a successful no-op.
 */
async function sendMail({ to, subject, text, html }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { sent: false, error: 'No recipients' }
  }
  const recipients = Array.isArray(to) ? to.join(', ') : to

  if (!isConfigured()) {
    console.info(`[mailer] SMTP not configured; skipping email to ${recipients} (subject="${subject}")`)
    return { sent: false, skipped: true }
  }

  try {
    const t = getTransporter()
    const info = await t.sendMail({
      from: MAIL_FROM,
      to: recipients,
      subject,
      text,
      html,
    })
    console.info(`[mailer] Sent email to ${recipients} (id=${info.messageId})`)
    return { sent: true, messageId: info.messageId }
  } catch (err) {
    console.error('[mailer] sendMail error:', err.message)
    return { sent: false, error: err.message }
  }
}

module.exports = {
  sendMail,
  isConfigured,
}
