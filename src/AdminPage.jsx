import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext.jsx'
import {
  listDeclaracionesAll,
  updateEstadoDeclaracion,
  deleteDeclaracion,
  sendEmailDeclaracion,
  updateDeclaracion,
  assignUserAccount,
  getUserByDniNie,
  uploadRentaPdf,
  getDocumentoUrl,
  deleteDocumento,
} from './apiClient.js'
import { downloadRentaPdf } from './pdfUtils.js'
import PreguntasFormularioAdminTab from './PreguntasFormularioAdminTab.jsx'
import SeccionesAdminTab from './SeccionesAdminTab.jsx'
import UsuariosAdminTab from './UsuariosAdminTab.jsx'
import IdiomasAdminTab from './IdiomasAdminTab.jsx'

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
<h1>🏛️ NH Gestión Integral – Cuestionario IRPF 2025</h1>
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
  const [activeTab, setActiveTab] = useState('declaraciones')
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

  // Edit declaration modal
  const [editModal, setEditModal] = useState(null) // declaration object being edited
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  // Assign user account modal
  const [assignModal, setAssignModal] = useState(null) // declaration object
  const [assignPassword, setAssignPassword] = useState('')
  const [assignPassword2, setAssignPassword2] = useState('')
  const [assignExistingUser, setAssignExistingUser] = useState(null)
  const [assignSaving, setAssignSaving] = useState(false)

  // PDF de la renta
  const [uploadingPdfId, setUploadingPdfId] = useState(null)
  const pdfInputRefs = useRef({})

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

  const openEditModal = (dec) => {
    setEditForm({
      nombre: dec.nombre ?? '',
      apellidos: dec.apellidos ?? '',
      dniNie: dec.dniNie ?? '',
      email: dec.email ?? '',
      telefono: dec.telefono ?? '',
      viviendaAlquiler: dec.viviendaAlquiler ?? '',
      alquilerMenos35: dec.alquilerMenos35 ?? '',
      viviendaPropiedad: dec.viviendaPropiedad ?? '',
      propiedadAntes2013: dec.propiedadAntes2013 ?? '',
      pisosAlquiladosTerceros: dec.pisosAlquiladosTerceros ?? '',
      segundaResidencia: dec.segundaResidencia ?? '',
      familiaNumerosa: dec.familiaNumerosa ?? '',
      ayudasGobierno: dec.ayudasGobierno ?? '',
      mayores65ACargo: dec.mayores65ACargo ?? '',
      mayoresConviven: dec.mayoresConviven ?? '',
      hijosMenores26: dec.hijosMenores26 ?? '',
      ingresosJuego: dec.ingresosJuego ?? '',
      ingresosInversiones: dec.ingresosInversiones ?? '',
      comentarios: dec.comentarios ?? '',
    })
    setEditModal(dec)
  }

  const handleEditSave = async () => {
    if (!editModal) return
    setEditSaving(true)
    const { data, error: apiErr } = await updateDeclaracion({
      path: { id: editModal.id },
      body: editForm,
    })
    setEditSaving(false)
    if (apiErr) { showToast(`Error al guardar: ${apiErr.message}`, 'error'); return }
    setDeclaraciones(prev => prev.map(d => d.id === editModal.id ? data : d))
    setEditModal(null)
    showToast('Declaración actualizada correctamente')
  }

  const openAssignModal = async (dec) => {
    setAssignPassword('')
    setAssignPassword2('')
    setAssignExistingUser(null)
    setAssignModal(dec)
    const { data } = await getUserByDniNie({ dniNie: dec.dniNie })
    setAssignExistingUser(data)
  }

  const handleAssignSave = async () => {
    if (!assignModal) return
    if (!assignPassword) { showToast('La contraseña no puede estar vacía', 'error'); return }
    if (assignPassword !== assignPassword2) { showToast('Las contraseñas no coinciden', 'error'); return }
    setAssignSaving(true)
    const { data, error: apiErr } = await assignUserAccount({
      dniNie: assignModal.dniNie,
      password: assignPassword,
      declaracionId: assignModal.id,
    })
    setAssignSaving(false)
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    setAssignModal(null)
    showToast(data?.created
      ? `✅ Cuenta creada para ${assignModal.dniNie}`
      : `🔑 Contraseña actualizada para ${assignModal.dniNie}`)
  }

  const handlePdfFileChange = async (e, decId) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      showToast('Solo se admiten archivos PDF', 'error')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('El archivo no puede superar 10 MB', 'error')
      e.target.value = ''
      return
    }
    setUploadingPdfId(decId)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result)
        reader.onerror = () => reject(new Error('Error al leer el archivo'))
        reader.readAsDataURL(file)
      })
      const { data, error: apiErr } = await uploadRentaPdf({ declaracionId: decId, nombre: file.name, dataUrl })
      if (apiErr) { showToast(`Error al adjuntar PDF: ${apiErr.message}`, 'error'); return }
      setDeclaraciones(prev => prev.map(d => d.id === decId ? data : d))
      showToast('✅ PDF de la renta adjuntado correctamente')
    } catch {
      showToast('Error al leer el archivo', 'error')
    } finally {
      setUploadingPdfId(null)
      e.target.value = ''
    }
  }

  const handleRemoveRentaPdf = async (decId) => {
    try {
      const { data, error: apiErr } = await uploadRentaPdf({ declaracionId: decId, nombre: null, dataUrl: null })
      if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
      setDeclaraciones(prev => prev.map(d => d.id === decId ? data : d))
      showToast('PDF de la renta eliminado')
    } catch {
      showToast('Error al eliminar el PDF', 'error')
    }
  }

  const handleDeleteDocumento = async (decId, docId) => {
    if (!window.confirm('¿Eliminar este documento?')) return
    const { error: apiErr } = await deleteDocumento({ path: { docId } })
    if (apiErr) { showToast(`Error al eliminar documento: ${apiErr.message}`, 'error'); return }
    setDeclaraciones(prev =>
      prev.map(d =>
        d.id === decId
          ? { ...d, documentos: (d.documentos ?? []).filter(doc => doc.id !== docId) }
          : d
      )
    )
    showToast('Documento eliminado')
  }

  return (
    <>
      <header>
        <div className="logo">NH Gestión Integral</div>
        <div className="header-text">
          <h1>Panel de Administración</h1>
          <p>Gestión de declaraciones IRPF 2025 · Usuario: {user?.dniNie}</p>
        </div>
        <nav className="header-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
            📋 Formulario
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => { logout(); onNavigate('#/admin') }}>
            🚪 Cerrar sesión
          </button>
        </nav>
      </header>

      <div className="card">
        {/* Tabs */}
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab${activeTab === 'declaraciones' ? ' active' : ''}`}
            onClick={() => setActiveTab('declaraciones')}
          >
            📋 Declaraciones
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === 'preguntas' ? ' active' : ''}`}
            onClick={() => setActiveTab('preguntas')}
          >
            ❓ Preguntas
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === 'secciones' ? ' active' : ''}`}
            onClick={() => setActiveTab('secciones')}
          >
            📂 Secciones
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === 'usuarios' ? ' active' : ''}`}
            onClick={() => setActiveTab('usuarios')}
          >
            👥 Usuarios
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === 'idiomas' ? ' active' : ''}`}
            onClick={() => setActiveTab('idiomas')}
          >
            🌐 Idiomas
          </button>
        </div>

        {activeTab === 'preguntas' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px', color: '#333' }}>
              ❓ Preguntas del formulario
            </h2>
            <p style={{ fontSize: '.82rem', color: '#666', margin: '0 0 16px' }}>
              Gestiona las preguntas que aparecen en el formulario de declaración de la renta.
            </p>
            <PreguntasFormularioAdminTab showToast={showToast} />
          </>
        )}

        {activeTab === 'secciones' && (
          <SeccionesAdminTab showToast={showToast} />
        )}

        {activeTab === 'usuarios' && (
          <UsuariosAdminTab showToast={showToast} />
        )}

        {activeTab === 'idiomas' && (
          <IdiomasAdminTab showToast={showToast} />
        )}

        {activeTab === 'declaraciones' && (
          <>
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
                    {/* Full declaration code */}
                    <div className="admin-codigo-row">
                      <span className="admin-codigo-label">Código de declaración:</span>
                      <code className="admin-codigo-value">{dec.id}</code>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => navigator.clipboard.writeText(dec.id).catch(() => {})}
                        title="Copiar código"
                      >
                        📋 Copiar
                      </button>
                    </div>

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
                              <a
                                href={getDocumentoUrl(doc.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="doc-download-link"
                              >
                                📄 {doc.nombreOriginal}
                              </a>
                              <span className="doc-meta">{doc.mimeType} · {Math.round(doc.tamanyo / 1024)} KB</span>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm btn-xs"
                                onClick={() => handleDeleteDocumento(dec.id, doc.id)}
                                style={{ marginLeft: '8px' }}
                                title="Eliminar documento"
                              >
                                🗑️
                              </button>
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

                    {/* Section 7: PDF de la Renta (admin) */}
                    <div>
                      <div className="section-title">8. PDF de la Renta</div>
                      {dec.rentaPdf ? (
                        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span>📄 {dec.rentaPdf.nombre}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-xs"
                            onClick={() => downloadRentaPdf(dec.rentaPdf)}
                            title="Descargar el PDF adjunto"
                          >
                            📥 Descargar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-xs"
                            onClick={() => handleRemoveRentaPdf(dec.id)}
                            title="Eliminar el PDF adjunto"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      ) : (
                        <div style={{ padding: '8px 12px', color: '#888', fontSize: '0.9em' }}>
                          No hay PDF de la renta adjunto.
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="btn-row admin-action-row">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openEditModal(dec)}
                        title="Editar datos del cuestionario"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openAssignModal(dec)}
                        title="Asignar perfil de usuario y contraseña"
                      >
                        👤 Asignar perfil
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => downloadDeclaracionPdf(dec)}
                        title="Abrir vista imprimible / Descargar PDF"
                      >
                        📄 Descargar PDF
                      </button>
                      <label
                        className="btn btn-secondary"
                        style={{ cursor: uploadingPdfId === dec.id ? 'wait' : 'pointer' }}
                        title="Adjuntar el PDF de la renta para que el contribuyente pueda descargarlo"
                      >
                        {uploadingPdfId === dec.id ? '⏳ Subiendo…' : '📎 Adjuntar PDF de la renta'}
                        <input
                          ref={el => { pdfInputRefs.current[dec.id] = el }}
                          type="file"
                          accept=".pdf,application/pdf"
                          style={{ display: 'none' }}
                          disabled={uploadingPdfId === dec.id}
                          onChange={e => handlePdfFileChange(e, dec.id)}
                        />
                      </label>
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
          </>
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

      {/* Edit declaration modal */}
      {editModal && (
        <div className="admin-modal-overlay" onClick={() => setEditModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">✏️ Editar declaración</h2>
            <p className="admin-modal-desc">
              Declaración <strong>#{editModal.id.slice(0, 8)}…</strong>
            </p>
            <div className="form-grid">
              {[
                { name: 'nombre', label: 'Nombre', type: 'text' },
                { name: 'apellidos', label: 'Apellidos', type: 'text' },
                { name: 'dniNie', label: 'DNI / NIE', type: 'text' },
                { name: 'email', label: 'Correo electrónico', type: 'email' },
                { name: 'telefono', label: 'Teléfono', type: 'tel' },
              ].map(({ name, label, type }) => (
                <div className="field" key={name}>
                  <label>{label}</label>
                  <input
                    type={type}
                    value={editForm[name] ?? ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {[
              { name: 'viviendaAlquiler', label: '¿Vive de alquiler?' },
              { name: 'alquilerMenos35', label: '¿Alquiler inferior al 35% de ingresos?' },
              { name: 'viviendaPropiedad', label: '¿Tiene vivienda en propiedad?' },
              { name: 'propiedadAntes2013', label: '¿Adquirida antes de 2013?' },
              { name: 'pisosAlquiladosTerceros', label: '¿Tiene pisos alquilados a terceros?' },
              { name: 'segundaResidencia', label: '¿Tiene segunda residencia?' },
              { name: 'familiaNumerosa', label: '¿Familia numerosa?' },
              { name: 'ayudasGobierno', label: '¿Ha recibido ayudas del gobierno?' },
              { name: 'mayores65ACargo', label: '¿Tiene mayores de 65 años a cargo?' },
              { name: 'mayoresConviven', label: '¿Conviven con usted?' },
              { name: 'hijosMenores26', label: '¿Tiene hijos menores de 26 años?' },
              { name: 'ingresosJuego', label: '¿Ha obtenido ingresos por juego?' },
              { name: 'ingresosInversiones', label: '¿Ha obtenido ingresos por inversiones?' },
            ].map(({ name, label }) => (
              <div className="question-row" key={name}>
                <span className="question-text" style={{ flex: 1 }}>{label}</span>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`edit-${name}`}
                      value="si"
                      checked={editForm[name] === 'si'}
                      onChange={() => setEditForm(prev => ({ ...prev, [name]: 'si' }))}
                    /> Sí
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`edit-${name}`}
                      value="no"
                      checked={editForm[name] === 'no'}
                      onChange={() => setEditForm(prev => ({ ...prev, [name]: 'no' }))}
                    /> No
                  </label>
                </div>
              </div>
            ))}
            <div className="field" style={{ marginTop: 12 }}>
              <label>Comentarios</label>
              <textarea
                value={editForm.comentarios ?? ''}
                onChange={e => setEditForm(prev => ({ ...prev, comentarios: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={editSaving}
                onClick={handleEditSave}
              >
                {editSaving ? 'Guardando…' : '💾 Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign user account modal */}
      {assignModal && (
        <div className="admin-modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">👤 Asignar perfil de usuario</h2>
            <p className="admin-modal-desc">
              Declaración de <strong>{assignModal.nombre} {assignModal.apellidos}</strong><br />
              DNI / NIE (usuario): <strong>{assignModal.dniNie}</strong>
            </p>
            {assignExistingUser ? (
              <div className="info-box" style={{ marginBottom: 12 }}>
                ℹ️ Este DNI/NIE ya tiene una cuenta activa. Puedes cambiar su contraseña.
              </div>
            ) : (
              <div className="info-box" style={{ marginBottom: 12 }}>
                ✨ Se creará una cuenta nueva para <strong>{assignModal.dniNie}</strong>.
              </div>
            )}
            <div className="field">
              <label>{assignExistingUser ? 'Nueva contraseña' : 'Contraseña'}</label>
              <input
                type="password"
                value={assignPassword}
                onChange={e => setAssignPassword(e.target.value)}
                placeholder="Introduce la contraseña…"
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Repetir contraseña</label>
              <input
                type="password"
                value={assignPassword2}
                onChange={e => setAssignPassword2(e.target.value)}
                placeholder="Repite la contraseña…"
                autoComplete="new-password"
              />
            </div>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAssignModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={assignSaving}
                onClick={handleAssignSave}
              >
                {assignSaving ? 'Guardando…' : assignExistingUser ? '🔑 Actualizar contraseña' : '✅ Crear cuenta'}
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
