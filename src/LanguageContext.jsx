/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, memo } from 'react'
import { getIdiomas, getTraducciones } from './apiClient'

const LanguageContext = createContext(null)

const STATIC_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

const EMPTY_DICT = Object.freeze({})

async function fetchLanguageData() {
  const [idiomasRes, traduccionesRes] = await Promise.all([
    getIdiomas(),
    getTraducciones(),
  ])
  return { idiomasRes, traduccionesRes }
}

const FALLBACK_CONTAINER_STYLE = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontFamily: "'Nunito', 'Segoe UI', Arial, sans-serif",
  fontWeight: 600,
  fontSize: '14px',
  letterSpacing: '0.02em',
}

const FALLBACK_SPINNER_STYLE = {
  width: 18,
  height: 18,
  marginRight: 10,
  border: '2px solid rgba(255,255,255,0.35)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  display: 'inline-block',
  animation: 'rf-spin 0.8s linear infinite',
}

const LoadingFallback = memo(function LoadingFallback() {
  return (
    <div role="status" aria-live="polite" style={FALLBACK_CONTAINER_STYLE}>
      <span aria-hidden="true" style={FALLBACK_SPINNER_STYLE} />
      <style>{`@keyframes rf-spin { to { transform: rotate(360deg); } }`}</style>
      Cargando…
    </div>
  )
})

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const [languages, setLanguages] = useState(STATIC_LANGUAGES)
  const [translations, setTranslations] = useState(EMPTY_DICT)
  const [ready, setReady] = useState(false)
  const loadedRef = useRef(false)

  const applyData = useCallback(({ idiomasRes, traduccionesRes }) => {
    if (idiomasRes.data && Array.isArray(idiomasRes.data) && idiomasRes.data.length) {
      setLanguages(idiomasRes.data)
    }
    if (traduccionesRes.data && typeof traduccionesRes.data === 'object') {
      setTranslations(traduccionesRes.data)
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    let cancelled = false
    fetchLanguageData()
      .then((data) => {
        if (!cancelled) applyData(data)
      })
      .catch((err) => {
        console.warn('Failed to load translations from DB:', err)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => { cancelled = true }
  }, [applyData])

  // Pre-compute the dictionary for the active language so that `t` lookups are
  // O(1) hash hits without having to index `translations[lang]` on every call.
  const currentDict = useMemo(
    () => translations[lang] || EMPTY_DICT,
    [translations, lang]
  )

  // `t` is rebuilt only when the active dictionary actually changes (language
  // switch or initial load). Within a single dictionary, calls are pure hash
  // lookups. Depending on `currentDict` directly avoids any stale-read
  // window during render.
  const t = useCallback((key) => {
    const value = currentDict[key]
    return value !== undefined && value !== '' ? value : key
  }, [currentDict])

  const reloadTranslations = useCallback(async () => {
    try {
      const data = await fetchLanguageData()
      applyData(data)
    } catch {
      // keep current state on error
    }
  }, [applyData])

  const value = useMemo(
    () => ({ lang, setLang, t, reloadTranslations, availableLanguages: languages, ready }),
    [lang, t, reloadTranslations, languages, ready]
  )

  return (
    <LanguageContext.Provider value={value}>
      {ready ? children : <LoadingFallback />}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

