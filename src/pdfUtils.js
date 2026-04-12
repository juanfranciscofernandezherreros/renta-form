import { jsPDF } from 'jspdf'

const YN_LABELS = { si: 'Sí', no: 'No' }

const CAMPOS_LABELS = {
  nombre: 'Nombre',
  apellidos: 'Apellidos',
  dniNie: 'DNI / NIE',
  email: 'Correo electrónico',
  telefono: 'Teléfono',
  viviendaAlquiler: '¿Vive de alquiler?',
  alquilerMenos35: '¿Alquiler inferior al 35% de ingresos?',
  viviendaPropiedad: '¿Tiene vivienda en propiedad?',
  propiedadAntes2013: '¿Adquirida antes de 2013?',
  pisosAlquiladosTerceros: '¿Tiene pisos alquilados a terceros?',
  segundaResidencia: '¿Tiene segunda residencia?',
  familiaNumerosa: '¿Familia numerosa?',
  ayudasGobierno: '¿Ha recibido ayudas del gobierno?',
  mayores65ACargo: '¿Tiene mayores de 65 años a cargo?',
  mayoresConviven: '¿Conviven con usted?',
  hijosMenores26: '¿Tiene hijos menores de 26 años?',
  ingresosJuego: '¿Ha obtenido ingresos por juego?',
  ingresosInversiones: '¿Ha obtenido ingresos por inversiones?',
  comentarios: 'Comentarios',
}

const SECCIONES = [
  { titulo: '1. Datos de Identificación', campos: ['nombre', 'apellidos', 'dniNie', 'email', 'telefono'] },
  { titulo: '2. Situación de Vivienda', campos: ['viviendaAlquiler', 'alquilerMenos35', 'viviendaPropiedad', 'propiedadAntes2013', 'pisosAlquiladosTerceros', 'segundaResidencia'] },
  { titulo: '3. Cargas Familiares y Ayudas Públicas', campos: ['familiaNumerosa', 'ayudasGobierno', 'mayores65ACargo', 'mayoresConviven', 'hijosMenores26'] },
  { titulo: '4. Ingresos Extraordinarios e Inversiones', campos: ['ingresosJuego', 'ingresosInversiones'] },
  { titulo: '6. Información Adicional', campos: ['comentarios'] },
]

const ESTADO_LABELS = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  documentacion_pendiente: 'Documentación pendiente',
  completado: 'Completado',
  archivado: 'Archivado',
}

function formatFecha(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const CONTENT_W = PAGE_W - MARGIN * 2
const LINE_H = 7

function addPageIfNeeded(doc, y) {
  if (y > PAGE_H - MARGIN - LINE_H) {
    doc.addPage()
    return MARGIN
  }
  return y
}

export function generateDeclaracionPDF(dec) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = MARGIN

  // Header background
  doc.setFillColor(30, 64, 120)
  doc.rect(0, 0, PAGE_W, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('NH Gestión Integral', MARGIN, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Campaña Renta 2025 - Cuestionario para Expediente Fiscal', MARGIN, 19)
  doc.setFontSize(8)
  doc.text(`Generado: ${formatFecha(new Date().toISOString())}`, PAGE_W - MARGIN, 19, { align: 'right' })

  y = 36

  // Declaration metadata card
  doc.setTextColor(30, 64, 120)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DECLARACIÓN', MARGIN, y)

  y += 5
  doc.setDrawColor(200, 210, 230)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 5

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const estado = ESTADO_LABELS[dec.estado] ?? dec.estado ?? '-'
  doc.setFont('helvetica', 'bold')
  doc.text('ID:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dec.id ?? '-', MARGIN + 12, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Estado:', PAGE_W / 2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(estado, PAGE_W / 2 + 16, y)
  y += LINE_H

  doc.setFont('helvetica', 'bold')
  doc.text('Enviado:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(formatFecha(dec.creadoEn), MARGIN + 18, y)
  if (dec.actualizadoEn && dec.actualizadoEn !== dec.creadoEn) {
    doc.setFont('helvetica', 'bold')
    doc.text('Actualizado:', PAGE_W / 2, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatFecha(dec.actualizadoEn), PAGE_W / 2 + 25, y)
  }
  y += LINE_H + 3

  // Sections
  for (const seccion of SECCIONES) {
    const camposConValor = seccion.campos.filter(c => dec[c] !== undefined && dec[c] !== null && dec[c] !== '')
    if (camposConValor.length === 0) continue

    y = addPageIfNeeded(doc, y)

    // Section heading
    doc.setFillColor(240, 244, 252)
    doc.rect(MARGIN, y - 4, CONTENT_W, LINE_H, 'F')
    doc.setTextColor(30, 64, 120)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(seccion.titulo, MARGIN + 2, y)
    y += LINE_H - 1

    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    for (const campo of camposConValor) {
      y = addPageIfNeeded(doc, y)
      const label = CAMPOS_LABELS[campo] ?? campo
      const rawVal = dec[campo]
      const val = YN_LABELS[rawVal] ?? String(rawVal)
      const labelW = 80

      doc.setFont('helvetica', 'bold')
      doc.text(label + ':', MARGIN + 4, y)
      doc.setFont('helvetica', 'normal')

      const lines = doc.splitTextToSize(val, CONTENT_W - labelW - 4)
      doc.text(lines, MARGIN + labelW, y)
      y += LINE_H * lines.length
    }

    y += 3
  }

  // Documents section
  if (dec.documentos?.length > 0) {
    y = addPageIfNeeded(doc, y)

    doc.setFillColor(240, 244, 252)
    doc.rect(MARGIN, y - 4, CONTENT_W, LINE_H, 'F')
    doc.setTextColor(30, 64, 120)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('5. Documentación Adjunta', MARGIN + 2, y)
    y += LINE_H - 1

    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    for (const doc_ of dec.documentos) {
      y = addPageIfNeeded(doc, y)
      const sizeKb = Math.round((doc_.tamanyo ?? 0) / 1024)
      doc.text(`- ${doc_.nombreOriginal}  (${doc_.mimeType ?? ''} · ${sizeKb} KB)`, MARGIN + 4, y)
      y += LINE_H
    }
    y += 3
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(200, 210, 230)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)
    doc.setTextColor(130, 130, 130)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('NH Gestión Integral · Agencia Tributaria · www.agenciatributaria.es · Campaña Renta 2025', MARGIN, PAGE_H - 7)
    doc.text(`Página ${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' })
  }

  const nombre = dec.nombre ? `_${dec.nombre.replace(/\s+/g, '_')}` : ''
  const dniNie = dec.dniNie ? `_${dec.dniNie}` : ''
  doc.save(`declaracion${nombre}${dniNie}.pdf`)
}
