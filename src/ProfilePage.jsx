import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { listDeclaraciones, changePassword, getPreguntas } from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'
import Footer from './Footer.jsx'
import { generateDeclaracionPDF, downloadRentaPdf } from './pdfUtils.js'
import { translateYN } from './i18nUtils.js'

const MIN_PASSWORD_LENGTH = 6
const LANG_FLAGS = { es: '🇪🇸', fr: '🇫🇷', en: '🇬🇧', de: '🇩🇪', pt: '🇵🇹', it: '🇮🇹' }

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

const ID_CAMPO_T_KEYS = {
  nombre: 'fieldNombre',
  apellidos: 'fieldApellidos',
  dniNie: 'tokenResultDni',
  email: 'tokenResultEmail',
  telefono: 'labelTelefono',
}

const ID_CAMPOS = ['nombre', 'apellidos', 'dniNie', 'email', 'telefono']

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ProfilePage({ onNavigate, onEditDeclaracion }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t, availableLanguages } = useLanguage()
  const [declaraciones, setDeclaraciones] = useState([])
  const [secciones, setSecciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!user) return
    Promise.all([
      listDeclaraciones({ query: { dniNie: user.dniNie, limit: 10 } }),
      getPreguntas(),
    ])
      .then(([{ data, error: apiError }, { data: pData }]) => {
        if (apiError) throw new Error(apiError.message ?? 'Error desconocido')
        setDeclaraciones(data?.data ?? [])
        setSecciones(pData?.secciones ?? [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user])

  const handleLogout = () => {
    logout()
    onNavigate('#/')
  }

  const handleEdit = (declaracion) => {
    onEditDeclaracion(declaracion)
    onNavigate('#/')
  }

  const handlePwChange = e => {
    const { name, value } = e.target
    setPwForm(prev => ({ ...prev, [name]: value }))
    setPwErrors(prev => ({ ...prev, [name]: null, global: null }))
    setPwSuccess(false)
  }

  const handlePwSubmit = async e => {
    e.preventDefault()
    const errs = {}
    if (!pwForm.oldPassword) errs.oldPassword = t('errOldPasswordRequired')
    if (!pwForm.newPassword || pwForm.newPassword.length < MIN_PASSWORD_LENGTH) errs.newPassword = `${t('errNewPasswordLength')} ${MIN_PASSWORD_LENGTH} ${t('errNewPasswordLengthSuffix')}`
    if (pwForm.newPassword !== pwForm.confirmPassword) errs.confirmPassword = t('errPasswordsNoMatch')
    if (Object.keys(errs).length) { setPwErrors(errs); return }
    setPwLoading(true)
    const { error: apiError } = await changePassword({
      dniNie: user.dniNie,
      oldPassword: pwForm.oldPassword,
      newPassword: pwForm.newPassword,
    })
    setPwLoading(false)
    if (apiError) { setPwErrors({ global: apiError.message }); return }
    setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    setPwSuccess(true)
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
            {user?.role === 'admin' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/admin')}>
                {t('btnAdmin')}
              </button>
            )}
            <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
              {t('navLogout')}
            </button>
          </nav>
        </div>
      </header>

      {toast && (
        <div className={`toast ${toast.type ?? 'success'}`} role="alert">
          {toast.msg}
        </div>
      )}

      <div className="card">
        <div className="profile-header">
          <div className="profile-avatar">👤</div>
          <div>
            <div className="profile-name">{user?.dniNie}</div>
          </div>
        </div>

        <div className="section-title">{t('profileDeclaraciones')}</div>

        {loading && <div className="info-box">{t('profileLoading')}</div>}

        {error && (
          <div className="info-box info-box-error">
            {t('profileLoadError')}{error}
          </div>
        )}

        {!loading && !error && declaraciones.length === 0 && (
          <div className="info-box">
            <strong>{t('profileEmpty')}</strong>
            {t('profileEmptyText')}<button
              type="button"
              className="link-btn"
              onClick={() => onNavigate('#/')}
            >{t('profileEmptyLink')}</button>
          </div>
        )}

        {!loading && !error && declaraciones.length > 0 && (
          <div className="declaraciones-list">
            {declaraciones.map(dec => (
              <div key={dec.id} className="declaracion-card">
                <div className="declaracion-header" onClick={() => setExpanded(expanded === dec.id ? null : dec.id)}>
                  <div className="declaracion-meta">
                    <span className="declaracion-id">#{dec.id.slice(0, 8)}…</span>
                    <span className={`estado-badge ${ESTADO_CLASS[dec.estado] ?? 'badge-blue'}`}>
                      {t(ESTADO_T_KEYS[dec.estado] ?? dec.estado)}
                    </span>
                  </div>
                  <div className="declaracion-dates">
                    <span>{t('profileSent')}{formatFecha(dec.creadoEn)}</span>
                    {dec.actualizadoEn && dec.actualizadoEn !== dec.creadoEn && (
                      <span>{t('profileUpdated')}{formatFecha(dec.actualizadoEn)}</span>
                    )}
                  </div>
                  <div className="declaracion-toggle">{expanded === dec.id ? '▲' : '▼'}</div>
                </div>

                {expanded === dec.id && (
                  <div className="declaracion-body">
                    {/* 1. Identification fields (always static) */}
                    <div>
                      <div className="section-title">{t('section1')}</div>
                      <table className="respuestas-table">
                        <tbody>
                          {ID_CAMPOS.map(campo => {
                            const valor = dec[campo]
                            if (valor === undefined || valor === null) return null
                            return (
                              <tr key={campo}>
                                <td className="campo-label">{t(ID_CAMPO_T_KEYS[campo] ?? campo)}</td>
                                <td className="campo-valor">{valor}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Dynamic question sections from DB */}
                    {secciones.map(seccion => {
                      const preguntasConValor = (seccion.preguntas ?? []).filter(p => dec[p.id] !== undefined && dec[p.id] !== null)
                      if (!preguntasConValor.length) return null
                      return (
                        <div key={seccion.id}>
                          <div className="section-title">{(seccion.titulos && seccion.titulos[lang]) ? seccion.titulos[lang] : seccion.titulo}</div>
                          <table className="respuestas-table">
                            <tbody>
                              {preguntasConValor.map(pregunta => (
                                <tr key={pregunta.id}>
                                  <td className="campo-label">{(pregunta.textos && pregunta.textos[lang]) ? pregunta.textos[lang] : pregunta.texto}</td>
                                  <td className="campo-valor">{translateYN(dec[pregunta.id], t)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}

                    <div className="btn-row">
                      {dec.estado === 'completado' ? (
                        <span className="info-box" style={{ margin: 0 }}>{t('profileEditLocked')}</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleEdit(dec)}
                        >
                          {t('profileEdit')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => generateDeclaracionPDF(dec, secciones, lang)}
                      >
                        {t('btnDownloadPDF')}
                      </button>
                      {dec.rentaPdf && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => downloadRentaPdf(dec.rentaPdf)}
                          title={t('rentaPdfBtnTitle')}
                        >
                          {t('rentaPdfBtn')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(
      <div className="card">
        <div className="section-title">{t('changePasswordTitle')}</div>
        {pwSuccess && (
          <div className="info-box">{t('pwSuccess')}</div>
        )}
        {pwErrors.global && (
          <div className="info-box info-box-error">❌ {pwErrors.global}</div>
        )}
        <form onSubmit={handlePwSubmit} noValidate>
          <div className="form-grid">
            <div className="field">
              <label>{t('fieldOldPassword')}</label>
              <input
                type="password"
                name="oldPassword"
                value={pwForm.oldPassword}
                onChange={handlePwChange}
                required
              />
              {pwErrors.oldPassword && <span className="field-error">{pwErrors.oldPassword}</span>}
            </div>
            <div className="field">
              <label>{t('fieldNewPassword')}</label>
              <input
                type="password"
                name="newPassword"
                value={pwForm.newPassword}
                onChange={handlePwChange}
                required
              />
              {pwErrors.newPassword && <span className="field-error">{pwErrors.newPassword}</span>}
            </div>
            <div className="field">
              <label>{t('fieldConfirmPassword')}</label>
              <input
                type="password"
                name="confirmPassword"
                value={pwForm.confirmPassword}
                onChange={handlePwChange}
                required
              />
              {pwErrors.confirmPassword && <span className="field-error">{pwErrors.confirmPassword}</span>}
            </div>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={pwLoading}>
              {pwLoading ? t('btnUpdatingPassword') : t('btnUpdatePassword')}
            </button>
          </div>
        </form>
      </div>
      )}

      <Footer showApiDocs />
    </>
  )
}
