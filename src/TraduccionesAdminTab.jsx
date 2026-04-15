import { useState, useEffect, useCallback } from 'react'
import {
  listTraduccionesAdmin,
  createTraduccionAdmin,
  updateTraduccionAdmin,
  deleteTraduccionAdmin,
  listIdiomasAdmin,
} from './apiClient.js'
import Pagination from './Pagination.jsx'
import { useLanguage } from './LanguageContext.jsx'

const EMPTY_FORM = { idioma_id: '', clave: '', valor: '' }
const PAGE_LIMIT = 20
const TEXTAREA_EXPAND_THRESHOLD = 80

export default function TraduccionesAdminTab({ showToast }) {
  const { reloadTranslations } = useLanguage()
  const [traducciones, setTraducciones] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [filtroIdioma, setFiltroIdioma] = useState('')
  const [filtroClave, setFiltroClave] = useState('')
  const [idiomas, setIdiomas] = useState([])
  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Load idiomas for the filter dropdown
  useEffect(() => {
    listIdiomasAdmin({ query: { limit: 100 } })
      .then(({ data }) => setIdiomas(data?.data ?? []))
      .catch(() => {})
  }, [])

  // Load traducciones
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = {
      page,
      limit: PAGE_LIMIT,
      ...(filtroIdioma ? { idiomaId: filtroIdioma } : {}),
      ...(filtroClave.trim() ? { clave: filtroClave.trim() } : {}),
    }
    listTraduccionesAdmin({ query })
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setTraducciones(data?.data ?? [])
        setTotal(data?.total ?? 0)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filtroIdioma, filtroClave, page, refreshKey])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, idioma_id: filtroIdioma || (idiomas[0]?.id ?? '') })
    setEditando(null)
    setModal('create')
  }

  const openEdit = (t) => {
    setForm({ idioma_id: t.idioma_id, clave: t.clave, valor: t.valor })
    setEditando(t)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!form.idioma_id) {
      showToast('Debes seleccionar un idioma', 'error')
      return
    }
    if (!form.clave.trim()) {
      showToast('La clave es obligatoria', 'error')
      return
    }
    setSaving(true)
    try {
      if (modal === 'create') {
        const { data, error: apiErr } = await createTraduccionAdmin({ body: form })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast(`Traducción «${data.clave}» creada correctamente`)
      } else {
        const { error: apiErr } = await updateTraduccionAdmin({
          path: { id: editando.id },
          body: { clave: form.clave, valor: form.valor },
        })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Traducción actualizada correctamente')
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
    const { error: apiErr } = await deleteTraduccionAdmin({ path: { id } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    showToast('Traducción eliminada correctamente')
    refresh()
    reloadTranslations()
  }

  const handleFiltroClaveChange = e => {
    setFiltroClave(e.target.value)
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_LIMIT)

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} traducción{total !== 1 ? 'es' : ''}</span>
        </div>
        <div className="admin-filters">
          <select
            className="admin-filter-select"
            value={filtroIdioma}
            onChange={e => { setFiltroIdioma(e.target.value); setPage(1) }}
          >
            <option value="">Todos los idiomas</option>
            {idiomas.map(i => (
              <option key={i.id} value={i.id}>{i.label} ({i.code})</option>
            ))}
          </select>
          <input
            type="text"
            className="admin-filter-input"
            placeholder="Buscar clave…"
            value={filtroClave}
            onChange={handleFiltroClaveChange}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            ➕ Nueva traducción
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando traducciones…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && traducciones.length === 0 && (
        <div className="info-box">No hay traducciones. Crea la primera con «Nueva traducción».</div>
      )}

      {!loading && !error && traducciones.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Idioma</th>
                <th>Clave</th>
                <th>Valor</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {traducciones.map(t => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.idioma_code}</span>
                    {' '}<span style={{ color: '#666', fontSize: '.82rem' }}>{t.idioma_label}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '.82rem', color: '#555' }}>
                    {t.clave}
                  </td>
                  <td style={{ maxWidth: 320, wordBreak: 'break-word' }}>
                    {t.valor || <em style={{ color: '#aaa' }}>(vacío)</em>}
                  </td>
                  <td>
                    <div className="pregunta-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => openEdit(t)}
                        title="Editar traducción"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-xs"
                        onClick={() => setConfirmDelete(t.id)}
                        title="Eliminar traducción"
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
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Create / Edit modal */}
      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva traducción' : '✏️ Editar traducción'}
            </h2>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Idioma *</label>
                <select
                  name="idioma_id"
                  value={form.idioma_id}
                  onChange={handleFormChange}
                  disabled={modal === 'edit'}
                  className="admin-filter-select"
                  style={{ width: '100%' }}
                >
                  <option value="">— selecciona —</option>
                  {idiomas.map(i => (
                    <option key={i.id} value={i.id}>{i.label} ({i.code})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Clave *</label>
                <input
                  type="text"
                  name="clave"
                  value={form.clave}
                  onChange={handleFormChange}
                  placeholder="Ej: header.title"
                  maxLength={200}
                />
              </div>
              <div className="field">
                <label>Valor</label>
                <textarea
                  name="valor"
                  value={form.valor}
                  onChange={handleFormChange}
                  rows={(form.valor?.length ?? 0) > TEXTAREA_EXPAND_THRESHOLD ? 4 : 2}
                  placeholder="Texto de la traducción"
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '.9rem', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
                />
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
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar esta traducción? Esta acción no se puede deshacer.
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
    </div>
  )
}
