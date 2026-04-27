'use strict'

// ---------------------------------------------------------------------------
//  PDF generator – builds a PDF document with the personal data of a
//  declaracion and the answers given to the questionnaire.  Used to attach
//  the questionnaire to the confirmation email sent to the contributor and
//  to the admin notification email.
// ---------------------------------------------------------------------------

let PDFDocument
try {
  // Lazy require so the rest of the service module still loads even if the
  // optional dependency is missing in some deployment environments.
  // eslint-disable-next-line global-require
  PDFDocument = require('pdfkit')
} catch (err) {
  console.warn('[pdfGenerator] pdfkit not available:', err.message)
  PDFDocument = null
}

const YN_LABELS = { si: 'Sí', no: 'No' }

const PERSONAL_FIELDS = [
  ['nombre', 'Nombre'],
  ['apellidos', 'Apellidos'],
  ['dniNie', 'DNI / NIE'],
  ['email', 'Correo electrónico'],
  ['telefono', 'Teléfono'],
]

function formatFecha(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

function isAvailable() {
  return Boolean(PDFDocument)
}

/**
 * Build a PDF document for a declaracion and return it as a Buffer.
 *
 * @param {Object} dec      Declaracion object (with personal fields and answers spread as `dec[campo]`).
 * @param {Array}  preguntas Array of `{ campo, texto }` describing the questionnaire.
 * @returns {Promise<Buffer>}
 */
function generateDeclaracionPDFBuffer(dec, preguntas = []) {
  if (!isAvailable()) {
    return Promise.reject(new Error('pdfkit not available'))
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // ── Header
      doc
        .fontSize(18)
        .fillColor('#1e4078')
        .font('Helvetica-Bold')
        .text('NH Gestión Integral', { align: 'left' })
      doc
        .fontSize(11)
        .fillColor('#444')
        .font('Helvetica')
        .text('Campaña Renta 2025 – Cuestionario para Expediente Fiscal')
      doc
        .fontSize(9)
        .fillColor('#888')
        .text(`Generado: ${formatFecha(new Date().toISOString())}`)
      doc.moveDown(1)

      // ── Declaration metadata
      doc
        .fontSize(12)
        .fillColor('#1e4078')
        .font('Helvetica-Bold')
        .text('Declaración')
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#c8d2e6').stroke()
      doc.moveDown(0.3)

      doc.fontSize(10).fillColor('#333').font('Helvetica')
      if (dec.id) doc.text(`ID: ${dec.id}`)
      if (dec.estado) doc.text(`Estado: ${dec.estado}`)
      if (dec.creadoEn) doc.text(`Enviado: ${formatFecha(dec.creadoEn)}`)
      doc.moveDown(0.8)

      // ── Personal data
      doc
        .fontSize(12)
        .fillColor('#1e4078')
        .font('Helvetica-Bold')
        .text('1. Datos de Identificación')
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#c8d2e6').stroke()
      doc.moveDown(0.3)

      doc.fontSize(10).fillColor('#333').font('Helvetica')
      for (const [campo, label] of PERSONAL_FIELDS) {
        const v = dec[campo]
        if (v === undefined || v === null || v === '') continue
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true })
        doc.font('Helvetica').text(String(v))
      }
      doc.moveDown(0.8)

      // ── Questionnaire answers
      doc
        .fontSize(12)
        .fillColor('#1e4078')
        .font('Helvetica-Bold')
        .text('2. Respuestas del cuestionario')
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#c8d2e6').stroke()
      doc.moveDown(0.3)

      doc.fontSize(10).fillColor('#333').font('Helvetica')

      const respuestas = (preguntas ?? []).filter(
        (p) => dec[p.campo] !== undefined && dec[p.campo] !== null && dec[p.campo] !== ''
      )

      if (respuestas.length === 0) {
        doc.fillColor('#888').text('No se han registrado respuestas.')
      } else {
        for (const p of respuestas) {
          const raw = dec[p.campo]
          const val = YN_LABELS[raw] ?? String(raw)
          doc.font('Helvetica-Bold').fillColor('#333').text(p.texto || p.campo)
          doc.font('Helvetica').fillColor('#555').text(`Respuesta: ${val}`)
          doc.moveDown(0.4)
        }
      }

      // ── Footer
      doc
        .fontSize(8)
        .fillColor('#888')
        .text(
          'NH Gestión Integral · Campaña Renta 2025',
          50,
          doc.page.height - 40,
          { align: 'center', width: doc.page.width - 100 }
        )

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

function buildPdfFilename(dec) {
  const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_')
  const parts = ['declaracion']
  if (dec.nombre) parts.push(safe(dec.nombre))
  if (dec.dniNie) parts.push(safe(dec.dniNie))
  return parts.join('_') + '.pdf'
}

module.exports = {
  generateDeclaracionPDFBuffer,
  buildPdfFilename,
  isAvailable,
}
