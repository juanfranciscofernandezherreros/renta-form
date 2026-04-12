/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'renta_form_user'
const INTRANET_KEY = 'renta_form_intranet'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [intranetAccess, setIntranetAccess] = useState(() => {
    try {
      return sessionStorage.getItem(INTRANET_KEY) === 'true'
    } catch {
      return false
    }
  })

  const login = (userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const grantIntranetAccess = () => {
    try {
      sessionStorage.setItem(INTRANET_KEY, 'true')
    } catch {
      // sessionStorage not available
    }
    setIntranetAccess(true)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, intranetAccess, grantIntranetAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
