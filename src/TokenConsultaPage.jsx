import { useState } from 'react'
import { getDeclaracionByToken as getDeclaracionByTokenMock } from './mockApi.js'
import { DEMO_MODE } from './constants.js'
import { useLanguage } from './LanguageContext.jsx'
import { LANGUAGES } from './i18n.js'
import { generateDeclaracionPDF } from './pdfUtils.js'

const TOKENS_STORAGE_KEY = 'renta_form_tokens'

const getDeclaracionByToken = DEMO_MODE ? getDeclaracionByTokenMock : null

const LOCALE_MAP = { es: 'es-ES', fr: 'fr-FR', en: 'en-GB', ca: 'ca-ES' }

const ESTADO_LABELS = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  documentacion_pendiente: 'Documentación pendiente',
  completado: 'Completado',
  archivado: 'Archivado',
}

const ESTADO_CLASS = {
  recibido: 'badge-blue',
  en_revision: 'badge-yellow',
  documentacion_pendiente: 'badge-orange',
  completado: 'badge-green',
  archivado: 'badge-gray',
}

function formatFecha(iso, lang) {
  if (!iso) return '—'
  const locale = LOCALE_MAP[lang] ?? 'es-ES'
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function TokenConsultaPage({ onNavigate, onEditDeclaracion }) {
  const { lang, setLang, t } = useLanguage()
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState(loadHistory)

  const handleSubmit = async e => {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) {
      setError(t('errTokenRequired'))
      return
    }
    if (!getDeclaracionByToken) {
      setError(t('errRealModeNotImpl'))
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    const { data, error: apiError } = await getDeclaracionByToken({ token: trimmed })
    setLoading(false)
    if (apiError || !data) {
      setError(t('tokenNotFound'))
    } else {
      setResult(data)
    }
  }

  const handleClearHistory = () => {
    localStorage.removeItem(TOKENS_STORAGE_KEY)
    setHistory([])
  }

  return (
    <>
      <header>
        <div className="logo">NH Gestión Integral</div>
        <div className="header-text">
          <h1>{t('tokenConsultaTitle')}</h1>
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
            {t('navNewForm')}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/login')}>
            {t('navLogin')}
          </button>
        </nav>
      </header>

      <div className="card">
        <div className="info-box">
          <strong>{t('tokenConsultaTitle')}</strong>
          <br />
          {t('tokenConsultaDesc')}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="info-box info-box-error">❌ {error}</div>
          )}
          <div className="form-grid">
            <div className="field full">
              <label>{t('tokenLabel')}</label>
              <input
                type="text"
                value={token}
                onChange={e => { setToken(e.target.value); setError(null); setResult(null) }}
                placeholder={t('tokenPlaceholder')}
                required
              />
            </div>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('btnConsultando') : t('btnConsultar')}
            </button>
          </div>
        </form>

        {result && (
          <div style={{ marginTop: '24px' }}>
            <div className="section-title">{t('tokenResultTitle')}</div>
            <div className="declaracion-card">
              <div className="declaracion-header">
                <div className="declaracion-meta">
                  <span className="declaracion-id">#{result.id.slice(0, 8)}…</span>
                  <span className={`estado-badge ${ESTADO_CLASS[result.estado] ?? 'badge-blue'}`}>
                    {ESTADO_LABELS[result.estado] ?? result.estado}
                  </span>
                </div>
                <div className="declaracion-dates">
                  <span>{t('profileSent')}{formatFecha(result.creadoEn, lang)}</span>
                  {result.actualizadoEn && result.actualizadoEn !== result.creadoEn && (
                    <span>{t('profileUpdated')}{formatFecha(result.actualizadoEn, lang)}</span>
                  )}
                </div>
              </div>
              <div className="declaracion-body" style={{ padding: '12px 16px' }}>
                <table className="respuestas-table">
                  <tbody>
                    <tr>
                      <td className="campo-label">{t('tokenResultNombre')}</td>
                      <td className="campo-valor">{result.nombre} {result.apellidos}</td>
                    </tr>
                    <tr>
                      <td className="campo-label">{t('tokenResultDni')}</td>
                      <td className="campo-valor">{result.dniNie}</td>
                    </tr>
                    <tr>
                      <td className="campo-label">{t('tokenResultEmail')}</td>
                      <td className="campo-valor">{result.email}</td>
                    </tr>
                  </tbody>
                </table>
                {onEditDeclaracion && (
                  <div className="btn-row" style={{ marginTop: '12px' }}>
                    {result.estado === 'completado' ? (
                      <span className="info-box" style={{ margin: 0 }}>{t('profileEditLocked')}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => { onEditDeclaracion(result); onNavigate('#/') }}
                      >
                        {t('profileEdit')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => generateDeclaracionPDF(result)}
                    >
                      {t('btnDownloadPDF')}
                    </button>
                  </div>
                )}
                {!onEditDeclaracion && (
                  <div className="btn-row" style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => generateDeclaracionPDF(result)}
                    >
                      {t('btnDownloadPDF')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="section-title">{t('tokenMyTokens')}</div>
          <div className="declaraciones-list">
            {history.map(item => (
              <div key={item.id} className="declaracion-card">
                <div
                  className="declaracion-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setToken(item.id); setResult(null); setError(null) }}
                >
                  <div className="declaracion-meta">
                    <span className="declaracion-id">#{item.id.slice(0, 8)}…</span>
                    {item.dniNie && <span style={{ fontSize: '0.85em', color: '#666' }}>{item.dniNie}</span>}
                  </div>
                  <div className="declaracion-dates">
                    <span>{t('profileSent')}{formatFecha(item.creadoEn, lang)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearHistory}>
              {t('tokenClearHistory')}
            </button>
          </div>
        </div>
      )}

      {history.length === 0 && !result && (
        <div className="card">
          <div className="info-box">{t('tokenNoHistory')}</div>
        </div>
      )}

      <footer>
        <p>{t('footerDisclaimer')}</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · {t('campaignName')}</p>
      </footer>
    </>
  )
}
