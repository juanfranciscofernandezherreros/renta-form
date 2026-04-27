import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  listIdiomasAdmin,
  getIdiomaContent,
  updateIdiomaContent,
  getTraduccionesFaltantes,
} from './apiClient.js'
import Pagination from './Pagination.jsx'
import { useLanguage } from './LanguageContext.jsx'

const TEXTAREA_EXPAND_THRESHOLD = 80
const KEYS_PAGE_LIMIT = 20

export default function TraduccionesAdminTab({ showToast }) {
  const { reloadTranslations } = useLanguage()

  // List of idiomas (columns of the matrix)
  const [idiomas, setIdiomas] = useState([])
  const [idiomasLoading, setIdiomasLoading] = useState(true)
  const [idiomasError, setIdiomasError] = useState(null)

  // Missing translations summary (used both for the badge per idioma and to
  // pre-populate required keys that may not yet exist in any idioma)
  const [faltantesData, setFaltantesData] = useState(null)

  // Contents per idioma id: { [idiomaId]: { [clave]: valor } }
  const [contents, setContents] = useState({})
  // Snapshot of contents as last loaded/saved, used to detect dirtiness per idioma
  const [originalContents, setOriginalContents] = useState({})
  const [contentsLoading, setContentsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // UI state
  const [filter, setFilter] = useState('')
  const [keysPage, setKeysPage] = useState(1)
  const [newKey, setNewKey] = useState('')

  // Load all idiomas (paginate to a high limit so we get them all)
  const loadIdiomas = useCallback(async () => {
    setIdiomasLoading(true)
    setIdiomasError(null)
    const { data, error: apiErr } = await listIdiomasAdmin({ query: { page: 1, limit: 100 } })
    setIdiomasLoading(false)
    if (apiErr) { setIdiomasError(apiErr.message ?? 'Error desconocido'); return [] }
    const list = data?.data ?? []
    setIdiomas(list)
    return list
  }, [])

  // Load missing translations summary
  const loadFaltantes = useCallback(async () => {
    const { data } = await getTraduccionesFaltantes()
    if (data) setFaltantesData(data)
    return data
  }, [])

  // Load the content of every idioma in parallel.
  // `isCancelled` is an optional callback used by the initial-load effect to
  // skip state updates when the component has unmounted mid-flight.
  const loadAllContents = useCallback(async (list, isCancelled) => {
    if (!list?.length) {
      if (isCancelled?.()) return
      setContents({})
      setOriginalContents({})
      return
    }
    if (!isCancelled?.()) setContentsLoading(true)
    const results = await Promise.all(
      list.map(async (idioma) => {
        const { data, error: apiErr } = await getIdiomaContent({ path: { id: idioma.id } })
        return { idioma, content: apiErr ? {} : (data?.content ?? {}), error: apiErr }
      })
    )
    if (isCancelled?.()) return
    const map = {}
    for (const { idioma, content } of results) {
      map[idioma.id] = { ...content }
    }
    setContents(map)
    // Deep-clone for the original snapshot
    const snapshot = {}
    for (const id of Object.keys(map)) snapshot[id] = { ...map[id] }
    setOriginalContents(snapshot)
    setContentsLoading(false)
    const failed = results.filter(r => r.error)
    if (failed.length) {
      showToast(
        `Error al cargar contenido de: ${failed.map(f => f.idioma.code).join(', ')}`,
        'error'
      )
    }
  }, [showToast])

  // Initial load: idiomas + faltantes + every idioma's content
  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    ;(async () => {
      const [list] = await Promise.all([loadIdiomas(), loadFaltantes()])
      if (cancelled) return
      await loadAllContents(list, isCancelled)
    })()
    return () => { cancelled = true }
  }, [loadIdiomas, loadFaltantes, loadAllContents])

  // Union of all keys across idiomas + required keys from faltantesData so the
  // user can see and fill them in even if no idioma has them yet.
  // Keys with missing values (empty in some idioma) are listed first, so the
  // admin can focus on completing untranslated entries. The ordering is
  // computed from `originalContents` (the last loaded/saved snapshot) so rows
  // don't reorder while the user is typing; the order refreshes after save or
  // reload. Within the same missing-count bucket, keys are sorted alphabetically.
  const allKeys = useMemo(() => {
    const set = new Set()
    for (const id of Object.keys(contents)) {
      for (const k of Object.keys(contents[id])) set.add(k)
    }
    if (faltantesData?.claves_requeridas) {
      for (const k of faltantesData.claves_requeridas) set.add(k)
    }
    const idiomaIds = Object.keys(originalContents)
    const missingCount = (key) => {
      if (idiomaIds.length === 0) return 0
      let count = 0
      for (const id of idiomaIds) {
        const value = originalContents[id]?.[key]
        if (value === undefined || value === null || value === '') count++
      }
      return count
    }
    return Array.from(set).sort((a, b) => {
      const diff = missingCount(b) - missingCount(a)
      if (diff !== 0) return diff
      return a.localeCompare(b)
    })
  }, [contents, originalContents, faltantesData])

  const filteredKeys = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return allKeys
    return allKeys.filter(k => {
      if (k.toLowerCase().includes(f)) return true
      // also match by any value across idiomas
      for (const id of Object.keys(contents)) {
        const v = contents[id]?.[k]
        if (v && String(v).toLowerCase().includes(f)) return true
      }
      return false
    })
  }, [allKeys, filter, contents])

  const keysTotalPages = Math.max(1, Math.ceil(filteredKeys.length / KEYS_PAGE_LIMIT))
  const safeKeysPage = Math.min(keysPage, keysTotalPages)
  const pagedKeys = useMemo(
    () => filteredKeys.slice((safeKeysPage - 1) * KEYS_PAGE_LIMIT, safeKeysPage * KEYS_PAGE_LIMIT),
    [filteredKeys, safeKeysPage]
  )

  // Reset to first page whenever the filter changes
  useEffect(() => { setKeysPage(1) }, [filter])

  // Handlers
  const handleCellChange = (idiomaId, key, value) => {
    setContents(prev => ({
      ...prev,
      [idiomaId]: { ...(prev[idiomaId] ?? {}), [key]: value },
    }))
  }

  const handleDeleteKey = (key) => {
    setContents(prev => {
      const next = {}
      // Iterate over `idiomas` (not `prev`) so we preserve every language even
      // if one of them isn't yet in `contents` (e.g. failed to load).
      for (const idioma of idiomas) {
        const langCopy = { ...(prev[idioma.id] ?? {}) }
        delete langCopy[key]
        next[idioma.id] = langCopy
      }
      return next
    })
  }

  const handleAddKey = () => {
    const trimmed = newKey.trim()
    if (!trimmed) { showToast('La clave no puede estar vacía', 'error'); return }
    if (allKeys.includes(trimmed)) { showToast('Esa clave ya existe', 'error'); return }
    setContents(prev => {
      const next = {}
      // Iterate over `idiomas` so the new key is added to every language,
      // including any that weren't yet in `contents`.
      for (const idioma of idiomas) {
        const existing = prev[idioma.id] ?? {}
        next[idioma.id] = { ...existing, [trimmed]: existing[trimmed] ?? '' }
      }
      return next
    })
    setNewKey('')
  }

  // Per-idioma dirtiness check
  const isIdiomaDirty = useCallback((idiomaId) => {
    const current = contents[idiomaId] ?? {}
    const original = originalContents[idiomaId] ?? {}
    const keys = new Set([...Object.keys(current), ...Object.keys(original)])
    for (const k of keys) {
      if ((current[k] ?? '') !== (original[k] ?? '')) return true
    }
    return false
  }, [contents, originalContents])

  const dirtyIdiomas = useMemo(
    () => idiomas.filter(i => isIdiomaDirty(i.id)),
    [idiomas, isIdiomaDirty]
  )

  const handleSaveAll = async () => {
    if (!dirtyIdiomas.length) {
      showToast('No hay cambios pendientes', 'info')
      return
    }
    setSaving(true)
    try {
      const results = await Promise.all(
        dirtyIdiomas.map(async (idioma) => {
          const body = { content: contents[idioma.id] ?? {} }
          const { error: apiErr } = await updateIdiomaContent({ path: { id: idioma.id }, body })
          return { idioma, error: apiErr }
        })
      )
      const failed = results.filter(r => r.error)
      const ok = results.filter(r => !r.error)
      if (ok.length) {
        // Update original snapshot for successfully-saved idiomas so they
        // are no longer flagged as dirty.
        setOriginalContents(prev => {
          const next = { ...prev }
          for (const { idioma } of ok) next[idioma.id] = { ...(contents[idioma.id] ?? {}) }
          return next
        })
      }
      if (failed.length) {
        showToast(
          `Error al guardar ${failed.length} idioma(s): ${failed.map(f => f.idioma.code).join(', ')}`,
          'error'
        )
      } else {
        showToast(
          `Traducciones guardadas en ${ok.length} idioma${ok.length !== 1 ? 's' : ''}`
        )
      }
      reloadTranslations()
      loadFaltantes()
    } finally {
      setSaving(false)
    }
  }

  const handleReload = async () => {
    const list = await loadIdiomas()
    await loadFaltantes()
    await loadAllContents(list)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const isInitialLoading = idiomasLoading || (idiomas.length > 0 && contentsLoading && Object.keys(contents).length === 0)

  return (
    <div>
      <p style={{ fontSize: '.82rem', color: '#666', marginBottom: 16 }}>
        Todas las traducciones de cada idioma se cargan a la vez. Edita cualquier celda y guarda los cambios.
      </p>

      {idiomasError && <div className="info-box info-box-error">❌ {idiomasError}</div>}
      {isInitialLoading && <div className="info-box">⏳ Cargando traducciones…</div>}

      {!idiomasLoading && !idiomasError && idiomas.length === 0 && (
        <div className="info-box">
          No hay idiomas configurados. Ve a la pestaña «Idiomas» para crear uno.
        </div>
      )}

      {!isInitialLoading && !idiomasError && idiomas.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="admin-toolbar">
            <div className="admin-stats">
              <span className="admin-stat-badge">
                {idiomas.length} idioma{idiomas.length !== 1 ? 's' : ''}
              </span>
              <span className="admin-stat-badge">
                {allKeys.length} clave{allKeys.length !== 1 ? 's' : ''}
              </span>
              {dirtyIdiomas.length > 0 && (
                <span className="admin-stat-badge" style={{ background: '#fff3cd', color: '#856404' }}>
                  ● {dirtyIdiomas.length} con cambios sin guardar
                </span>
              )}
            </div>
            <div className="admin-filters">
              <input
                type="text"
                className="admin-filter-input"
                placeholder="Buscar clave o valor…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReload}
                disabled={contentsLoading || saving}
                title="Recargar todas las traducciones"
              >
                🔄 Recargar
              </button>
            </div>
          </div>

          {/* Matrix table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="preguntas-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                    Clave
                  </th>
                  {idiomas.map(idioma => {
                    const missingCount = faltantesData?.faltantes?.[idioma.code]?.length ?? null
                    const dirty = isIdiomaDirty(idioma.id)
                    return (
                      <th key={idioma.id} style={{ minWidth: 220 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{idioma.code}</span>
                            {' — '}
                            <span style={{ fontWeight: 500 }}>{idioma.label}</span>
                            {dirty && (
                              <span title="Cambios sin guardar" style={{ marginLeft: 6, color: '#b58900' }}>●</span>
                            )}
                          </span>
                          <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                            <span className={`estado-badge ${idioma.activo ? 'badge-activa' : 'badge-inactiva'}`}>
                              {idioma.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            {missingCount !== null && (
                              missingCount > 0 ? (
                                <span className="estado-badge badge-inactiva" title="Claves requeridas sin traducir">
                                  ⚠️ {missingCount}
                                </span>
                              ) : (
                                <span className="estado-badge badge-activa" title="Todas las claves requeridas presentes">
                                  ✓
                                </span>
                              )
                            )}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                  <th style={{ width: 60, textAlign: 'center' }}>Borrar</th>
                </tr>
              </thead>
              <tbody>
                {pagedKeys.length === 0 && (
                  <tr>
                    <td colSpan={idiomas.length + 2} style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '12px 0' }}>
                      {filter.trim() ? 'No se encontraron claves.' : 'No hay traducciones todavía. Añade la primera a continuación.'}
                    </td>
                  </tr>
                )}
                {pagedKeys.map(key => (
                  <tr key={key}>
                    <td style={{ fontFamily: 'monospace', fontSize: '.78rem', color: '#555', verticalAlign: 'top', paddingTop: 10, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                      {key}
                    </td>
                    {idiomas.map(idioma => {
                      const value = contents[idioma.id]?.[key] ?? ''
                      const isEmpty = value === ''
                      return (
                        <td key={idioma.id} style={{ verticalAlign: 'top' }}>
                          <textarea
                            rows={String(value).length > TEXTAREA_EXPAND_THRESHOLD ? 3 : 1}
                            value={value}
                            onChange={e => handleCellChange(idioma.id, key, e.target.value)}
                            placeholder={isEmpty ? 'Sin traducir' : undefined}
                            style={{
                              width: '100%',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              fontSize: '.85rem',
                              padding: '4px 6px',
                              border: `1px solid ${isEmpty ? '#e0a800' : '#ccc'}`,
                              borderRadius: 4,
                              background: isEmpty ? '#fffbea' : '#fff',
                            }}
                          />
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-xs"
                        onClick={() => handleDeleteKey(key)}
                        title="Eliminar esta clave en todos los idiomas"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Add new key row */}
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
                  <td colSpan={idiomas.length} style={{ color: '#888', fontStyle: 'italic', fontSize: '.82rem' }}>
                    La clave se añadirá vacía en todos los idiomas. Rellena los valores en cada celda y pulsa «Guardar».
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

          <Pagination
            page={safeKeysPage}
            totalPages={keysTotalPages}
            onPageChange={setKeysPage}
          />

          {/* Footer actions */}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || dirtyIdiomas.length === 0}
              onClick={handleSaveAll}
            >
              {saving
                ? 'Guardando…'
                : dirtyIdiomas.length === 0
                  ? '💾 Guardar traducciones'
                  : `💾 Guardar (${dirtyIdiomas.length} idioma${dirtyIdiomas.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
