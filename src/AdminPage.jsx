import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext.jsx'
import {
  listDeclaracionesAll,
  updateEstadoDeclaracion,
  deleteDeclaracion,
  sendEmailDeclaracion,
} from './mockApi.js'

const ESTADOS = ['recibido', 'en_revision', 'documentacion_pendiente', 'completado', 'archivado']

const ESTADO_LABELS = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  documentacion_pendiente: 'Documentación pendiente',
  completado: 'Completado',
  archivado: 'Archivado',
}

const ESTADO_CLASS = {
  recibido: 'badge-blue',
  en_revision: 'badge-yellow',
  documentacion_pendiente: 'badge-orange',
  completado: 'badge-green',
  archivado: 'badge-gray',
}

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

const SECCIONES_DATOS = [
  { titulo: '1. Datos de Identificación', campos: ['nombre', 'apellidos', 'dniNie', 'email', 'telefono'] },
  { titulo: '2. Situación de Vivienda', campos: ['viviendaAlquiler', 'alquilerMenos35', 'viviendaPropiedad', 'propiedadAntes2013', 'pisosAlquiladosTerceros', 'segundaResidencia'] },
  { titulo: '3. Cargas Familiares y Ayudas Públicas', campos: ['familiaNumerosa', 'ayudasGobierno', 'mayores65ACargo', 'mayoresConviven', 'hijosMenores26'] },
  { titulo: '4. Ingresos Extraordinarios e Inversiones', campos: ['ingresosJuego', 'ingresosInversiones'] },
]

