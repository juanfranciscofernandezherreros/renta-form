/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react'
import staticTranslations from './translations.js'

const LanguageContext = createContext(null)

const STATIC_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')

  const t = useCallback(
    (key) => {
      const langTranslations = staticTranslations[lang]
      if (langTranslations && langTranslations[key] !== undefined) {
        return langTranslations[key]
      }
      // Fallback to Spanish, then the key itself
      const esTranslations = staticTranslations.es
      if (esTranslations && esTranslations[key] !== undefined) {
        return esTranslations[key]
      }
      return key
    },
    [lang]
  )

  const reloadTranslations = useCallback(() => {}, [])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages: STATIC_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
