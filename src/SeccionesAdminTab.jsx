import { useState, useEffect, useCallback } from 'react'
import {
  listSeccionesAdmin,
  createSeccionAdmin,
  updateSeccionAdmin,
  deleteSeccionAdmin,
  getSeccionDeclaraciones,
  getSeccionPreguntas,
} from './mockApi.js'

const EMPTY_FORM = { nombre: '', orden: 1, activa: true }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SeccionesAdminTab({ showToast }) {
  const [secciones, setSecciones] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroActiva, setFiltroActiva] = useState('')
  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [seccionDeclaraciones, setSeccionDeclaraciones] = useState({}) // { seccionId: [{ id, dniNie, nombre }] }
  const [seccionPreguntas, setSeccionPreguntas] = useState({}) // { seccionId: [{ id, texto, tipoRespuesta }] }

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = filtroActiva !== '' ? { activa: filtroActiva === 'true' } : {}
    listSeccionesAdmin({ query })
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setSecciones(data?.data ?? [])
        setTotal(data?.total ?? 0)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filtroActiva, refreshKey])

  // Load declaration identifiers linked to each section
  useEffect(() => {
    if (secciones.length === 0) return
    let cancelled = false
    Promise.all(
      secciones.map(s =>
        getSeccionDeclaraciones({ path: { id: s.id } })
          .then(({ data }) => ({ id: s.id, declaraciones: data?.data ?? [] }))
          .catch(() => ({ id: s.id, declaraciones: [] }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      results.forEach(r => { map[r.id] = r.declaraciones })
      setSeccionDeclaraciones(map)
    })
    return () => { cancelled = true }
  }, [secciones])

  // Load questions linked to each section
  useEffect(() => {
    if (secciones.length === 0) return
    let cancelled = false
    Promise.all(
      secciones.map(s =>
        getSeccionPreguntas({ path: { id: s.id } })
          .then(({ data }) => ({ id: s.id, preguntas: data?.data ?? [] }))
          .catch(() => ({ id: s.id, preguntas: [] }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      results.forEach(r => { map[r.id] = r.preguntas })
      setSeccionPreguntas(map)
    })
    return () => { cancelled = true }
  }, [secciones])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, orden: (secciones.length > 0 ? Math.max(...secciones.map(s => s.orden)) + 1 : 1) })
    setEditando(null)
    setModal('create')
  }

  const openEdit = (seccion) => {
    setForm({ nombre: seccion.nombre, orden: seccion.orden, activa: seccion.activa })
    setEditando(seccion)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      showToast('El nombre de la sección es obligatorio', 'error')
      return
    }
    setSaving(true)
    try {
      const body = { ...form, orden: Number(form.orden) }
      if (modal === 'create') {
        const { data, error: apiErr } = await createSeccionAdmin({ body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast(`Sección "${data.nombre}" creada correctamente`)
      } else {
        const { error: apiErr } = await updateSeccionAdmin({ path: { id: editando.id }, body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Sección actualizada correctamente')
      }
      closeModal()
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setConfirmDelete(null)
    const { error: apiErr } = await deleteSeccionAdmin({ path: { id } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    showToast('Sección eliminada correctamente')
    refresh()
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} sección{total !== 1 ? 'es' : ''}</span>
        </div>
        <div className="admin-filters">
          <select
            className="admin-filter-select"
            value={filtroActiva}
            onChange={e => setFiltroActiva(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            ➕ Nueva sección
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando secciones…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && secciones.length === 0 && (
        <div className="info-box">No hay secciones. Crea la primera con «Nueva sección».</div>
      )}

      {!loading && !error && secciones.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Orden</th>
                <th>Estado</th>
                <th>Preguntas</th>
                <th>Declaraciones</th>
                <th>Creada</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {secciones.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="pregunta-texto">{s.nombre}</div>
                  </td>
                  <td>{s.orden}</td>
                  <td>
                    <span className={`estado-badge ${s.activa ? 'badge-activa' : 'badge-inactiva'}`}>
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    {(seccionPreguntas[s.id] ?? []).length === 0 ? (
                      <span style={{ color: '#aaa', fontSize: '.8rem' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(seccionPreguntas[s.id] ?? []).map(p => (
                          <span
                            key={p.id}
                            className={`estado-badge ${p.activa ? 'badge-activa' : 'badge-inactiva'}`}
                            style={{ fontSize: '.72rem', cursor: 'default' }}
                            title={p.texto}
                          >
                            {p.texto.length > 50 ? `${p.texto.slice(0, 50)}…` : p.texto}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {(seccionDeclaraciones[s.id] ?? []).length === 0 ? (
                      <span style={{ color: '#aaa', fontSize: '.8rem' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(seccionDeclaraciones[s.id] ?? []).map(d => (
                          <span
                            key={d.id}
                            className="estado-badge badge-activa"
                            style={{ fontSize: '.72rem', cursor: 'default' }}
                            title={d.nombre}
                          >
                            {d.dniNie}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(s.creadaEn)}</td>
                  <td>
                    <div className="pregunta-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => openEdit(s)}
                        title="Editar sección"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-xs"
                        onClick={() => setConfirmDelete(s.id)}
                        title="Eliminar sección"
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

      {/* Create / Edit modal */}
      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva sección' : '✏️ Editar sección'}
            </h2>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field full">
                <label>Nombre de la sección *</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleFormChange}
                  placeholder="Ej: Ingresos Extraordinarios"
                />
              </div>
              <div className="field">
                <label>Orden</label>
                <input
                  type="number"
                  name="orden"
                  value={form.orden}
                  onChange={handleFormChange}
                  min={1}
                />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: '.9rem' }}>
                  <input
                    type="checkbox"
                    name="activa"
                    checked={form.activa}
                    onChange={handleFormChange}
                    style={{ width: 16, height: 16 }}
                  />
                  Activa
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
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar esta sección? Solo se puede eliminar si no tiene preguntas asignadas.
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
