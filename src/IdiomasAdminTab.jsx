import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  listIdiomasAdmin,
  createIdiomaAdmin,
  updateIdiomaAdmin,
  deleteIdiomaAdmin,
  getIdiomaContent,
  updateIdiomaContent,
} from './apiClient.js'
import Pagination from './Pagination.jsx'
import { useLanguage } from './LanguageContext.jsx'

const EMPTY_FORM = { code: '', label: '', activo: true }

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20]
const DEFAULT_PAGE_LIMIT = 10

/** Número de caracteres a partir del cual el textarea de traducción se expande a 3 filas. */
const TEXTAREA_EXPAND_THRESHOLD = 80
/** Número de claves de traducción mostradas por página en el editor de contenido. */
const CONTENT_KEYS_PAGE_LIMIT = 20

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function IdiomasAdminTab({ showToast }) {
  const { reloadTranslations } = useLanguage()
  const [idiomas, setIdiomas] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroActivo, setFiltroActivo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_LIMIT)
  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Content editor
  const [contentModal, setContentModal] = useState(null) // idioma object
  const [content, setContent] = useState({})
  const [contentLoading, setContentLoading] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [contentFilter, setContentFilter] = useState('')
  const [contentKeysPage, setContentKeysPage] = useState(1)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = { page, limit, ...(filtroActivo !== '' ? { activo: filtroActivo === 'true' } : {}) }
    listIdiomasAdmin({ query })
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setIdiomas(data?.data ?? [])
        setTotal(data?.total ?? 0)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filtroActivo, page, limit, refreshKey])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditando(null)
    setModal('create')
  }

  const openEdit = (idioma) => {
    setForm({ code: idioma.code, label: idioma.label, activo: idioma.activo })
    setEditando(idioma)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    if (!form.label.trim()) {
      showToast('La etiqueta del idioma es obligatoria', 'error')
      return
    }
    if (modal === 'create' && !form.code.trim()) {
      showToast('El código del idioma es obligatorio', 'error')
      return
    }
    setSaving(true)
    try {
      if (modal === 'create') {
        const { data, error: apiErr } = await createIdiomaAdmin({ body: form })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast(`Idioma "${data.label}" creado correctamente`)
      } else {
        const { error: apiErr } = await updateIdiomaAdmin({ path: { id: editando.id }, body: { label: form.label, activo: form.activo } })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Idioma actualizado correctamente')
      }
      closeModal()
      refresh()
      reloadTranslations()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setConfirmDelete(null)
    const { error: apiErr } = await deleteIdiomaAdmin({ path: { id } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    showToast('Idioma eliminado correctamente')
    refresh()
    reloadTranslations()
  }

  const openContent = async (idioma) => {
    setContentModal(idioma)
    setContentFilter('')
    setContentKeysPage(1)
    setContentLoading(true)
    const { data, error: apiErr } = await getIdiomaContent({ path: { id: idioma.id } })
    setContentLoading(false)
    if (apiErr) { showToast(`Error al cargar contenido: ${apiErr.message}`, 'error'); return }
    setContent(data?.content ?? {})
  }

  const closeContentModal = () => { setContentModal(null); setContent({}); setContentFilter('') }

  const handleContentChange = (key, value) => {
    setContent(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveContent = async () => {
    setContentSaving(true)
    try {
      const { error: apiErr } = await updateIdiomaContent({ path: { id: contentModal.id }, body: { content } })
      if (apiErr) { showToast(`Error al guardar contenido: ${apiErr.message}`, 'error'); return }
      showToast(`Contenido del idioma "${contentModal.label}" guardado correctamente`)
      reloadTranslations()
      closeContentModal()
    } finally {
      setContentSaving(false)
    }
  }

  const filteredKeys = Object.keys(content).filter(k =>
    !contentFilter.trim() ||
    k.toLowerCase().includes(contentFilter.toLowerCase()) ||
    String(content[k]).toLowerCase().includes(contentFilter.toLowerCase())
  )

  // Client-side pagination for the content keys datatable.
  const contentKeysTotalPages = Math.max(
    1,
    Math.ceil(filteredKeys.length / CONTENT_KEYS_PAGE_LIMIT)
  )
  const safeContentKeysPage = Math.min(contentKeysPage, contentKeysTotalPages)
  const pagedContentKeys = filteredKeys.slice(
    (safeContentKeysPage - 1) * CONTENT_KEYS_PAGE_LIMIT,
    safeContentKeysPage * CONTENT_KEYS_PAGE_LIMIT
  )

  // Reset to first page whenever the filter text changes.
  useEffect(() => { setContentKeysPage(1) }, [contentFilter])

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} idioma{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="admin-filters">
          <select
            className="admin-filter-select"
            value={filtroActivo}
            onChange={e => { setFiltroActivo(e.target.value); setPage(1) }}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
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
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            ➕ Nuevo idioma
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando idiomas…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && idiomas.length === 0 && (
        <div className="info-box">No hay idiomas. Crea el primero con «Nuevo idioma».</div>
      )}

      {!loading && !error && idiomas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Etiqueta</th>
                <th>Estado</th>
                <th>Creado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {idiomas.map(i => (
                <tr key={i.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{i.code}</span>
                  </td>
                  <td>{i.label}</td>
                  <td>
                    <span className={`estado-badge ${i.activo ? 'badge-activa' : 'badge-inactiva'}`}>
                      {i.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(i.creadoEn)}</td>
                  <td>
                    <div className="pregunta-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => openContent(i)}
                        title="Editar contenido/traducciones"
                      >
                        🌐 Contenido
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => openEdit(i)}
                        title="Editar idioma"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-xs"
                        onClick={() => setConfirmDelete(i.id)}
                        title="Eliminar idioma"
                        disabled={i.code === 'es'}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
      />

      {/* Create / Edit modal */}
      {modal && createPortal(
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nuevo idioma' : '✏️ Editar idioma'}
            </h2>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Código *</label>
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={handleFormChange}
                  placeholder="Ej: de"
                  disabled={modal === 'edit'}
                  maxLength={10}
                />
              </div>
              <div className="field">
                <label>Etiqueta *</label>
                <input
                  type="text"
                  name="label"
                  value={form.label}
                  onChange={handleFormChange}
                  placeholder="Ej: Deutsch"
                />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: '.9rem' }}>
                  <input
                    type="checkbox"
                    name="activo"
                    checked={form.activo}
                    onChange={handleFormChange}
                    style={{ width: 16, height: 16 }}
                  />
                  Activo
                </label>
              </div>
            </div>

            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando…' : modal === 'create' ? '➕ Crear' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Content editor modal */}
      {contentModal && createPortal(
        <div className="admin-modal-overlay" onClick={closeContentModal}>
          <div
            className="admin-modal"
            style={{ maxWidth: 780, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="admin-modal-title">
              🌐 Contenido del idioma: <em>{contentModal.label}</em> ({contentModal.code})
            </h2>

            {contentLoading && <div className="info-box">⏳ Cargando traducciones…</div>}

            {!contentLoading && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Buscar clave o valor…"
                    value={contentFilter}
                    onChange={e => setContentFilter(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredKeys.length === 0 ? (
                    <div className="info-box">No se encontraron claves.</div>
                  ) : (
                    <table className="preguntas-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '65%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Clave</th>
                          <th>Traducción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedContentKeys.map(key => (
                          <tr key={key}>
                            <td style={{ fontFamily: 'monospace', fontSize: '.8rem', color: '#555', verticalAlign: 'top', paddingTop: 10 }}>
                              {key}
                            </td>
                            <td>
                              <textarea
                                rows={String(content[key] ?? '').length > TEXTAREA_EXPAND_THRESHOLD ? 3 : 1}
                                value={content[key] ?? ''}
                                onChange={e => handleContentChange(key, e.target.value)}
                                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '.85rem', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <Pagination
                  page={safeContentKeysPage}
                  totalPages={contentKeysTotalPages}
                  onPageChange={setContentKeysPage}
                />

                <div className="btn-row" style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeContentModal}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" disabled={contentSaving} onClick={handleSaveContent}>
                    {contentSaving ? 'Guardando…' : '💾 Guardar traducciones'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)}

      {/* Delete confirmation modal */}
      {confirmDelete && createPortal(
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar este idioma? No se pueden eliminar idiomas con el código «es» (idioma por defecto).
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
    </div>
  )
}
