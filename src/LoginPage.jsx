import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { loginUser as loginUserMock } from './mockApi.js'
import { DEMO_MODE } from './constants.js'
import { useLanguage } from './LanguageContext.jsx'
import { LANGUAGES } from './i18n.js'

const DNI_NIE_REGEX = /^[0-9XYZ][0-9]{7}[A-Z]$/

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth()
  const { lang, setLang, t } = useLanguage()
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
    const dniNieUpper = form.dniNie.trim().toUpperCase()
    if (!DNI_NIE_REGEX.test(dniNieUpper)) {
      errs.dniNie = t('errDniFormat')
    }
    if (!form.password) {
      errs.password = t('errPasswordRequired')
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
      setErrors({ global: t('errRealModeNotImpl') })
      setLoading(false)
      return
    }
    const { data, error } = await loginFn({ dniNie, password: form.password })
    setLoading(false)
    if (error) {
      setErrors({ global: error.message })
      return
    }
    login({ dniNie: data.dniNie, role: data.role })
    onNavigate('#/perfil')
  }

  return (
    <>
      <header>
        <div className="logo">NH Gestión Integral</div>
        <div className="header-text">
          <h1>{t('loginTitle')}</h1>
          <p>{t('headerSubtitle')}</p>
        </div>
        <nav className="header-nav">
          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label={t('langLabel')}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </nav>
      </header>

      <div className="card">
        <div className="info-box">
          <strong>{t('loginInfoTitle')}</strong>
          {t('loginInfoText')}
          <br /><br />
          <strong>{t('loginTestUsers')}</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '1.4em' }}>
            <li><strong>12345678A</strong> – María García López</li>
            <li><strong>87654321B</strong> – Carlos Martínez Ruiz</li>
            <li><strong>11223344C</strong> – Ana López Sánchez</li>
            <li><strong>44332211D</strong> – Pedro Fernández González</li>
          </ul>
          {t('loginTestPassword')}<strong>renta2025</strong>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="section-title">{t('loginSectionId')}</div>
          {errors.global && (
            <div className="info-box info-box-error">❌ {errors.global}</div>
          )}
          <div className="form-grid">
            <div className="field">
              <label>{t('fieldDniNie')}</label>
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
              <label>{t('fieldPassword')}</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={t('fieldPasswordPlaceholder')}
                required
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('btnLoggingIn') : t('btnLogin')}
            </button>
          </div>
        </form>
      </div>

      <footer>
        <p>{t('footerDisclaimer')}</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · {t('campaignName')}</p>
      </footer>
    </>
  )
}
