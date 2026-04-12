/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react'
import { translationsStore, idiomasStore } from './demoData.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('es')
  const [translationVersion, forceUpdate] = useState(0)

  const reloadTranslations = useCallback(() => forceUpdate(n => n + 1), [])

  const t = (key) => {
    // translationVersion is read here so that any call to reloadTranslations()
    // triggers a re-render and picks up the latest values from translationsStore.
    void translationVersion
    return translationsStore[lang]?.[key] ?? translationsStore['es']?.[key] ?? key
  }

  const availableLanguages = idiomasStore.filter(i => i.activo).map(i => ({ code: i.code, label: i.label }))

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, reloadTranslations, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
