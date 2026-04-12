import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { loginUser as loginUserMock } from './mockApi.js'
import { DEMO_MODE } from './constants.js'

export default function AdminLoginPage() {
  const { login } = useAuth()
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
    const loginFn = DEMO_MODE ? loginUserMock : null
    if (!loginFn) {
      setErrors({ global: 'Modo real no implementado' })
      setLoading(false)
      return
    }
    const dniNie = form.username.trim().toUpperCase()
    const { data, error } = await loginFn({ dniNie, password: form.password })
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
        <div className="logo">NH Gestión Integral</div>
        <div className="header-text">
          <h1>Acceso al Panel de Administración</h1>
          <p>Gestión interna · Agencia Tributaria · Campaña Renta 2025</p>
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

      <footer>
        <p>Panel de administración interno · Agencia Tributaria · Campaña Renta 2025</p>
      </footer>
    </>
  )
}
