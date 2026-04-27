/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'renta_form_user'

const AuthContext = createContext(null)

/** Decode the `exp` (seconds since epoch) from a JWT-like bearer token. */
function getTokenExp(token) {
  try {
    if (typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const pad = 4 - (parts[1].length % 4)
    const padded = pad === 4 ? parts[1] : parts[1] + '='.repeat(pad)
    const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/** Helper: check if a stored user has the admin role (handles legacy single-role and new array form). */
function hasAdminRole(parsed) {
  if (!parsed) return false
  if (Array.isArray(parsed.roles)) return parsed.roles.includes('admin')
  return parsed.role === 'admin'
}

/** Return the stored user, or null if the admin token has already expired. */
function loadStoredUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (!parsed) return null
    if (hasAdminRole(parsed)) {
      const exp = getTokenExp(parsed.token)
      if (exp !== null && exp < Math.floor(Date.now() / 1000)) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)
  const timerRef = useRef(null)

  /** Schedule auto-logout for admin sessions when their token expires. */
  const scheduleAdminExpiry = (userData) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!userData || !hasAdminRole(userData)) return
    const exp = getTokenExp(userData.token)
    if (exp === null) return
    const msUntilExpiry = exp * 1000 - Date.now()
    if (msUntilExpiry <= 0) {
      localStorage.removeItem(STORAGE_KEY)
      setUser(null)
      return
    }
    timerRef.current = setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY)
      setUser(null)
      timerRef.current = null
    }, msUntilExpiry)
  }

  // Schedule expiry for sessions that were already stored when the app loads.
  useEffect(() => {
    scheduleAdminExpiry(user)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    setUser(userData)
    scheduleAdminExpiry(userData)
  }

  const updateUser = (patch) => {
    setUser(prev => {
      const next = { ...(prev ?? {}), ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      scheduleAdminExpiry(next)
      return next
    })
  }

  const logout = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
