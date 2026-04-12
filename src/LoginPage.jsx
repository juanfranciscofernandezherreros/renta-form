import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const DNI_NIE_REGEX = /^[0-9XYZ][0-9]{7}[A-Z]$/

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth()
  const [form, setForm] = useState({ dniNie: '', email: '' })
  const [errors, setErrors] = useState({})

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!DNI_NIE_REGEX.test(form.dniNie.trim().toUpperCase())) {
      errs.dniNie = 'Formato inválido. Ejemplo: 12345678A'
    }
    if (!form.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      errs.email = 'Introduce un correo electrónico válido'
    }
    return errs
  }

  const handleSubmit = e => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    login({ dniNie: form.dniNie.trim().toUpperCase(), email: form.email.trim().toLowerCase() })
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
        <nav className="header-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
            ← Volver al formulario
          </button>
        </nav>
      </header>

      <div className="card">
        <div className="info-box">
          <strong>🔒 Acceso a tu expediente</strong>
          Introduce tu DNI/NIE y correo electrónico para consultar y modificar tu cuestionario fiscal.
          Estos datos deben coincidir con los que usaste al enviar el formulario.
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="section-title">Identificación</div>
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
              <label>Correo electrónico de contacto</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="ejemplo@correo.es"
                required
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary">
              🔑 Acceder
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
