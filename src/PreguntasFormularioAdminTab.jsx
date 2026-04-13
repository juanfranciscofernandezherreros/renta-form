import { useState, useEffect, useCallback } from 'react'
import { listPreguntasFormulario, updatePreguntaFormulario } from './apiClient.js'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PreguntasFormularioAdminTab({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ texto: '', orden: 0, indentada: false })
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listPreguntasFormulario()
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setPreguntas(data ?? [])
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const openEdit = (pregunta) => {
    setForm({ texto: pregunta.texto, orden: pregunta.orden, indentada: pregunta.indentada })
    setEditando(pregunta)
  }

  const closeModal = () => { setEditando(null); setForm({ texto: '', orden: 0, indentada: false }) }

  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    if (!form.texto.trim()) {
      showToast('El texto de la pregunta no puede estar vacío', 'error')
      return
    }
    setSaving(true)
    try {
      const { error: apiErr } = await updatePreguntaFormulario({
        path: { campo: editando.campo },
        body: { texto: form.texto, orden: Number(form.orden), indentada: form.indentada },
      })
      if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
      showToast('Pregunta del formulario actualizada correctamente')
      closeModal()
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
        <p style={{ fontSize: '.82rem', color: '#666', margin: 0 }}>
          Estas preguntas forman parte del formulario principal. Puedes editar su texto y orden.
        </p>
      </div>

      {loading && <div className="info-box">⏳ Cargando preguntas del formulario…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && preguntas.length === 0 && (
        <div className="info-box">No se encontraron preguntas del formulario.</div>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Edit modal */}
      {editando && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">✏️ Editar pregunta del formulario</h2>
            <p className="admin-modal-desc" style={{ marginBottom: 16 }}>
              Campo: <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>{editando.campo}</code>
              {' · '}Sección: <strong>{editando.seccionTitulo}</strong>
            </p>

            <div className="form-grid" style={{ marginBottom: 16 }}>
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
    </div>
  )
}
