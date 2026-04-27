import { useState, useEffect } from 'react'
import { getDeclaracionByToken, getPreguntas } from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'
import { generateDeclaracionPDF, downloadRentaPdf } from './pdfUtils.js'


const TOKENS_STORAGE_KEY = 'renta_form_tokens'

const LANG_FLAGS = { es: '🇪🇸', fr: '🇫🇷', en: '🇬🇧', de: '🇩🇪', pt: '🇵🇹', it: '🇮🇹' }

const LOCALE_MAP = { es: 'es-ES', fr: 'fr-FR', en: 'en-GB', ca: 'ca-ES' }

const ESTADO_T_KEYS = {
  recibido: 'estadoRecibido',
  en_revision: 'estadoEnRevision',
  documentacion_pendiente: 'estadoDocumentacionPendiente',
  completado: 'estadoCompletado',
  archivado: 'estadoArchivado',
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

function saveToHistory(data, prev) {
  if (!data?.id) return prev
  const entry = { id: data.id, dniNie: data.dniNie, creadoEn: data.creadoEn }
  const filtered = (prev ?? []).filter(h => h.id !== entry.id)
  const next = [entry, ...filtered].slice(0, 20)
  try {
    localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
  return next
}

export default function TokenConsultaPage({ onNavigate, onEditDeclaracion, initialToken }) {
  const { lang, setLang, t, availableLanguages } = useLanguage()
  const [token, setToken] = useState(initialToken ?? '')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const [secciones, setSecciones] = useState([])

  useEffect(() => {
    getPreguntas().then(({ data }) => setSecciones(data?.secciones ?? []))
  }, [])

  useEffect(() => {
    if (!initialToken) return
    const trimmed = initialToken.trim()
    if (!trimmed) return
    setLoading(true)
    getDeclaracionByToken({ token: trimmed })
      .then(({ data, error: apiError }) => {
        if (apiError || !data) {
          setError(t('tokenNotFound'))
        } else {
          setResult(data)
          setHistory(prev => saveToHistory(data, prev))
        }
      })
      .catch(() => {
        setError(t('tokenNotFound'))
      })
      .finally(() => {
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken])

  const handleSubmit = async e => {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) {
      setError(t('errTokenRequired'))
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
      setHistory(prev => saveToHistory(data, prev))
    }
  }

  const handleClearHistory = () => {
    localStorage.removeItem(TOKENS_STORAGE_KEY)
    setHistory([])
  }

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="logo">{t('logoText')}</div>
          <nav className="header-nav">
            <div className="lang-flags-top" role="group" aria-label={t('langLabel')}>
              {availableLanguages.map(l => (
                <button
                  key={l.code}
                  type="button"
                  className={`lang-flag-btn${lang === l.code ? ' active' : ''}`}
                  onClick={() => setLang(l.code)}
                  aria-label={l.label}
                  title={l.label}
                >
                  <span className="lang-flag-emoji">{LANG_FLAGS[l.code] ?? '🌐'}</span>
                  <span className="lang-flag-code">{l.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
              {t('navNewForm')}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/login')}>
              {t('navLogin')}
            </button>
          </nav>
        </div>
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
                    {t(ESTADO_T_KEYS[result.estado] ?? result.estado)}
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
                <div className="btn-row" style={{ marginTop: '12px' }}>
                  {onEditDeclaracion && (
                    result.estado === 'completado' ? (
                      <span className="info-box" style={{ margin: 0 }}>{t('profileEditLocked')}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => { onEditDeclaracion(result); onNavigate('#/') }}
                      >
                        {t('profileEdit')}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => generateDeclaracionPDF(result, secciones, lang)}
                  >
                    {t('btnDownloadPDF')}
                  </button>
                  {result.rentaPdf && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => downloadRentaPdf(result.rentaPdf)}
                      title={t('rentaPdfBtnTitle')}
                    >
                      {t('rentaPdfBtn')}
                    </button>
                  )}
                </div>
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

      </>
  )
}
