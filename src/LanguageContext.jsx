/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import staticTranslations, { LANGUAGES as STATIC_LANGUAGES } from './i18n.js'
import { listIdiomasAdmin, getIdiomaContent } from './apiClient.js'

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

  // Load languages & translations from API on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    ;(async () => {
      try {
        const { data } = await listIdiomasAdmin({ query: { limit: 100 } })
        if (data?.data?.length) {
          setIdiomas(data.data)
          const newTranslations = { ...defaultTranslations }
          for (const idioma of data.data.filter(i => i.activo)) {
            const { data: contentData } = await getIdiomaContent({ path: { id: idioma.id } })
            if (contentData?.content && Object.keys(contentData.content).length > 0) {
              newTranslations[contentData.code] = {
                ...(newTranslations[contentData.code] ?? {}),
                ...contentData.content,
              }
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
      const { data } = await listIdiomasAdmin({ query: { limit: 100 } })
      if (data?.data?.length) {
        setIdiomas(data.data)
        const newTranslations = { ...defaultTranslations }
        for (const idioma of data.data.filter(i => i.activo)) {
          const { data: contentData } = await getIdiomaContent({ path: { id: idioma.id } })
          if (contentData?.content && Object.keys(contentData.content).length > 0) {
            newTranslations[contentData.code] = {
              ...(newTranslations[contentData.code] ?? {}),
              ...contentData.content,
            }
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
