import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import {
  listDeclaracionesAll,
  updateEstadoDeclaracion,
  deleteDeclaracion,
  updateDeclaracion,
  assignUserAccount,
  getUserByDniNie,
  uploadRentaPdf,
  getPreguntas,
} from './apiClient.js'
import { downloadRentaPdf } from './pdfUtils.js'
import { translateYN } from './i18nUtils.js'
import PreguntasFormularioAdminTab from './PreguntasFormularioAdminTab.jsx'
import UsuariosAdminTab from './UsuariosAdminTab.jsx'
import IdiomasAdminTab from './IdiomasAdminTab.jsx'
import TraduccionesAdminTab from './TraduccionesAdminTab.jsx'
import Pagination from './Pagination.jsx'


const ESTADOS = ['recibido', 'en_revision', 'documentacion_pendiente', 'completado', 'archivado']

const ESTADO_T_KEYS = {
  recibido: 'estadoRecibido',
  en_revision: 'estadoEnRevision',
  documentacion_pendiente: 'estadoDocumentacionPendiente',
  completado: 'estadoCompletado',
  archivado: 'estadoArchivado',
}

const ESTADO_CLASS = {
  recibido: 'badge-blue',
  en_revision: 'badge-yellow',
  documentacion_pendiente: 'badge-orange',
  completado: 'badge-green',
  archivado: 'badge-gray',
}

const ID_CAMPO_T_KEYS = {
  nombre: 'fieldNombre',
  apellidos: 'fieldApellidos',
  dniNie: 'tokenResultDni',
  email: 'tokenResultEmail',
  telefono: 'labelTelefono',
}

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

function buildAdminSecciones(preguntasSecciones, t) {
  const ID_CAMPOS = ['nombre', 'apellidos', 'dniNie', 'email', 'telefono']
  const idLabels = {
    nombre: t('fieldNombre'),
    apellidos: t('fieldApellidos'),
    dniNie: t('tokenResultDni'),
    email: t('tokenResultEmail'),
    telefono: t('labelTelefono'),
  }
  const idSection = {
    titulo: t('section1'),
    campos: ID_CAMPOS,
    labels: idLabels,
  }
  const dynamic = (preguntasSecciones ?? []).map(sec => {
    const labels = {}
    const campos = (sec.preguntas ?? []).map(p => { labels[p.id] = p.texto; return p.id })
    return { titulo: sec.titulo, campos, labels }
  })
  return [idSection, ...dynamic]
}

