/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getIdiomas, getTraducciones } from './apiClient'

const LanguageContext = createContext(null)

const STATIC_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

async function fetchLanguageData() {
  const [idiomasRes, traduccionesRes] = await Promise.all([
    getIdiomas(),
    getTraducciones(),
  ])
  return { idiomasRes, traduccionesRes }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const [languages, setLanguages] = useState(STATIC_LANGUAGES)
  const [translations, setTranslations] = useState({})
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
    fetchLanguageData().then((data) => {
      if (!cancelled) applyData(data)
    }).catch((err) => {
      console.warn('Failed to load translations from DB:', err)
    })
    return () => { cancelled = true }
  }, [applyData])

  const t = useCallback(
    (key) => {
      const langTranslations = translations[lang]
      if (langTranslations && langTranslations[key] !== undefined) {
        return langTranslations[key]
      }
      // Fallback to Spanish, then the key itself
      const esTranslations = translations.es
      if (esTranslations && esTranslations[key] !== undefined) {
        return esTranslations[key]
      }
      return key
    },
    [lang, translations]
  )

  const reloadTranslations = useCallback(async () => {
    try {
      const data = await fetchLanguageData()
      applyData(data)
    } catch {
      // keep current state on error
    }
  }, [applyData])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages: languages }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

