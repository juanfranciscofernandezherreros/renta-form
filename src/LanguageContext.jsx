/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react'

const LanguageContext = createContext(null)

const STATIC_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')

  // No DB-backed translations — return the key as-is
  const t = useCallback((key) => key, [])

  // No-op kept for API compatibility with any callers
  const reloadTranslations = useCallback(async () => {}, [])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages: STATIC_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
