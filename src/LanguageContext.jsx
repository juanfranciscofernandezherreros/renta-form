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

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const [languages, setLanguages] = useState(STATIC_LANGUAGES)
  const [translations, setTranslations] = useState({})
  const loadedRef = useRef(false)

  const loadFromDb = useCallback(async () => {
    try {
      const [idiomasRes, traduccionesRes] = await Promise.all([
        getIdiomas(),
        getTraducciones(),
      ])
      if (idiomasRes.data && Array.isArray(idiomasRes.data) && idiomasRes.data.length) {
        setLanguages(idiomasRes.data)
      }
      if (traduccionesRes.data && typeof traduccionesRes.data === 'object') {
        setTranslations(traduccionesRes.data)
      }
    } catch {
      // Fallback: keep static languages & keys as-is
    }
  }, [])

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      loadFromDb()
    }
  }, [loadFromDb])

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
    await loadFromDb()
  }, [loadFromDb])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages: languages }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