function downloadDeclaracionPdf(dec, preguntasSecciones, t) {
  const allSections = buildAdminSecciones(preguntasSecciones, t)
  const YN_ES = { si: t('yes'), no: t('no') }
  const ESTADO_ES = {
    recibido: t('estadoRecibido'),
    en_revision: t('estadoEnRevision'),
    documentacion_pendiente: t('estadoDocumentacionPendiente'),
    completado: t('estadoCompletado'),
    archivado: t('estadoArchivado'),
  }

  const rows = allSections.flatMap(sec => {
    const camposVisibles = sec.campos
      .map(c => [c, dec[c]])
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (!camposVisibles.length) return []
    return [
      `<tr><td colspan="2" class="sec-header">${escHtml(sec.titulo)}</td></tr>`,
      ...camposVisibles.map(
        ([c, v]) => `<tr><td class="lbl">${escHtml((sec.labels && sec.labels[c]) ? sec.labels[c] : c)}</td><td class="val">${escHtml(YN_ES[v] ?? v)}</td></tr>`
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
  Estado: <strong>${escHtml(ESTADO_ES[dec.estado] ?? dec.estado)}</strong> &nbsp;·&nbsp;
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
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('declaraciones')
  const [declaraciones, setDeclaraciones] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDni, setFiltroDni] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 10

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

  const [preguntasSecciones, setPreguntasSecciones] = useState([])

  // PDF de la renta
  const [uploadingPdfId, setUploadingPdfId] = useState(null)
  const pdfInputRefs = useRef({})

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    getPreguntas().then(({ data }) => setPreguntasSecciones(data?.secciones ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    listDeclaracionesAll({
      query: {
        ...(filtroEstado && { estado: filtroEstado }),
        ...(filtroDni && { dniNie: filtroDni }),
        page,
        limit,
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
  }, [filtroEstado, filtroDni, page, refreshKey])

  const handleEstadoChange = async (dec, nuevoEstado) => {
    const { error: apiErr } = await updateEstadoDeclaracion({
      path: { id: dec.id },
      body: { estado: nuevoEstado },
    })
    if (apiErr) { showToast(`Error al actualizar: ${apiErr.message}`, 'error'); return }
    setDeclaraciones(prev =>
      prev.map(d => d.id === dec.id ? { ...d, estado: nuevoEstado, actualizadoEn: new Date().toISOString() } : d)
    )
    showToast(`Estado actualizado a "${t(ESTADO_T_KEYS[nuevoEstado] ?? nuevoEstado)}"`)
  }

  const handleDelete = async (id) => {
    setConfirmDelete(null)
    const { error: apiErr } = await deleteDeclaracion({ path: { id } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    setExpanded(null)
    showToast('Declaración eliminada correctamente')
    refresh()
  }

  const openEditModal = (dec) => {
    const dynamicFields = {}
    for (const sec of preguntasSecciones) {
      for (const p of sec.preguntas ?? []) {
        dynamicFields[p.id] = dec[p.id] ?? ''
      }
    }
    setEditForm({
      nombre: dec.nombre ?? '',
      apellidos: dec.apellidos ?? '',
      dniNie: dec.dniNie ?? '',
      email: dec.email ?? '',
      telefono: dec.telefono ?? '',
      ...dynamicFields,
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

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="logo">{t('logoText')}</div>
          <nav className="header-nav">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
              📋 Formulario
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => { logout(); onNavigate('#/backend_admin') }}>
              🚪 Cerrar sesión
            </button>
          </nav>
        </div>
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
          <button
            type="button"
            className={`admin-tab${activeTab === 'traducciones' ? ' active' : ''}`}
            onClick={() => setActiveTab('traducciones')}
          >
            📝 Traducciones
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

        {activeTab === 'usuarios' && (
          <UsuariosAdminTab showToast={showToast} preguntasSecciones={preguntasSecciones} />
        )}

        {activeTab === 'idiomas' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px', color: '#333' }}>
              🌐 Idiomas y traducciones
            </h2>
            <p style={{ fontSize: '.82rem', color: '#666', margin: '0 0 16px' }}>
              Gestiona los idiomas disponibles y las traducciones de la interfaz.
            </p>
            <IdiomasAdminTab showToast={showToast} />
          </>
        )}

        {activeTab === 'traducciones' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px', color: '#333' }}>
              📝 Traducciones
            </h2>
            <p style={{ fontSize: '.82rem', color: '#666', margin: '0 0 16px' }}>
              Selecciona un idioma para editar sus traducciones. El panel de edición se mostrará sobre la lista.
            </p>
            <TraduccionesAdminTab showToast={showToast} />
          </>
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
              onChange={e => { setFiltroDni(e.target.value); setPage(1) }}
            />
            <select
              className="admin-filter-select"
              value={filtroEstado}
              onChange={e => { setFiltroEstado(e.target.value); setPage(1) }}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{t(ESTADO_T_KEYS[e] ?? e)}</option>
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
                      {t(ESTADO_T_KEYS[dec.estado] ?? dec.estado)}
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
                          <option key={e} value={e}>{t(ESTADO_T_KEYS[e] ?? e)}</option>
                        ))}
                      </select>
                      <span className="admin-updated">Actualizado: {formatFecha(dec.actualizadoEn)}</span>
                    </div>

                    {/* Data section 1: Identification (static) */}
                    {['nombre', 'apellidos', 'dniNie', 'email', 'telefono'].some(c => dec[c] !== undefined && dec[c] !== null) && (
                      <div>
                        <div className="section-title">{t('section1')}</div>
                        <table className="respuestas-table">
                          <tbody>
                            {['nombre', 'apellidos', 'dniNie', 'email', 'telefono'].map(campo => {
                              const val = dec[campo]
                              if (val === undefined || val === null) return null
                              return (
                                <tr key={campo}>
                                  <td className="campo-label">{t(ID_CAMPO_T_KEYS[campo] ?? campo)}</td>
                                  <td className="campo-valor">{val}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Dynamic question sections from DB */}
                    {preguntasSecciones.map(sec => {
                      const preguntasConValor = (sec.preguntas ?? []).filter(p => dec[p.id] !== undefined && dec[p.id] !== null)
                      if (!preguntasConValor.length) return null
                      return (
                        <div key={sec.id}>
                          <div className="section-title">{sec.titulo}</div>
                          <table className="respuestas-table">
                            <tbody>
                              {preguntasConValor.map(pregunta => (
                                <tr key={pregunta.id}>
                                  <td className="campo-label">{pregunta.texto}</td>
                                  <td className="campo-valor">{translateYN(dec[pregunta.id], t)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}

                    {/* Section 7: PDF de la Renta (admin) */}
                    <div>
                      <div className="section-title">7. PDF de la Renta</div>
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
                        onClick={() => downloadDeclaracionPdf(dec, preguntasSecciones, t)}
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
        <Pagination
          page={page}
          totalPages={Math.ceil(total / limit)}
          onPageChange={setPage}
        />
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && createPortal(
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
      , document.body)}

      {/* Edit declaration modal */}
      {editModal && createPortal(
        <div className="admin-modal-overlay" onClick={() => setEditModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">✏️ Editar declaración</h2>
            <p className="admin-modal-desc">
              Declaración <strong>#{editModal.id.slice(0, 8)}…</strong>
            </p>
            <div className="form-grid">
              {[
                { name: 'nombre', labelKey: 'fieldNombre', type: 'text' },
                { name: 'apellidos', labelKey: 'fieldApellidos', type: 'text' },
                { name: 'dniNie', labelKey: 'tokenResultDni', type: 'text' },
                { name: 'email', labelKey: 'tokenResultEmail', type: 'email' },
                { name: 'telefono', labelKey: 'labelTelefono', type: 'tel' },
              ].map(({ name, labelKey, type }) => (
                <div className="field" key={name}>
                  <label>{t(labelKey)}</label>
                  <input
                    type={type}
                    value={editForm[name] ?? ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {preguntasSecciones.flatMap(sec => sec.preguntas ?? []).map(pregunta => (
              <div className="question-row" key={pregunta.id}>
                <span className="question-text" style={{ flex: 1 }}>{pregunta.texto}</span>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`edit-${pregunta.id}`}
                      value="si"
                      checked={editForm[pregunta.id] === 'si'}
                      onChange={() => setEditForm(prev => ({ ...prev, [pregunta.id]: 'si' }))}
                    /> Sí
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`edit-${pregunta.id}`}
                      value="no"
                      checked={editForm[pregunta.id] === 'no'}
                      onChange={() => setEditForm(prev => ({ ...prev, [pregunta.id]: 'no' }))}
                    /> No
                  </label>
                </div>
              </div>
            ))}
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
      , document.body)}

      {/* Assign user account modal */}
      {assignModal && createPortal(
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
      , document.body)}

      {toast && createPortal(
        <div className={`toast ${toast.type}`} role="alert">{toast.msg}</div>,
        document.body
      )}
    </>
  )
}
