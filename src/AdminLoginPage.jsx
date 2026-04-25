import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { loginUser } from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'


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
    const dniNie = form.username.trim().toUpperCase()
    const { data, error } = await loginUser({ dniNie, password: form.password })
    setLoading(false)
    if (error) {
      setErrors({ global: error.message })
      return
    }
    if (data.role !== 'admin') {
      setErrors({ global: 'No tienes permisos de administrador' })
      return
    }
    login({ dniNie: data.dniNie, role: data.role })
  }

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="logo">{t('logoText')}</div>
        </div>
      </header>

      <div className="card">
        <form onSubmit={handleSubmit} noValidate>
          <div className="section-title">Identificación de administrador</div>
          {errors.global && (
            <div className="info-box info-box-error">❌ {errors.global}</div>
          )}
          <div className="form-grid">
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
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Accediendo…' : '🔑 Acceder al panel'}
            </button>
          </div>
        </form>
      </div>


  )
}
