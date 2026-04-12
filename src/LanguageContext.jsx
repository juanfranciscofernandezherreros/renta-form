/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'
import translations from './i18n.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const t = key => translations[lang]?.[key] ?? translations['es'][key] ?? key
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
