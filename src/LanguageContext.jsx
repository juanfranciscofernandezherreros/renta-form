/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import staticTranslations, { LANGUAGES as STATIC_LANGUAGES } from './i18n.js'
import { getIdiomas, getTraducciones } from './apiClient.js'

const LanguageContext = createContext(null)

const defaultIdiomas = STATIC_LANGUAGES.map(l => ({ code: l.code, label: l.label, activo: true }))
const defaultTranslations = Object.fromEntries(
  Object.entries(staticTranslations).map(([code, keys]) => [code, { ...keys }])
)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const [idiomas, setIdiomas] = useState(defaultIdiomas)
  const [translations, setTranslations] = useState(defaultTranslations)
  const loadedRef = useRef(false)

  // Load languages & translations from DB via public endpoints on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    ;(async () => {
      try {
        const [idiomasRes, traduccionesRes] = await Promise.all([
          getIdiomas(),
          getTraducciones(),
        ])
        if (idiomasRes.data?.length) {
          setIdiomas(idiomasRes.data.map(i => ({ ...i, activo: true })))
        }
        if (traduccionesRes.data && Object.keys(traduccionesRes.data).length > 0) {
          const newTranslations = { ...defaultTranslations }
          for (const [code, keys] of Object.entries(traduccionesRes.data)) {
            newTranslations[code] = {
              ...(newTranslations[code] ?? {}),
              ...keys,
            }
          }
          setTranslations(newTranslations)
        }
      } catch {
        // Silently fall back to static translations
      }
    })()
  }, [])

  const reloadTranslations = useCallback(async () => {
    try {
      const [idiomasRes, traduccionesRes] = await Promise.all([
        getIdiomas(),
        getTraducciones(),
      ])
      if (idiomasRes.data?.length) {
        setIdiomas(idiomasRes.data.map(i => ({ ...i, activo: true })))
      }
      if (traduccionesRes.data && Object.keys(traduccionesRes.data).length > 0) {
        const newTranslations = { ...defaultTranslations }
        for (const [code, keys] of Object.entries(traduccionesRes.data)) {
          newTranslations[code] = {
            ...(newTranslations[code] ?? {}),
            ...keys,
          }
        }
        setTranslations(newTranslations)
      }
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback((key) => {
    return translations[lang]?.[key] ?? translations['es']?.[key] ?? key
  }, [lang, translations])

  const availableLanguages = idiomas.filter(i => i.activo).map(i => ({ code: i.code, label: i.label }))

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
