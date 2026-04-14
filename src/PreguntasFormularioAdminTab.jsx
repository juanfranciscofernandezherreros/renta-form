import { useState, useEffect, useCallback } from 'react'
import {
  listPreguntasFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
  listSeccionesAdmin,
} from './apiClient.js'

const EMPTY_FORM = { campo: '', texto: '', textos: { es: '', fr: '', en: '', ca: '' }, seccionId: '', orden: 0 }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PreguntasFormularioAdminTab({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [secciones, setSecciones] = useState([])
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
    Promise.all([
      listPreguntasFormulario(),
      listSeccionesAdmin({ query: { activa: 'true', limit: 100 } }),
    ])
      .then(([pregRes, secRes]) => {
        if (cancelled) return
        if (pregRes.error) throw new Error(pregRes.error.message ?? 'Error desconocido')
        setPreguntas(pregRes.data ?? [])
        setSecciones(secRes.data?.data ?? [])
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
    setForm({
      campo: pregunta.campo ?? '',
      texto: pregunta.texto,
      textos: pregunta.textos ?? { es: '', fr: '', en: '', ca: '' },
      seccionId: pregunta.seccionId ?? '',
      orden: pregunta.orden ?? 0,
    })
    setEditando(pregunta)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (name === 'orden' ? parseInt(value, 10) || 0 : value) }))
  }

  const handleTextosChange = (lang, value) => {
    setForm(prev => ({ ...prev, textos: { ...prev.textos, [lang]: value } }))
  }

  const handleSave = async () => {
    if (!form.texto.trim()) {
      showToast('El texto de la pregunta no puede estar vacío', 'error')
      return
    }
    if (!form.campo.trim()) {
      showToast('El campo (identificador) no puede estar vacío', 'error')
      return
    }
    setSaving(true)
    try {
      if (modal === 'create') {
        const body = {
          campo: form.campo.trim(),
          texto: form.texto.trim(),
          textos: form.textos,
          seccionId: form.seccionId || null,
          orden: form.orden,
        }
        const { error: apiErr } = await createPreguntaFormulario({ body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Pregunta creada correctamente')
      } else {
        const { error: apiErr } = await updatePreguntaFormulario({
          path: { id: editando.id },
          body: {
            campo: form.campo.trim(),
            texto: form.texto.trim(),
            textos: form.textos,
            seccionId: form.seccionId || null,
            orden: form.orden,
          },
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
                <th>Campo</th>
                <th>Pregunta (Sí/No)</th>
                <th>Sección</th>
                <th>Orden</th>
                <th>Última modificación</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {preguntas.map(p => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: '0.85em' }}>{p.campo}</code></td>
                  <td>
                    <div className="pregunta-texto">{p.texto}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.seccionNombre ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>{p.orden}</td>
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
          <div className="admin-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta del formulario' : '✏️ Editar pregunta del formulario'}
            </h2>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field full">
                <label>Campo (identificador) *</label>
                <input
                  type="text"
                  name="campo"
                  value={form.campo}
                  onChange={handleFormChange}
                  placeholder="ej: viviendaAlquiler"
                />
              </div>
              <div className="field full">
                <label>Texto de la pregunta (Sí/No) *</label>
                <textarea
                  name="texto"
                  value={form.texto}
                  onChange={handleFormChange}
                  rows={2}
                />
              </div>
              <div className="field">
                <label>Sección</label>
                <select name="seccionId" value={form.seccionId} onChange={handleFormChange}>
                  <option value="">— Sin sección —</option>
                  {secciones.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Orden</label>
                <input
                  type="number"
                  name="orden"
                  value={form.orden}
                  onChange={handleFormChange}
                  min={0}
                />
              </div>
              <div className="field full" style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
                <label>Traducciones</label>
              </div>
              {['es', 'fr', 'en', 'ca'].map(lang => (
                <div className="field full" key={lang}>
                  <label style={{ textTransform: 'uppercase', fontSize: '0.8em' }}>{lang}</label>
                  <input
                    type="text"
                    value={form.textos?.[lang] ?? ''}
                    onChange={e => handleTextosChange(lang, e.target.value)}
                    placeholder={`Texto en ${lang}`}
                  />
                </div>
              ))}
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
