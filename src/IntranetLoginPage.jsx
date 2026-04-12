import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { verificarCodigoAcceso } from './mockApi.js'
import { DEMO_MODE } from './constants.js'

export default function IntranetLoginPage() {
  const { grantIntranetAccess } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!codigo.trim()) {
      setError('El código de acceso es obligatorio')
      return
    }
    setLoading(true)
    setError(null)

    const verificarFn = DEMO_MODE ? verificarCodigoAcceso : null
    if (!verificarFn) {
      setError('Modo real no implementado')
      setLoading(false)
      return
    }

    const { data, error: apiError } = await verificarFn({ codigo })
    setLoading(false)
    if (apiError) {
      setError(apiError.message)
      return
    }
    if (data?.valido) {
      grantIntranetAccess()
    }
  }

  return (
    <>
      <header>
        <div className="logo">NH Gestión Integral</div>
        <div className="header-text">
          <h1>Acceso a la Intranet</h1>
          <p>Área restringida · Agencia Tributaria · Campaña Renta 2025</p>
        </div>
      </header>

      <div className="card">
        <div className="info-box">
          <strong>🔒 Zona de acceso restringido</strong>
          <br />
          Esta aplicación es de uso interno. Introduzca el código de acceso
          proporcionado por su gestor para continuar.
          {DEMO_MODE && (
            <>
              <br /><br />
              <strong>Código de demo:</strong> <code>intranet2025</code>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="section-title">Identificación de intranet</div>
          {error && (
            <div className="info-box info-box-error">❌ {error}</div>
          )}
          <div className="form-grid">
            <div className="field">
              <label>Código de acceso</label>
              <input
                type="password"
                value={codigo}
                onChange={e => { setCodigo(e.target.value); setError(null) }}
                placeholder="Introduzca el código de acceso"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Verificando…' : '🔑 Entrar'}
            </button>
          </div>
        </form>
      </div>

      <footer>
        <p>Acceso restringido a personal autorizado · Agencia Tributaria · Campaña Renta 2025</p>
      </footer>
    </>
  )
}
