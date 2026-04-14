import { useState, useEffect, useCallback } from 'react'
import {
  listPreguntasAdmin,
  createPreguntaAdmin,
  updatePreguntaAdmin,
  deletePreguntaAdmin,
} from './apiClient.js'
import Pagination from './Pagination.jsx'

const TIPO_LABELS = {
  yn: 'Sí / No',
  texto: 'Texto libre',
  numero: 'Número',
  fecha: 'Fecha',
  importe: 'Importe (€)',
  porcentaje: 'Porcentaje (%)',
  multilinea: 'Texto largo',
}
const TIPOS = ['yn', 'texto', 'numero', 'fecha', 'importe', 'porcentaje', 'multilinea']

const EMPTY_FORM = { texto: '', tipoRespuesta: 'yn' }

export default function PreguntasUnificadasAdminTab({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const limit = 10
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
    listPreguntasAdmin({ query: { page, limit } })
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setPreguntas(data?.data ?? [])
        setTotal(data?.total ?? 0)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, refreshKey])

  const openCreate = () => { setForm(EMPTY_FORM); setEditando(null); setModal('create') }

  const openEdit = p => {
    setForm({ texto: p.texto, tipoRespuesta: p.tipoRespuesta })
    setEditando(p)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!form.texto.trim()) {
      showToast('El texto de la pregunta es obligatorio', 'error')
      return
    }
    setSaving(true)
    const body = { texto: form.texto.trim(), tipoRespuesta: form.tipoRespuesta }
    try {
      if (modal === 'create') {
        const { data, error: apiErr } = await createPreguntaAdmin({ body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast(`Pregunta "${data.texto.slice(0, 40)}${data.texto.length > 40 ? '…' : ''}" creada`)
      } else {
        const { error: apiErr } = await updatePreguntaAdmin({ path: { id: editando.id }, body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Pregunta actualizada correctamente')
      }
      closeModal()
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async id => {
    setConfirmDelete(null)
    const { error: apiErr } = await deletePreguntaAdmin({ path: { id } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    showToast('Pregunta eliminada correctamente')
    refresh()
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} pregunta{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="admin-filters">
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            ➕ Nueva pregunta
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando preguntas…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && preguntas.length === 0 && (
        <div className="info-box">No hay preguntas. Crea la primera con «Nueva pregunta».</div>
      )}

      {!loading && !error && preguntas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Pregunta</th>
                <th>Tipo de respuesta</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {preguntas.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="pregunta-texto">{p.texto}</div>
                  </td>
                  <td>{TIPO_LABELS[p.tipoRespuesta] ?? p.tipoRespuesta}</td>
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
                        onClick={() => setConfirmDelete(p.id)}
                        title="Eliminar pregunta"
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
      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta' : '✏️ Editar pregunta'}
            </h2>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field full">
                <label>Texto de la pregunta</label>
                <textarea
                  name="texto"
                  value={form.texto}
                  onChange={handleFormChange}
                  placeholder="Escribe aquí la pregunta…"
                  rows={3}
                />
              </div>
              <div className="field full">
                <label>Tipo de respuesta</label>
                <select name="tipoRespuesta" value={form.tipoRespuesta} onChange={handleFormChange}>
                  {TIPOS.map(t => (
                    <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                  ))}
                </select>
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

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar esta pregunta?
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
