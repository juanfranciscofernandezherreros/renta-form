import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  listIdiomasAdmin,
  getIdiomaContent,
  updateIdiomaContent,
  getTraduccionesFaltantes,
} from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'

const TEXTAREA_EXPAND_THRESHOLD = 80

export default function TraduccionesAdminTab({ showToast }) {
  const { reloadTranslations } = useLanguage()

  // Idioma list
  const [idiomas, setIdiomas] = useState([])
  const [idiomasLoading, setIdiomasLoading] = useState(true)
  const [idiomasError, setIdiomasError] = useState(null)

  // Missing translations summary
  const [faltantesData, setFaltantesData] = useState(null)

  // Selected idioma + its content panel
  const [selected, setSelected] = useState(null) // idioma object
  const [content, setContent] = useState({})
  const [contentLoading, setContentLoading] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [contentFilter, setContentFilter] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)

  // New translation row
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const panelRef = useRef(null)
  const containerRef = useRef(null)

  // Load all idiomas (no pagination needed here, fetch all)
  const loadIdiomas = useCallback(async () => {
    setIdiomasLoading(true)
    setIdiomasError(null)
    const { data, error: apiErr } = await listIdiomasAdmin({ query: { page: 1, limit: 100 } })
    setIdiomasLoading(false)
    if (apiErr) { setIdiomasError(apiErr.message ?? 'Error desconocido'); return }
    setIdiomas(data?.data ?? [])
  }, [])

  // Load missing translations summary
  const loadFaltantes = useCallback(async () => {
    const { data } = await getTraduccionesFaltantes()
    if (data) setFaltantesData(data)
  }, [])

  useEffect(() => { loadIdiomas() }, [loadIdiomas])
  useEffect(() => { loadFaltantes() }, [loadFaltantes])

  const openPanel = async (idioma) => {
    setSelected(idioma)
    setContentFilter('')
    setNewKey('')
    setNewValue('')
    setPanelOpen(true)
    setContentLoading(true)
    const { data, error: apiErr } = await getIdiomaContent({ path: { id: idioma.id } })
    setContentLoading(false)
    if (apiErr) { showToast(`Error al cargar contenido: ${apiErr.message}`, 'error'); return }
    const loaded = data?.content ?? {}
    // Pre-populate with required keys that are missing so the user knows what to fill in
    if (faltantesData?.claves_requeridas) {
      const withMissing = { ...loaded }
      for (const key of faltantesData.claves_requeridas) {
        if (!(key in withMissing)) withMissing[key] = ''
      }
      setContent(withMissing)
    } else {
      setContent(loaded)
    }
  }

  const closePanel = () => {
    setPanelOpen(false)
    setSelected(null)
    setContent({})
    setContentFilter('')
    setNewKey('')
    setNewValue('')
  }

  const handleContentChange = (key, value) => {
    setContent(prev => ({ ...prev, [key]: value }))
  }

  const handleDeleteKey = (key) => {
    setContent(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleAddKey = () => {
    const trimmedKey = newKey.trim()
    if (!trimmedKey) { showToast('La clave no puede estar vacía', 'error'); return }
    if (Object.prototype.hasOwnProperty.call(content, trimmedKey)) {
      showToast('Esa clave ya existe', 'error'); return
    }
    setContent(prev => ({ ...prev, [trimmedKey]: newValue }))
    setNewKey('')
    setNewValue('')
  }

  const handleSave = async () => {
    setContentSaving(true)
    try {
      const { error: apiErr } = await updateIdiomaContent({ path: { id: selected.id }, body: { content } })
      if (apiErr) { showToast(`Error al guardar: ${apiErr.message}`, 'error'); return }
      showToast(`Traducciones de "${selected.label}" guardadas correctamente`)
      reloadTranslations()
      loadFaltantes()
      closePanel()
    } finally {
      setContentSaving(false)
    }
  }

  const filteredKeys = Object.keys(content).filter(k =>
    !contentFilter.trim() ||
    k.toLowerCase().includes(contentFilter.toLowerCase()) ||
    String(content[k]).toLowerCase().includes(contentFilter.toLowerCase())
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <p style={{ fontSize: '.82rem', color: '#666', marginBottom: 16 }}>
        Selecciona un idioma para ver y editar sus traducciones.
      </p>

      {idiomasLoading && <div className="info-box">⏳ Cargando idiomas…</div>}
      {idiomasError && <div className="info-box info-box-error">❌ {idiomasError}</div>}

      {!idiomasLoading && !idiomasError && idiomas.length === 0 && (
        <div>
          <div className="info-box">No hay idiomas configurados. Ve a la pestaña «Idiomas» para crear uno.</div>
          {faltantesData?.claves_requeridas?.length > 0 && (
            <div className="info-box" style={{ marginTop: 10 }}>
              <strong>Claves de traducción requeridas ({faltantesData.claves_requeridas.length}):</strong>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {faltantesData.claves_requeridas.map(k => (
                  <span key={k} style={{ fontFamily: 'monospace', fontSize: '.78rem', background: '#f3eeff', border: '1px solid #c9b4f5', borderRadius: 4, padding: '2px 7px' }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idioma cards */}
      {!idiomasLoading && !idiomasError && idiomas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {idiomas.map(idioma => {
            const missingCount = faltantesData?.faltantes?.[idioma.code]?.length ?? null
            return (
              <button
                key={idioma.id}
                type="button"
                onClick={() => openPanel(idioma)}
                className={`traduccion-idioma-card${selected?.id === idioma.id && panelOpen ? ' selected' : ''}`}
              >
                <span className="traduccion-idioma-code">{idioma.code}</span>
                <span className="traduccion-idioma-label">{idioma.label}</span>
                {!idioma.activo && (
                  <span className="estado-badge badge-inactiva" style={{ fontSize: '.65rem', marginTop: 4 }}>Inactivo</span>
                )}
                {missingCount !== null && missingCount > 0 && (
                  <span className="estado-badge badge-inactiva" style={{ fontSize: '.65rem', marginTop: 4 }}>
                    ⚠️ {missingCount} faltante{missingCount !== 1 ? 's' : ''}
                  </span>
                )}
                {missingCount === 0 && (
                  <span className="estado-badge badge-activa" style={{ fontSize: '.65rem', marginTop: 4 }}>
                    ✓ Completo
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Absolutely positioned content panel */}
      {panelOpen && selected && createPortal(
        <div
          ref={panelRef}
          className="traduccion-panel"
          role="dialog"
          aria-modal="true"
          aria-label={`Traducciones: ${selected.label}`}
        >
          {/* Panel header */}
          <div className="traduccion-panel-header">
            <h3 className="traduccion-panel-title">
              🌐 Traducciones — <em>{selected.label}</em>
              <span style={{ fontFamily: 'monospace', fontSize: '.8rem', marginLeft: 6, color: '#999' }}>
                ({selected.code})
              </span>
            </h3>
            <button
              type="button"
              className="traduccion-panel-close"
              onClick={closePanel}
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>

          {contentLoading && <div className="info-box">⏳ Cargando traducciones…</div>}

          {!contentLoading && (
            <>
              {/* Search */}
              <div style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  className="admin-filter-input"
                  placeholder="Buscar clave o valor…"
                  value={contentFilter}
                  onChange={e => setContentFilter(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Table */}
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <table className="preguntas-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '58%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Traducción</th>
                      <th style={{ textAlign: 'center' }}>Borrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeys.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '10px 0' }}>
                          {contentFilter.trim() ? 'No se encontraron claves.' : 'No hay traducciones todavía. Añade la primera a continuación.'}
                        </td>
                      </tr>
                    )}
                    {filteredKeys.map(key => (
                      <tr key={key}>
                        <td style={{ fontFamily: 'monospace', fontSize: '.78rem', color: '#555', verticalAlign: 'top', paddingTop: 10 }}>
                          {key}
                        </td>
                        <td>
                          <textarea
                            rows={String(content[key] ?? '').length > TEXTAREA_EXPAND_THRESHOLD ? 3 : 1}
                            value={content[key] ?? ''}
                            onChange={e => handleContentChange(key, e.target.value)}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '.85rem', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-xs"
                            onClick={() => handleDeleteKey(key)}
                            title="Eliminar clave"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Add new row — always visible */}
                    <tr style={{ background: '#f9f6ff' }}>
                      <td>
                        <input
                          type="text"
                          value={newKey}
                          onChange={e => setNewKey(e.target.value)}
                          placeholder="nueva.clave"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: '.82rem', padding: '4px 6px', border: '1px dashed #b89ef0', borderRadius: 4 }}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddKey() }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={newValue}
                          onChange={e => setNewValue(e.target.value)}
                          placeholder="Traducción…"
                          style={{ width: '100%', fontSize: '.85rem', padding: '4px 6px', border: '1px dashed #b89ef0', borderRadius: 4 }}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddKey() }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm btn-xs"
                          onClick={handleAddKey}
                          title="Añadir clave"
                        >
                          ➕
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer actions */}
              <div className="btn-row" style={{ marginTop: 12, flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={closePanel}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" disabled={contentSaving} onClick={handleSave}>
                  {contentSaving ? 'Guardando…' : '💾 Guardar traducciones'}
                </button>
              </div>
            </>
          )}
        </div>
      , document.body)}
    </div>
  )
}
