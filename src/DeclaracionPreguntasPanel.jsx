import { useState, useEffect } from 'react'
import {
  getDeclaracionPreguntas,
  upsertDeclaracionPreguntas,
  removeDeclaracionPregunta,
  listPreguntasAdmin,
} from './mockApi.js'

const TIPO_LABELS = { yn: 'Sí / No', texto: 'Texto libre', numero: 'Número' }

export default function DeclaracionPreguntasPanel({ declaracionId, showToast }) {
  const [asignaciones, setAsignaciones] = useState([])
  const [allPreguntas, setAllPreguntas] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [respuestasLocales, setRespuestasLocales] = useState({})
  const [saving, setSaving] = useState({})
  const [addModal, setAddModal] = useState(false)
  const [selectedPregunta, setSelectedPregunta] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getDeclaracionPreguntas({ path: { id: declaracionId } }),
      listPreguntasAdmin({ query: { activa: true } }),
    ])
      .then(([{ data: asData, error: asErr }, { data: prData, error: prErr }]) => {
        if (cancelled) return
        if (asErr) throw new Error(asErr.message)
        if (prErr) throw new Error(prErr.message)
        setAsignaciones(asData?.data ?? [])
        setAllPreguntas(prData?.data ?? [])
        setError(null)
        const init = {}
        ;(asData?.data ?? []).forEach(a => { init[a.preguntaId] = a.respuesta ?? '' })
        setRespuestasLocales(init)
        setStatus('ready')
      })
      .catch(err => { if (!cancelled) { setError(err.message); setStatus('error') } })
    return () => { cancelled = true }
  }, [declaracionId, refreshKey])

  const assignedIds = new Set(asignaciones.map(a => a.preguntaId))
  const availableToAdd = allPreguntas.filter(p => !assignedIds.has(p.id))

  const handleRespuestaChange = (preguntaId, value) => {
    setRespuestasLocales(prev => ({ ...prev, [preguntaId]: value }))
  }

  const handleSaveRespuesta = async (preguntaId) => {
    setSaving(prev => ({ ...prev, [preguntaId]: true }))
    const { error: apiErr } = await upsertDeclaracionPreguntas({
      path: { id: declaracionId },
      body: { asignaciones: [{ preguntaId, respuesta: respuestasLocales[preguntaId] || null }] },
    })
    setSaving(prev => ({ ...prev, [preguntaId]: false }))
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast('Respuesta guardada')
    setRefreshKey(k => k + 1)
  }

  const handleRemove = async (preguntaId) => {
    const { error: apiErr } = await removeDeclaracionPregunta({
      path: { id: declaracionId, preguntaId },
    })
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast('Pregunta desasignada')
    setRefreshKey(k => k + 1)
  }

  const handleAdd = async () => {
    if (!selectedPregunta) return
    const { error: apiErr } = await upsertDeclaracionPreguntas({
      path: { id: declaracionId },
      body: { asignaciones: [{ preguntaId: selectedPregunta, respuesta: null }] },
    })
    setAddModal(false)
    setSelectedPregunta('')
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast('Pregunta asignada a la declaración')
    setRefreshKey(k => k + 1)
  }

  if (status === 'loading') return <div className="info-box">⏳ Cargando preguntas adicionales…</div>
  if (status === 'error') return <div className="info-box info-box-error">❌ {error}</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: '.85rem', color: '#555' }}>
          {asignaciones.length} pregunta{asignaciones.length !== 1 ? 's' : ''} asignada{asignaciones.length !== 1 ? 's' : ''}
        </span>
        {availableToAdd.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-xs"
            onClick={() => setAddModal(true)}
          >
            ➕ Asignar pregunta
          </button>
        )}
      </div>

      {asignaciones.length === 0 && (
        <div className="info-box">No hay preguntas adicionales asignadas a esta declaración.</div>
      )}

      <div className="dec-preguntas-list">
        {asignaciones.map(a => {
          const p = a.pregunta
          if (!p) return null
          const respuesta = respuestasLocales[a.preguntaId] ?? ''
          const isSaving = saving[a.preguntaId]

          return (
            <div key={a.id} className="dec-pregunta-item">
              <div className="dec-pregunta-texto">
                <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{p.texto}</div>
                <div style={{ fontSize: '.76rem', color: '#888', marginTop: 2 }}>
                  📂 {p.seccion} · {TIPO_LABELS[p.tipoRespuesta]}
                  {a.respondidaEn && (
                    <span style={{ marginLeft: 8 }}>
                      ✅ Respondida: {new Date(a.respondidaEn).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              </div>

              <div className="dec-pregunta-respuesta">
                {p.tipoRespuesta === 'yn' ? (
                  <select
                    value={respuesta}
                    onChange={e => handleRespuestaChange(a.preguntaId, e.target.value)}
                  >
                    <option value="">— Sin respuesta —</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <input
                    type={p.tipoRespuesta === 'numero' ? 'number' : 'text'}
                    value={respuesta}
                    placeholder={p.tipoRespuesta === 'numero' ? '0' : 'Respuesta…'}
                    onChange={e => handleRespuestaChange(a.preguntaId, e.target.value)}
                  />
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-xs"
                  disabled={isSaving}
                  onClick={() => handleSaveRespuesta(a.preguntaId)}
                  title="Guardar respuesta"
                >
                  {isSaving ? '…' : '💾'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm btn-xs"
                  onClick={() => handleRemove(a.preguntaId)}
                  title="Desasignar pregunta"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add question modal */}
      {addModal && (
        <div className="admin-modal-overlay" onClick={() => setAddModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">➕ Asignar pregunta adicional</h2>
            <p className="admin-modal-desc">Selecciona una pregunta activa para asignarla a esta declaración.</p>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Pregunta</label>
              <select
                value={selectedPregunta}
                onChange={e => setSelectedPregunta(e.target.value)}
              >
                <option value="">— Selecciona una pregunta —</option>
                {availableToAdd.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.seccion}] {p.texto.slice(0, 80)}{p.texto.length > 80 ? '…' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setAddModal(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedPregunta}
                onClick={handleAdd}
              >
                ➕ Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
