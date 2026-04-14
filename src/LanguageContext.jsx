/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getIdiomas, getTraducciones } from './apiClient.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const [idiomas, setIdiomas] = useState([])
  const [translations, setTranslations] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
        if (idiomasRes.error) throw new Error(idiomasRes.error.message ?? 'Error cargando idiomas')
        if (traduccionesRes.error) throw new Error(traduccionesRes.error.message ?? 'Error cargando traducciones')
        setIdiomas(idiomasRes.data ?? [])
        const newTranslations = {}
        for (const [code, keys] of Object.entries(traduccionesRes.data ?? {})) {
          newTranslations[code] = { ...keys }
        }
        setTranslations(newTranslations)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const reloadTranslations = useCallback(async () => {
    const [idiomasRes, traduccionesRes] = await Promise.all([
      getIdiomas(),
      getTraducciones(),
    ])
    if (idiomasRes.error) throw new Error(idiomasRes.error.message ?? 'Error cargando idiomas')
    if (traduccionesRes.error) throw new Error(traduccionesRes.error.message ?? 'Error cargando traducciones')
    setIdiomas(idiomasRes.data ?? [])
    const newTranslations = {}
    for (const [code, keys] of Object.entries(traduccionesRes.data ?? {})) {
      newTranslations[code] = { ...keys }
    }
    setTranslations(newTranslations)
  }, [])

  const t = useCallback((key) => {
    return translations[lang]?.[key] ?? translations['es']?.[key] ?? key
  }, [lang, translations])

  const availableLanguages = idiomas.map(i => ({ code: i.code, label: i.label }))

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  }

  if (error) {
    return <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>Error: {error}</div>
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
