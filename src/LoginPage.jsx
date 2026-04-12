import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { loginUser as loginUserMock } from './mockApi.js'
import { DEMO_MODE } from './constants.js'

const DNI_NIE_REGEX = /^[0-9XYZ][0-9]{7}[A-Z]$/

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth()
  const [form, setForm] = useState({ dniNie: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null, global: null }))
  }

  const validate = () => {
    const errs = {}
    if (!DNI_NIE_REGEX.test(form.dniNie.trim().toUpperCase())) {
      errs.dniNie = 'Formato inválido. Ejemplo: 12345678A'
    }
    if (!form.password) {
      errs.password = 'Introduce tu contraseña'
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
    const dniNie = form.dniNie.trim().toUpperCase()
    const loginFn = DEMO_MODE ? loginUserMock : null
    if (!loginFn) {
      setErrors({ global: 'Modo real no implementado aún' })
      setLoading(false)
      return
    }
    const { data, error } = await loginFn({ dniNie, password: form.password })
    setLoading(false)
    if (error) {
      setErrors({ global: error.message })
      return
    }
    login({ dniNie: data.dniNie })
    onNavigate('#/perfil')
  }

  return (
    <>
      <header>
        <div className="logo">AEAT</div>
        <div className="header-text">
          <h1>Acceder a mi expediente</h1>
          <p>Campaña Renta 2025 · Impuesto sobre la Renta de las Personas Físicas (IRPF)</p>
        </div>
      </header>

      <div className="card">
        <div className="info-box">
          <strong>🔒 Acceso a tu expediente</strong>
          Introduce tu DNI/NIE y contraseña para consultar y modificar tu cuestionario fiscal.
          La contraseña es <strong>renta2025</strong>.
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="section-title">Identificación</div>
          {errors.global && (
            <div className="info-box info-box-error">❌ {errors.global}</div>
          )}
          <div className="form-grid">
            <div className="field">
              <label>Número de DNI / NIE</label>
              <input
                type="text"
                name="dniNie"
                value={form.dniNie}
                onChange={handleChange}
                placeholder="00000000A"
                maxLength={9}
                required
              />
              {errors.dniNie && <span className="field-error">{errors.dniNie}</span>}
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="renta2025"
                required
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Verificando…' : '🔑 Acceder'}
            </button>
          </div>
        </form>
      </div>

      <footer>
        <p>Este formulario es meramente informativo y no constituye una presentación oficial ante la AEAT.</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · Campaña de la Renta 2025</p>
      </footer>
    </>
  )
}
