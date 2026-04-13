import { useState, useEffect, useCallback } from 'react'
import {
  listPreguntasFormulario,
  listSeccionesFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
} from './apiClient.js'

const EMPTY_FORM = { campo: '', texto: '', seccionId: '', orden: 0, indentada: false, condicionCampo: '', condicionValor: '' }

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
    Promise.all([listPreguntasFormulario(), listSeccionesFormulario()])
      .then(([{ data: pData, error: pErr }, { data: sData, error: sErr }]) => {
        if (cancelled) return
        if (pErr) throw new Error(pErr.message ?? 'Error desconocido')
        if (sErr) throw new Error(sErr.message ?? 'Error desconocido')
        setPreguntas(pData ?? [])
        setSecciones(sData ?? [])
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const openCreate = () => {
    const defaultSeccion = secciones[0]?.id ?? ''
    setForm({ ...EMPTY_FORM, seccionId: defaultSeccion })
    setEditando(null)
    setModal('create')
  }

  const openEdit = (pregunta) => {
    setForm({
      campo: pregunta.campo,
      texto: pregunta.texto,
      seccionId: pregunta.seccionId ?? '',
      orden: pregunta.orden,
      indentada: pregunta.indentada,
      condicionCampo: pregunta.condicionCampo ?? '',
      condicionValor: pregunta.condicionValor ?? '',
    })
    setEditando(pregunta)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    if (!form.texto.trim()) {
      showToast('El texto de la pregunta no puede estar vacío', 'error')
      return
    }
    if (modal === 'create' && !form.campo.trim()) {
      showToast('El identificador de campo es obligatorio', 'error')
      return
    }
    if (modal === 'create' && !form.seccionId) {
      showToast('Debes seleccionar una sección', 'error')
      return
    }
    setSaving(true)
    try {
      if (modal === 'create') {
        const body = {
          campo: form.campo.trim(),
          texto: form.texto.trim(),
          seccionId: form.seccionId,
          orden: Number(form.orden),
          indentada: form.indentada,
          condicionCampo: form.condicionCampo.trim() || undefined,
          condicionValor: form.condicionValor.trim() || undefined,
        }
        const { error: apiErr } = await createPreguntaFormulario({ body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Pregunta creada correctamente')
      } else {
        const { error: apiErr } = await updatePreguntaFormulario({
          path: { campo: editando.campo },
          body: {
            texto: form.texto.trim(),
            orden: Number(form.orden),
            indentada: form.indentada,
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

  const handleDelete = async (campo) => {
    setSaving(true)
    try {
      const { error: apiErr } = await deletePreguntaFormulario({ path: { campo } })
      if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
      showToast('Pregunta eliminada correctamente')
      setConfirmDelete(null)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  // Group by section for display
  const porSeccion = preguntas.reduce((acc, p) => {
    const key = p.seccionTitulo ?? p.seccionId ?? 'Sin sección'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

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

      {!loading && !error && Object.entries(porSeccion).map(([seccionTitulo, items]) => (
        <div key={seccionTitulo} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.04em', color: '#555', marginBottom: 8, fontWeight: 600 }}>
            📂 {seccionTitulo}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="preguntas-table">
              <thead>
                <tr>
                  <th>Pregunta</th>
                  <th>Campo</th>
                  <th>Orden</th>
                  <th>Indentada</th>
                  <th>Condición</th>
                  <th>Última modificación</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.campo}>
                    <td>
                      <div className="pregunta-texto">{p.texto}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: '.78rem', background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>
                        {p.campo}
                      </code>
                    </td>
                    <td>{p.orden}</td>
                    <td>
                      <span className={`estado-badge ${p.indentada ? 'badge-activa' : 'badge-inactiva'}`}>
                        {p.indentada ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td style={{ fontSize: '.8rem', color: '#666' }}>
                      {p.condicionCampo
                        ? <><code style={{ fontSize: '.78rem', background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>{p.condicionCampo}</code> = {p.condicionValor}</>
                        : '—'}
                    </td>
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
        </div>
      ))}

      {/* Create / Edit modal */}
      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta del formulario' : '✏️ Editar pregunta del formulario'}
            </h2>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              {modal === 'create' && (
                <>
                  <div className="field">
                    <label>Identificador de campo *</label>
                    <input
                      type="text"
                      name="campo"
                      value={form.campo}
                      onChange={handleFormChange}
                      placeholder="ej: tieneHipoteca"
                    />
                  </div>
                  <div className="field">
                    <label>Sección *</label>
                    <select name="seccionId" value={form.seccionId} onChange={handleFormChange}>
                      <option value="">— Selecciona una sección —</option>
                      {secciones.map(s => (
                        <option key={s.id} value={s.id}>{s.numero ? `${s.numero}. ` : ''}{s.titulo}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {modal === 'edit' && (
                <div className="field" style={{ color: '#666', fontSize: '.85rem' }}>
                  <label>Campo</label>
                  <code style={{ display: 'block', background: '#f0f0f0', padding: '6px 10px', borderRadius: 4, fontSize: '.85rem' }}>
                    {editando.campo}
                  </code>
                </div>
              )}
              <div className="field full">
                <label>Texto de la pregunta *</label>
                <textarea
                  name="texto"
                  value={form.texto}
                  onChange={handleFormChange}
                  rows={3}
                />
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
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: '.9rem' }}>
                  <input
                    type="checkbox"
                    name="indentada"
                    checked={form.indentada}
                    onChange={handleFormChange}
                    style={{ width: 16, height: 16 }}
                  />
                  Indentada (pregunta subordinada)
                </label>
              </div>
              {modal === 'create' && (
                <>
                  <div className="field">
                    <label>Campo condición (opcional)</label>
                    <input
                      type="text"
                      name="condicionCampo"
                      value={form.condicionCampo}
                      onChange={handleFormChange}
                      placeholder="ej: viviendaAlquiler"
                    />
                  </div>
                  <div className="field">
                    <label>Valor condición (opcional)</label>
                    <input
                      type="text"
                      name="condicionValor"
                      value={form.condicionValor}
                      onChange={handleFormChange}
                      placeholder="ej: si"
                    />
                  </div>
                </>
              )}
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
                onClick={() => handleDelete(confirmDelete.campo)}
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
