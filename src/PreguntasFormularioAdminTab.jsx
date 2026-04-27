import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  listPreguntasFormulario,
  createPreguntaFormulario,
  updatePreguntaFormulario,
  deletePreguntaFormulario,
  getIdiomas,
} from './apiClient.js'
import Pagination from './Pagination.jsx'

const DEFAULT_LANGS = [{ code: 'es', label: 'Español' }]
const PAGE_LIMIT = 10

function makeEmptyForm(langs) {
  const textos = {}
  for (const { code } of langs) textos[code] = ''
  return { campo: '', orden: '', textos }
}

// Convert a Spanish text into a camelCase identifier suitable for the `campo`
// column. Strips diacritics, removes punctuation, splits on whitespace and
// lower-cases the first word while title-casing the rest. Returns '' when no
// alphanumeric character is found.
function slugifyToCampo(text) {
  if (!text || typeof text !== 'string') return ''
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase()
  const words = normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  const [first, ...rest] = words
  let head = first
  // `campo` must start with a letter
  if (/^[0-9]/.test(head)) head = `n${head}`
  return head + rest.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

// Ensures the proposed campo does not clash with any in `existing`.
// If it does, appends an incrementing numeric suffix (campo2, campo3, …).
function uniqueCampo(base, existing) {
  if (!base) return ''
  const taken = new Set(existing)
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}${i}`)) i += 1
  return `${base}${i}`
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PreguntasFormularioAdminTab({ showToast }) {
  const [preguntas, setPreguntas] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // null | 'edit' | 'create'
  const [editando, setEditando] = useState(null)
  const [langs, setLangs] = useState(DEFAULT_LANGS)
  const [form, setForm] = useState(() => makeEmptyForm(DEFAULT_LANGS))
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Load active languages once
  useEffect(() => {
    getIdiomas()
      .then(({ data, error: apiErr }) => {
        if (apiErr) {
          showToast('No se pudieron cargar los idiomas; se mostrará solo Español', 'error')
          return
        }
        if (Array.isArray(data) && data.length) {
          setLangs(data)
          setForm(makeEmptyForm(data))
        }
      })
      .catch(() => {
        showToast('No se pudieron cargar los idiomas; se mostrará solo Español', 'error')
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listPreguntasFormulario({ query: { page, limit: PAGE_LIMIT } })
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

  const openEdit = (pregunta) => {
    const textos = {}
    for (const { code } of langs) {
      textos[code] = pregunta.textos?.[code] ?? ''
    }
    setForm({ campo: pregunta.campo ?? '', orden: pregunta.orden ?? '', textos })
    setEditando(pregunta)
    setModal('edit')
  }

  const openCreate = () => {
    setForm(makeEmptyForm(langs))
    setEditando(null)
    setModal('create')
  }

  const closeModal = () => {
    setModal(null)
    setEditando(null)
    setForm(makeEmptyForm(langs))
  }

  const handleLangChange = (code, value) => {
    setForm(prev => ({ ...prev, textos: { ...prev.textos, [code]: value } }))
  }

  const handleCampoChange = (value) => {
    setForm(prev => ({ ...prev, campo: value }))
  }

  const handleSave = async () => {
    // Build textos with trimmed non-empty values. We require at least one
    // non-empty translation in any language — the application may be running
    // in any of the configured idiomas, so Spanish is not special here.
    const textos = {}
    for (const [code, val] of Object.entries(form.textos)) {
      const trimmed = (val || '').trim()
      if (trimmed) textos[code] = trimmed
    }
    if (Object.keys(textos).length === 0) {
      showToast('Debes introducir el texto de la pregunta en al menos un idioma', 'error')
      return
    }
    // Pick a source text for the auto-generated campo. Prefer ES when present
    // (keeps existing identifiers stable) and otherwise fall back to the first
    // language in the configured order that has text.
    const sourceText = textos.es
      || (langs.map(l => textos[l.code]).find(Boolean))
      || ''

    let campoTrim = (form.campo || '').trim()
    if (modal === 'create') {
      // In create mode the campo input is hidden — always derive it from the
      // available translations and make it locally unique against the
      // already-loaded preguntas.
      const base = slugifyToCampo(sourceText)
      if (!base) {
        showToast('No se pudo generar un identificador automático a partir del texto', 'error')
        return
      }
      campoTrim = uniqueCampo(base, preguntas.map(p => p.campo).filter(Boolean))
    } else if (campoTrim && !/^[a-z][a-zA-Z0-9]*$/.test(campoTrim)) {
      showToast('El campo debe ser camelCase (e.g. viviendaAlquiler)', 'error')
      return
    }
    let ordenNum
    if (form.orden !== '' && form.orden !== null && form.orden !== undefined) {
      ordenNum = parseInt(form.orden, 10)
      if (Number.isNaN(ordenNum)) {
        showToast('El orden debe ser un número entero', 'error')
        return
      }
    }

    setSaving(true)
    try {
      if (modal === 'create') {
        const body = { textos, campo: campoTrim }
        if (ordenNum !== undefined) body.orden = ordenNum
        const { error: apiErr } = await createPreguntaFormulario({ body })
        if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
        showToast('Pregunta creada correctamente')
      } else {
        const body = { textos }
        if (campoTrim && campoTrim !== editando.campo) body.campo = campoTrim
        if (ordenNum !== undefined) body.orden = ordenNum
        const { error: apiErr } = await updatePreguntaFormulario({
          path: { id: editando.id },
          body,
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

  const handleDelete = async (pregunta) => {
    const confirmText = (pregunta.texto || '').slice(0, 80)
    if (!window.confirm(`¿Eliminar la pregunta "${confirmText}"? Esta acción no se puede deshacer.`)) {
      return
    }
    const { error: apiErr } = await deletePreguntaFormulario({ path: { id: pregunta.id } })
    if (apiErr) {
      showToast(`Error: ${apiErr.message}`, 'error')
      return
    }
    showToast('Pregunta eliminada correctamente')
    refresh()
  }

  return (
    <div>
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} pregunta{total !== 1 ? 's' : ''} del formulario</span>
        </div>
        <div className="admin-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            ➕ Nueva pregunta
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando preguntas del formulario…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && preguntas.length === 0 && (
        <div className="info-box">No hay preguntas del formulario.</div>
      )}

      {!loading && !error && preguntas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Pregunta (ES)</th>
                <th style={{ whiteSpace: 'nowrap' }}>Campo</th>
                <th style={{ whiteSpace: 'nowrap' }}>Orden</th>
                <th style={{ whiteSpace: 'nowrap' }}>Tipo</th>
                <th style={{ whiteSpace: 'nowrap' }}>Idiomas</th>
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
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '.85em' }}>{p.campo}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{p.orden ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>Sí / No</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.85em', color: '#555' }}>
                    {p.textos
                      ? Object.keys(p.textos)
                          .filter(k => p.textos[k])
                          .map(code => langs.find(l => l.code === code)?.label || code)
                          .join(', ')
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
                        onClick={() => handleDelete(p)}
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

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_LIMIT)}
        onPageChange={setPage}
      />

      {/* Edit modal */}
      {modal && createPortal(
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {modal === 'create' ? '➕ Nueva pregunta del formulario' : '✏️ Editar pregunta del formulario'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {modal !== 'create' && (
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                      Campo (camelCase)
                    </label>
                    <input
                      type="text"
                      value={form.campo ?? ''}
                      onChange={e => handleCampoChange(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                      placeholder="viviendaAlquiler"
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Orden</label>
                  <input
                    type="number"
                    value={form.orden ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, orden: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="auto"
                  />
                </div>
              </div>
              {langs.map(({ code, label }) => (
                <div key={code}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                    {label} ({code.toUpperCase()})
                  </label>
                  <textarea
                    value={form.textos[code] ?? ''}
                    onChange={e => handleLangChange(code, e.target.value)}
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder={`Texto de la pregunta en ${label}…`}
                  />
                </div>
              ))}
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
                {saving ? 'Guardando…' : (modal === 'create' ? '➕ Crear' : '💾 Guardar')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
