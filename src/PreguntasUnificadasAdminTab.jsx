import { useState, useEffect, useCallback } from 'react'
import {
  listPreguntasAdmin,
  createPreguntaAdmin,
  updatePreguntaAdmin,
  deletePreguntaAdmin,
  listSeccionesAdmin,
  listPreguntasFormulario,
  listSeccionesFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
} from './apiClient.js'
import Pagination from './Pagination.jsx'

// ── Shared constants ────────────────────────────────────────────────────────

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

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

// ── Subcomponent: Preguntas Adicionales ─────────────────────────────────────

const EMPTY_ADICIONAL = { texto: '', seccion: '', tipoRespuesta: 'yn', orden: 0, activa: true, obligatoria: false }
const MAX_ITEMS_FOR_DROPDOWN = 1000

function PreguntasAdicionalesSection({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroActiva, setFiltroActiva] = useState('')
  const [page, setPage] = useState(1)
  const limit = 10
  const [modal, setModal] = useState(null)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_ADICIONAL)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [secciones, setSecciones] = useState([])
  const [seccionesLoading, setSeccionesLoading] = useState(false)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const loadSecciones = useCallback(() => {
    setSeccionesLoading(true)
    listSeccionesAdmin({ query: { activa: true, page: 1, limit: MAX_ITEMS_FOR_DROPDOWN } })
      .then(({ data }) => setSecciones(data?.data ?? []))
      .finally(() => setSeccionesLoading(false))
  }, [])

  useEffect(() => { loadSecciones() }, [loadSecciones])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = { page, limit, ...(filtroActiva !== '' ? { activa: filtroActiva === 'true' } : {}) }
    listPreguntasAdmin({ query })
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
  }, [filtroActiva, page, refreshKey])

  const openCreate = () => { setForm(EMPTY_ADICIONAL); setEditando(null); setModal('create') }
  const openEdit = p => {
    setForm({ texto: p.texto, seccion: p.seccion, tipoRespuesta: p.tipoRespuesta, orden: p.orden, activa: p.activa, obligatoria: p.obligatoria ?? false })
    setEditando(p)
    setModal('edit')
  }
  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_ADICIONAL) }
  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    if (!form.texto.trim() || !form.seccion.trim()) {
      showToast('El texto y la sección son obligatorios', 'error')
      return
    }
    setSaving(true)
    try {
      const body = { ...form, orden: Number(form.orden) }
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
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} pregunta{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="admin-filters">
          <select
            className="admin-filter-select"
            value={filtroActiva}
            onChange={e => { setFiltroActiva(e.target.value); setPage(1) }}
          >
            <option value="">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            ➕ Nueva pregunta
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando preguntas…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}
      {!loading && !error && preguntas.length === 0 && (
        <div className="info-box">No hay preguntas adicionales. Crea la primera con «Nueva pregunta».</div>
      )}

      {!loading && !error && preguntas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Pregunta</th>
                <th>Tipo</th>
                <th>Orden</th>
                <th>Obligatoria</th>
                <th>Estado</th>
                <th>Creada</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {preguntas.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="pregunta-texto">{p.texto}</div>
                    <div className="pregunta-seccion">📂 {p.seccion}</div>
                  </td>
                  <td>{TIPO_LABELS[p.tipoRespuesta] ?? p.tipoRespuesta}</td>
                  <td>{p.orden}</td>
                  <td>
                    <span className={`estado-badge ${p.obligatoria ? 'badge-activa' : 'badge-inactiva'}`}>
                      {p.obligatoria ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`estado-badge ${p.activa ? 'badge-activa' : 'badge-inactiva'}`}>
                      {p.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(p.creadaEn)}</td>
                  <td>
                    <div className="pregunta-actions">
                      <button type="button" className="btn btn-secondary btn-sm btn-xs" onClick={() => openEdit(p)} title="Editar pregunta">✏️ Editar</button>
                      <button type="button" className="btn btn-danger btn-sm btn-xs" onClick={() => setConfirmDelete(p.id)} title="Eliminar pregunta">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={Math.ceil(total / limit)} onPageChange={setPage} />

      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta adicional' : '✏️ Editar pregunta adicional'}
            </h2>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field full">
                <label>Texto de la pregunta *</label>
                <textarea name="texto" value={form.texto} onChange={handleFormChange} placeholder="¿Ha declarado bienes en el extranjero?" rows={3} />
              </div>
              <div className="field">
                <label>Sección *</label>
                <select name="seccion" value={form.seccion} onChange={handleFormChange} disabled={seccionesLoading}>
                  <option value="">— Selecciona una sección —</option>
                  {secciones.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Tipo de respuesta</label>
                <select name="tipoRespuesta" value={form.tipoRespuesta} onChange={handleFormChange}>
                  {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Orden</label>
                <input type="number" name="orden" value={form.orden} onChange={handleFormChange} min={0} />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: '.9rem' }}>
                  <input type="checkbox" name="activa" checked={form.activa} onChange={handleFormChange} style={{ width: 16, height: 16 }} />
                  Activa
                </label>
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: '.9rem' }}>
                  <input type="checkbox" name="obligatoria" checked={form.obligatoria} onChange={handleFormChange} style={{ width: 16, height: 16 }} />
                  Obligatoria
                </label>
              </div>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando…' : modal === 'create' ? '➕ Crear' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar esta pregunta? También se eliminarán todas las asignaciones a declaraciones.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponent: Preguntas del Formulario ──────────────────────────────────

const EMPTY_FORMULARIO = { campo: '', texto: '', seccionId: '', orden: 0, indentada: false, condicionCampo: '', condicionValor: '' }

