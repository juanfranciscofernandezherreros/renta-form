import { useState, useEffect, useCallback } from 'react'
import {
  listPreguntasFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
} from './apiClient.js'

const EMPTY_FORM = { texto: '' }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PreguntasFormularioAdminTab({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listPreguntasFormulario()
      .then(pregRes => {
        if (cancelled) return
        if (pregRes.error) throw new Error(pregRes.error.message ?? 'Error desconocido')
        setPreguntas(pregRes.data ?? [])
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditando(null)
    setModal('create')
  }

  const openEdit = (pregunta) => {
    setForm({ texto: pregunta.texto })
    setEditando(pregunta)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!form.texto.trim()) {
      showToast('El texto de la pregunta no puede estar vacío', 'error')
      return
    }
    setSaving(true)
    try {
      if (modal === 'create') {
        const { error: apiErr } = await createPreguntaFormulario({ body: { texto: form.texto.trim() } })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Pregunta creada correctamente')
      } else {
        const { error: apiErr } = await updatePreguntaFormulario({
          path: { id: editando.id },
          body: { texto: form.texto.trim() },
        })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Pregunta actualizada correctamente')
      }
      closeModal()
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setSaving(true)
    try {
      const { error: apiErr } = await deletePreguntaFormulario({ path: { id } })
      if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
      showToast('Pregunta eliminada correctamente')
      setConfirmDelete(null)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''} del formulario</span>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate} disabled={loading}>
          ➕ Nueva pregunta
        </button>
      </div>

      {loading && <div className="info-box">⏳ Cargando preguntas del formulario…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && preguntas.length === 0 && (
        <div className="info-box">No hay preguntas del formulario. Crea la primera con el botón «Nueva pregunta».</div>
      )}

      {!loading && !error && preguntas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Pregunta</th>
                <th style={{ whiteSpace: 'nowrap' }}>Tipo</th>
                <th style={{ whiteSpace: 'nowrap' }}>Última modificación</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {preguntas.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="pregunta-texto">{p.texto}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>Sí / No</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(p.actualizadaEn)}</td>
                  <td>
                    <div className="pregunta-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => openEdit(p)}
                        title="Editar pregunta"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-xs"
                        onClick={() => setConfirmDelete(p)}
                        title="Eliminar pregunta"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta del formulario' : '✏️ Editar pregunta del formulario'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Texto de la pregunta *</label>
                <textarea
                  name="texto"
                  value={form.texto}
                  onChange={handleFormChange}
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Escribe aquí la pregunta…"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Tipo de respuesta</label>
                <input
                  type="text"
                  value="Sí / No"
                  disabled
                  style={{ width: '100%', boxSizing: 'border-box', background: '#f5f5f5', color: '#666' }}
                />
              </div>
            </div>

            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando…' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">🗑️ Eliminar pregunta</h2>
            <p className="admin-modal-desc">
              ¿Seguro que deseas eliminar la pregunta <strong>{confirmDelete.texto}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => handleDelete(confirmDelete.id)}
              >
                {saving ? 'Eliminando…' : '🗑️ Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
