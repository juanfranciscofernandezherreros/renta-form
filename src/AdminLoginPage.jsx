import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { loginAdmin } from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'
import './adminlte.css'


export default function AdminLoginPage() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null, global: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.username.trim()) {
      errs.username = 'El usuario es obligatorio'
    }
    if (!form.password) {
      errs.password = 'La contraseña es obligatoria'
    }
    return errs
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setLoading(true)
    const { data, error } = await loginAdmin({ username: form.username.trim(), password: form.password })
    setLoading(false)
    if (error) {
      setErrors({ global: error.message })
      return
    }
    if (data.role !== 'admin') {
      setErrors({ global: 'No tienes permisos de administrador' })
      return
    }
    login({ dniNie: data.username, role: data.role, email: data.email ?? '', token: data.token })
  }

  return (
    <div className="adminlte-login-page">
      <div className="login-box">
        <div className="login-logo">
          <a href="#/backend_admin">🏛️ {t('logoText')}</a>
        </div>
        <div className="login-card-body">
          <p className="login-box-msg">Identificación de administrador</p>
          <form onSubmit={handleSubmit} noValidate>
            {errors.global && (
              <div className="info-box info-box-error">❌ {errors.global}</div>
            )}
            <div className="field">
              <label>Usuario</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Usuario administrador"
                required
                autoComplete="username"
              />
              {errors.username && <span className="field-error">{errors.username}</span>}
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Contraseña"
                required
                autoComplete="current-password"
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Accediendo…' : '🔑 Acceder al panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