function PreguntasFormularioSection({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_FORMULARIO)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [secciones, setSecciones] = useState([])
  const [seccionesLoading, setSeccionesLoading] = useState(false)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const loadSecciones = useCallback(() => {
    setSeccionesLoading(true)
    listSeccionesFormulario()
      .then(({ data }) => setSecciones(data ?? []))
      .finally(() => setSeccionesLoading(false))
  }, [])

  useEffect(() => { loadSecciones() }, [loadSecciones])

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

  const openCreate = () => { setForm(EMPTY_FORMULARIO); setEditando(null); setModal('create') }
  const openEdit = p => {
    setForm({ campo: p.campo, texto: p.texto, seccionId: p.seccionId, orden: p.orden, indentada: p.indentada, condicionCampo: p.condicionCampo ?? '', condicionValor: p.condicionValor ?? '' })
    setEditando(p)
    setModal('edit')
  }
  const closeModal = () => { setModal(null); setEditando(null); setForm(EMPTY_FORMULARIO) }
  const handleFormChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    if (modal === 'create' && !form.campo.trim()) { showToast('El identificador de campo es obligatorio', 'error'); return }
    if (!form.texto.trim()) { showToast('El texto de la pregunta no puede estar vacío', 'error'); return }
    if (modal === 'create' && !form.seccionId.trim()) { showToast('La sección es obligatoria', 'error'); return }
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
        showToast('Pregunta del formulario creada correctamente')
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
        showToast('Pregunta del formulario actualizada correctamente')
      }
      closeModal()
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async campo => {
    setConfirmDelete(null)
    const { error: apiErr } = await deletePreguntaFormulario({ path: { campo } })
    if (apiErr) { showToast(`Error al eliminar: ${apiErr.message}`, 'error'); return }
    showToast('Pregunta del formulario eliminada correctamente')
    refresh()
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
        <div className="admin-filters">
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            ➕ Nueva pregunta
          </button>
        </div>
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
                      <code style={{ fontSize: '.78rem', background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>{p.campo}</code>
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
                        <button type="button" className="btn btn-secondary btn-sm btn-xs" onClick={() => openEdit(p)} title="Editar pregunta">✏️ Editar</button>
                        <button type="button" className="btn btn-danger btn-sm btn-xs" onClick={() => setConfirmDelete(p.campo)} title="Eliminar pregunta">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta del formulario' : '✏️ Editar pregunta del formulario'}
            </h2>

            {modal === 'edit' && editando && (
              <p className="admin-modal-desc" style={{ marginBottom: 16 }}>
                Campo: <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>{editando.campo}</code>
                {' · '}Sección: <strong>{editando.seccionTitulo}</strong>
              </p>
            )}

            <div className="form-grid" style={{ marginBottom: 16 }}>
              {modal === 'create' && (
                <div className="field full">
                  <label>Identificador de campo *</label>
                  <input
                    type="text"
                    name="campo"
                    value={form.campo}
                    onChange={handleFormChange}
                    placeholder="ej: viviendaAlquiler"
                  />
                </div>
              )}
              <div className="field full">
                <label>Texto de la pregunta *</label>
                <textarea name="texto" value={form.texto} onChange={handleFormChange} rows={3} />
              </div>
              {modal === 'create' && (
                <div className="field full">
                  <label>Sección *</label>
                  <select name="seccionId" value={form.seccionId} onChange={handleFormChange} disabled={seccionesLoading}>
                    <option value="">— Selecciona una sección —</option>
                    {secciones.map(s => <option key={s.id} value={s.id}>{s.titulo}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Orden</label>
                <input type="number" name="orden" value={form.orden} onChange={handleFormChange} min={0} />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: '.9rem' }}>
                  <input type="checkbox" name="indentada" checked={form.indentada} onChange={handleFormChange} style={{ width: 16, height: 16 }} />
                  Indentada (pregunta subordinada)
                </label>
              </div>
              {modal === 'create' && (
                <>
                  <div className="field">
                    <label>Condición campo</label>
                    <input type="text" name="condicionCampo" value={form.condicionCampo} onChange={handleFormChange} placeholder="ej: viviendaAlquiler" />
                  </div>
                  <div className="field">
                    <label>Condición valor</label>
                    <input type="text" name="condicionValor" value={form.condicionValor} onChange={handleFormChange} placeholder="ej: si" />
                  </div>
                </>
              )}
            </div>

            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando…' : modal === 'create' ? '➕ Crear' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar esta pregunta del formulario? Esta acción podría afectar al formulario principal de declaraciones.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main unified tab ────────────────────────────────────────────────────────

export default function PreguntasUnificadasAdminTab({ showToast }) {
  const [subTab, setSubTab] = useState('formulario')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => setSubTab('formulario')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: subTab === 'formulario' ? 700 : 400,
            borderBottom: subTab === 'formulario' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
            color: subTab === 'formulario' ? 'var(--primary, #2563eb)' : '#555',
            marginBottom: -2,
            fontSize: '0.9rem',
          }}
        >
          📝 Preguntas del formulario
        </button>
        <button
          type="button"
          onClick={() => setSubTab('adicionales')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: subTab === 'adicionales' ? 700 : 400,
            borderBottom: subTab === 'adicionales' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
            color: subTab === 'adicionales' ? 'var(--primary, #2563eb)' : '#555',
            marginBottom: -2,
            fontSize: '0.9rem',
          }}
        >
          ❓ Preguntas adicionales
        </button>
      </div>

      {subTab === 'formulario' && <PreguntasFormularioSection showToast={showToast} />}
      {subTab === 'adicionales' && <PreguntasAdicionalesSection showToast={showToast} />}
    </div>
  )
}