const SECCION_INFO_ADICIONAL = { titulo: '6. Información Adicional', campos: ['comentarios'] }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function downloadDeclaracionPdf(dec) {
  const allSections = [
    ...SECCIONES_DATOS,
    { titulo: '5. Documentación Adjunta', campos: [] },
    SECCION_INFO_ADICIONAL,
  ]

  const rows = allSections.flatMap(sec => {
    if (sec.campos.length === 0) {
      if (!dec.documentos?.length) return []
      return [
        `<tr><td colspan="2" class="sec-header">${escHtml(sec.titulo)}</td></tr>`,
        ...dec.documentos.map(
          doc => `<tr><td class="lbl">📄 ${escHtml(doc.nombreOriginal)}</td><td class="val">${escHtml(doc.mimeType)} · ${Math.round(doc.tamanyo / 1024)} KB</td></tr>`
        ),
      ]
    }
    const camposVisibles = sec.campos
      .map(c => [c, dec[c]])
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (!camposVisibles.length) return []
    return [
      `<tr><td colspan="2" class="sec-header">${escHtml(sec.titulo)}</td></tr>`,
      ...camposVisibles.map(
        ([c, v]) => `<tr><td class="lbl">${escHtml(CAMPOS_LABELS[c] ?? c)}</td><td class="val">${escHtml(YN_LABELS[v] ?? v)}</td></tr>`
      ),
    ]
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Declaración ${escHtml(dec.id.slice(0, 8))}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 32px; }
  h1 { font-size: 18px; color: #003087; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  .sec-header { background: #003087; color: #fff; font-weight: bold; font-size: 12px; padding: 8px 10px; }
  .lbl { color: #555; width: 55%; }
  .val { font-weight: bold; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>🏛️ AEAT – Cuestionario IRPF 2025</h1>
<div class="meta">
  Declaración: <strong>${escHtml(dec.id)}</strong> &nbsp;·&nbsp;
  Estado: <strong>${escHtml(ESTADO_LABELS[dec.estado] ?? dec.estado)}</strong> &nbsp;·&nbsp;
  Enviada: <strong>${escHtml(formatFecha(dec.creadoEn))}</strong> &nbsp;·&nbsp;
  Última actualización: <strong>${escHtml(formatFecha(dec.actualizadoEn))}</strong>
</div>
<table>${rows}</table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

export default function AdminPage({ onNavigate }) {
  const { user, logout } = useAuth()
  const [declaraciones, setDeclaraciones] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDni, setFiltroDni] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [toast, setToast] = useState(null)
  const [emailModal, setEmailModal] = useState(null)
  const [emailMsg, setEmailMsg] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    listDeclaracionesAll({
      query: {
        ...(filtroEstado && { estado: filtroEstado }),
        ...(filtroDni && { dniNie: filtroDni }),
        limit: 100,
      },
    })
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setDeclaraciones(data?.data ?? [])
        setTotal(data?.total ?? 0)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filtroEstado, filtroDni, refreshKey])

  const handleEstadoChange = async (dec, nuevoEstado) => {
    const { error: apiErr } = await updateEstadoDeclaracion({
      path: { id: dec.id },
      body: { estado: nuevoEstado },
    })
    if (apiErr) { showToast(`Error al actualizar: ${apiErr.message}`, 'error'); return }
    setDeclaraciones(prev =>
      prev.map(d => d.id === dec.id ? { ...d, estado: nuevoEstado, actualizadoEn: new Date().toISOString() } : d)
    )
    showToast(`Estado actualizado a "${ESTADO_LABELS[nuevoEstado]}"`)
  }

  const handleDelete = async (id) => {
    setConfirmDelete(null)
    const { error: apiErr } = await deleteDeclaracion({ path: { id } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    setExpanded(null)
    showToast('Declaración eliminada correctamente')
    refresh()
  }

  const handleSendEmail = async () => {
    if (!emailModal) return
    setEmailSending(true)
    const { error: apiErr } = await sendEmailDeclaracion({
      declaracionId: emailModal.id,
      email: emailModal.email,
      mensaje: emailMsg || undefined,
    })
    setEmailSending(false)
    setEmailModal(null)
    setEmailMsg('')
    if (apiErr) { showToast(`Error al enviar email: ${apiErr.message}`, 'error'); return }
    showToast(`📧 Email enviado a ${emailModal.email}`)
  }

  return (
    <>
      <header>
        <div className="logo">AEAT</div>
        <div className="header-text">
          <h1>Panel de Administración</h1>
          <p>Gestión de declaraciones IRPF 2025 · Usuario: {user?.dniNie}</p>
        </div>
        <nav className="header-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
            📋 Formulario
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => { logout(); onNavigate('#/login') }}>
            🚪 Cerrar sesión
          </button>
        </nav>
      </header>

      <div className="card">
        <div className="admin-toolbar">
          <div className="admin-stats">
            <span className="admin-stat-badge">{total} declaración{total !== 1 ? 'es' : ''}</span>
          </div>
          <div className="admin-filters">
            <input
              type="text"
              className="admin-filter-input"
              placeholder="Buscar por DNI/NIE…"
              value={filtroDni}
              onChange={e => setFiltroDni(e.target.value)}
            />
            <select
              className="admin-filter-select"
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <div className="info-box">⏳ Cargando declaraciones…</div>}
        {error && <div className="info-box info-box-error">❌ {error}</div>}

        {!loading && !error && declaraciones.length === 0 && (
          <div className="info-box">No se encontraron declaraciones con los filtros aplicados.</div>
        )}

        {!loading && !error && declaraciones.length > 0 && (
          <div className="declaraciones-list">
            {declaraciones.map(dec => (
              <div key={dec.id} className="declaracion-card">
                <div className="declaracion-header" onClick={() => setExpanded(expanded === dec.id ? null : dec.id)}>
                  <div className="declaracion-meta">
                    <span className="declaracion-id">#{dec.id.slice(0, 8)}…</span>
                    <span className={`estado-badge ${ESTADO_CLASS[dec.estado] ?? 'badge-blue'}`}>
                      {ESTADO_LABELS[dec.estado] ?? dec.estado}
                    </span>
                  </div>
                  <div className="admin-dec-info">
                    <span className="admin-dec-name">{dec.nombre} {dec.apellidos}</span>
                    <span className="admin-dec-dni">{dec.dniNie}</span>
                    <span className="admin-dec-email">{dec.email}</span>
                  </div>
                  <div className="declaracion-dates">
                    <span>Enviada: {formatFecha(dec.creadoEn)}</span>
                  </div>
                  <div className="declaracion-toggle">{expanded === dec.id ? '▲' : '▼'}</div>
                </div>

                {expanded === dec.id && (
                  <div className="declaracion-body">
                    {/* Estado inline editor */}
                    <div className="admin-estado-row">
                      <label className="admin-estado-label">Estado del expediente:</label>
                      <select
                        className="admin-estado-select"
                        value={dec.estado}
                        onChange={e => handleEstadoChange(dec, e.target.value)}
                      >
                        {ESTADOS.map(e => (
                          <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                        ))}
                      </select>
                      <span className="admin-updated">Actualizado: {formatFecha(dec.actualizadoEn)}</span>
                    </div>

                    {/* Data sections 1–4 */}
                    {SECCIONES_DATOS.map(sec => {
                      const camposVisibles = sec.campos.filter(c => dec[c] !== undefined && dec[c] !== null)
                      if (!camposVisibles.length) return null
                      return (
                        <div key={sec.titulo}>
                          <div className="section-title">{sec.titulo}</div>
                          <table className="respuestas-table">
                            <tbody>
                              {camposVisibles.map(campo => (
                                <tr key={campo}>
                                  <td className="campo-label">{CAMPOS_LABELS[campo] ?? campo}</td>
                                  <td className="campo-valor">{YN_LABELS[dec[campo]] ?? dec[campo]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}

                    {/* Section 5: Documents */}
                    {dec.documentos?.length > 0 && (
                      <div>
                        <div className="section-title">5. Documentación Adjunta</div>
                        <ul className="documentos-list">
                          {dec.documentos.map(doc => (
                            <li key={doc.id}>
                              📄 {doc.nombreOriginal}
                              <span className="doc-meta">{doc.mimeType} · {Math.round(doc.tamanyo / 1024)} KB</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Section 6: Additional info */}
                    {(() => {
                      const camposVisibles = SECCION_INFO_ADICIONAL.campos.filter(c => dec[c] !== undefined && dec[c] !== null && dec[c] !== '')
                      if (!camposVisibles.length) return null
                      return (
                        <div>
                          <div className="section-title">{SECCION_INFO_ADICIONAL.titulo}</div>
                          <table className="respuestas-table">
                            <tbody>
                              {camposVisibles.map(campo => (
                                <tr key={campo}>
                                  <td className="campo-label">{CAMPOS_LABELS[campo] ?? campo}</td>
                                  <td className="campo-valor">{YN_LABELS[dec[campo]] ?? dec[campo]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}

                    {/* Actions */}
                    <div className="btn-row admin-action-row">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => downloadDeclaracionPdf(dec)}
                        title="Abrir vista imprimible / Descargar PDF"
                      >
                        📄 Descargar PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => { setEmailModal(dec); setEmailMsg('') }}
                        title="Enviar email al contribuyente"
                      >
                        📧 Enviar email
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setConfirmDelete(dec.id)}
                        title="Eliminar declaración"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email modal */}
      {emailModal && (
        <div className="admin-modal-overlay" onClick={() => setEmailModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">📧 Enviar email</h2>
            <p className="admin-modal-desc">
              Destinatario: <strong>{emailModal.nombre} {emailModal.apellidos}</strong><br />
              Correo: <strong>{emailModal.email}</strong>
            </p>
            <div className="field">
              <label>Mensaje (opcional)</label>
              <textarea
                value={emailMsg}
                onChange={e => setEmailMsg(e.target.value)}
                placeholder="Escribe un mensaje personalizado para el contribuyente…"
                rows={4}
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setEmailModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={emailSending}
                onClick={handleSendEmail}
              >
                {emailSending ? 'Enviando…' : '📧 Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar esta declaración? Esta acción no se puede deshacer.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <p>Panel de administración interno · Agencia Tributaria · Campaña Renta 2025</p>
      </footer>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
