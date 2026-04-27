import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import {
  listDeclaracionesAll,
  updateEstadoDeclaracion,
  deleteDeclaracion,
  updateDeclaracion,
  getPreguntas,
} from './apiClient.js'
import { translateYN } from './i18nUtils.js'
import PreguntasFormularioAdminTab from './PreguntasFormularioAdminTab.jsx'
import UsuariosAdminTab from './UsuariosAdminTab.jsx'
import RolesAdminTab from './RolesAdminTab.jsx'
import IdiomasAdminTab from './IdiomasAdminTab.jsx'
import TraduccionesAdminTab from './TraduccionesAdminTab.jsx'
import AjustesAdminTab from './AjustesAdminTab.jsx'
import Pagination from './Pagination.jsx'
import './adminlte.css'


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

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20]

export default function AdminPage({ onNavigate }) {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('declaraciones')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Auto-close the mobile sidebar when the viewport grows back to desktop and
  // lock body scroll while the off-canvas sidebar is open on mobile.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mql = window.matchMedia('(min-width: 992px)')
    const handle = (e) => { if (e.matches) setSidebarOpen(false) }
    if (mql.addEventListener) mql.addEventListener('change', handle)
    else mql.addListener(handle)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handle)
      else mql.removeListener(handle)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const prev = document.body.style.overflow
    if (sidebarOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sidebarOpen])
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
  const [limit, setLimit] = useState(10)

  // Edit declaration modal
  const [editModal, setEditModal] = useState(null) // declaration object being edited
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  const [preguntasSecciones, setPreguntasSecciones] = useState([])

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
  }, [filtroEstado, filtroDni, page, limit, refreshKey])

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

  const SIDEBAR_ITEMS = [
    { key: 'declaraciones', icon: '📋', label: 'Declaraciones' },
    { key: 'preguntas',     icon: '❓', label: 'Preguntas' },
    { key: 'usuarios',      icon: '👥', label: 'Usuarios' },
    { key: 'roles',         icon: '🛡️', label: 'Roles' },
    { key: 'idiomas',       icon: '🌐', label: 'Idiomas' },
    { key: 'traducciones',  icon: '📝', label: 'Traducciones' },
    { key: 'ajustes',       icon: '⚙️', label: 'Ajustes' },
  ]
  const activeMeta = SIDEBAR_ITEMS.find(it => it.key === activeTab) ?? SIDEBAR_ITEMS[0]

  return (
    <div className={`adminlte-wrapper${sidebarOpen ? ' sidebar-open' : ''}`}>
      {/* Top navbar */}
      <nav className="main-header">
        <ul className="navbar-nav">
          <li className="nav-item">
            <button
              type="button"
              className="navbar-toggler"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Mostrar / ocultar el menú lateral"
            >
              ☰
            </button>
          </li>
        </ul>
        <ul className="navbar-nav ml-auto">
          <li className="nav-item">
            <button
              type="button"
              className="nav-link text-danger"
              onClick={() => { logout(); onNavigate('#/backend_admin') }}
            >
              🚪 Cerrar sesión
            </button>
          </li>
        </ul>
      </nav>

      {/* Sidebar */}
      <aside className="main-sidebar">
        <a href="#/backend_admin" className="brand-link">
          <span className="brand-image" aria-hidden="true">🏛️</span>
          <span className="brand-text">{t('logoText')}</span>
        </a>
        <div className="sidebar">
          <ul className="nav-sidebar">
            <li className="nav-header">PANEL</li>
            {SIDEBAR_ITEMS.map(item => (
              <li className="nav-item" key={item.key}>
                <button
                  type="button"
                  className={`nav-link${activeTab === item.key ? ' active' : ''}`}
                  onClick={() => { setActiveTab(item.key); setSidebarOpen(false) }}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Mobile backdrop: tap to close the off-canvas sidebar */}
      <div
        className="sidebar-backdrop"
        role="presentation"
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      {/* Content wrapper */}
      <div className="content-wrapper">
        <div className="content-header">
          <h1>{activeMeta.icon} {activeMeta.label}</h1>
          <ul className="breadcrumb">
            <li><a href="#/backend_admin">Inicio</a></li>
            <li>{activeMeta.label}</li>
          </ul>
        </div>

        <section className="content">
          <div className="card card-primary">
            <div className="card-header">
              <h3 className="card-title">{activeMeta.icon} {activeMeta.label}</h3>
            </div>
            <div className="card-body">


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

        {activeTab === 'roles' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px', color: '#333' }}>
              🛡️ Roles
            </h2>
            <p style={{ fontSize: '.82rem', color: '#666', margin: '0 0 16px' }}>
              Gestiona los roles del sistema. Los usuarios pueden tener varios roles asignados (relación many-to-many).
            </p>
            <RolesAdminTab showToast={showToast} />
          </>
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

        {activeTab === 'ajustes' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px', color: '#333' }}>
              ⚙️ Ajustes
            </h2>
            <p style={{ fontSize: '.82rem', color: '#666', margin: '0 0 16px' }}>
              Cambia la contraseña del usuario administrador con el que has iniciado sesión.
            </p>
            <AjustesAdminTab showToast={showToast} />
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
            <select
              className="admin-filter-select"
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
              title="Elementos por página"
              aria-label="Elementos por página"
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n} / página</option>
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
                        onClick={() => downloadDeclaracionPdf(dec, preguntasSecciones, t)}
                        title="Abrir vista imprimible / Descargar PDF"
                      >
                        📄 Descargar PDF
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
        <Pagination
          page={page}
          totalPages={Math.ceil(total / limit)}
          onPageChange={setPage}
        />
          </>
        )}
            </div>
          </div>
        </section>

        <footer className="main-footer">
          <strong>{t('logoText')}</strong>
          <span>Panel de administración</span>
        </footer>
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

      {toast && createPortal(
        <div className={`toast ${toast.type}`} role="alert">{toast.msg}</div>,
        document.body
      )}
    </div>
  )
}
