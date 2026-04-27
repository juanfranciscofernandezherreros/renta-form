import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import { changePassword, changeEmail, getConfiguracion, updateConfiguracion } from './apiClient.js'

const MIN_PASSWORD_LENGTH = 6
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AjustesAdminTab({ showToast }) {
  const { user, updateUser } = useAuth()
  const { t } = useLanguage()
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [emailForm, setEmailForm] = useState({ newEmail: user?.email ?? '' })
  const [emailErrors, setEmailErrors] = useState({})
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  const [emailEnvioActivo, setEmailEnvioActivo] = useState(true)
  const [emailEnvioLoading, setEmailEnvioLoading] = useState(false)
  const [emailEnvioSaved, setEmailEnvioSaved] = useState(false)
  const [emailEnvioError, setEmailEnvioError] = useState(null)

  useEffect(() => {
    getConfiguracion().then(({ data, error }) => {
      if (error) return
      if (data && data.email_envio_activo !== undefined) {
        setEmailEnvioActivo(data.email_envio_activo !== 'false')
      }
    })
  }, [])

  // Keep the email field in sync if the user's email loads/changes after mount.
  useEffect(() => {
    setEmailForm(prev => (prev.newEmail ? prev : { ...prev, newEmail: user?.email ?? '' }))
  }, [user?.email])

  const handleEmailEnvioToggle = async (newValue) => {
    setEmailEnvioLoading(true)
    setEmailEnvioSaved(false)
    setEmailEnvioError(null)
    const { error: apiError } = await updateConfiguracion({ clave: 'email_envio_activo', valor: String(newValue) })
    setEmailEnvioLoading(false)
    if (apiError) {
      setEmailEnvioError(apiError.message)
      if (showToast) showToast(apiError.message, 'error')
      return
    }
    setEmailEnvioActivo(newValue)
    setEmailEnvioSaved(true)
    if (showToast) showToast(t('emailEnvioSaved'))
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
    if (!pwForm.newPassword || pwForm.newPassword.length < MIN_PASSWORD_LENGTH) {
      errs.newPassword = `${t('errNewPasswordLength')} ${MIN_PASSWORD_LENGTH} ${t('errNewPasswordLengthSuffix')}`
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) errs.confirmPassword = t('errPasswordsNoMatch')
    if (Object.keys(errs).length) { setPwErrors(errs); return }
    setPwLoading(true)
    const { error: apiError } = await changePassword({
      // Fallback to user.dniNie for sessions stored in localStorage before
      // the username refactor — they will be replaced on next login.
      username: user.username ?? user.dniNie,
      oldPassword: pwForm.oldPassword,
      newPassword: pwForm.newPassword,
    })
    setPwLoading(false)
    if (apiError) {
      setPwErrors({ global: apiError.message })
      if (showToast) showToast(apiError.message, 'error')
      return
    }
    setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    setPwSuccess(true)
    if (showToast) showToast(t('pwSuccess'))
  }

  const handleEmailChange = e => {
    const { name, value } = e.target
    setEmailForm(prev => ({ ...prev, [name]: value }))
    setEmailErrors(prev => ({ ...prev, [name]: null, global: null }))
    setEmailSuccess(false)
  }

  const handleEmailSubmit = async e => {
    e.preventDefault()
    const errs = {}
    const trimmed = (emailForm.newEmail ?? '').trim()
    if (!trimmed) errs.newEmail = t('errEmailRequired')
    else if (!EMAIL_REGEX.test(trimmed)) errs.newEmail = t('errEmailFormat')
    if (Object.keys(errs).length) { setEmailErrors(errs); return }
    setEmailLoading(true)
    const { data, error: apiError } = await changeEmail({
      // Fallback to user.dniNie for sessions stored in localStorage before
      // the username refactor — they will be replaced on next login.
      username: user.username ?? user.dniNie,
      newEmail: trimmed,
    })
    setEmailLoading(false)
    if (apiError) {
      setEmailErrors({ global: apiError.message })
      if (showToast) showToast(apiError.message, 'error')
      return
    }
    if (updateUser) updateUser({ email: data?.email ?? trimmed })
    setEmailForm({ newEmail: data?.email ?? trimmed })
    setEmailSuccess(true)
    if (showToast) showToast(t('emailSuccess'))
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 20 }}>
        <label>{t('tokenResultDni')}</label>
        <input type="text" value={user?.dniNie ?? ''} readOnly disabled />
      </div>

      <div className="section-title">{t('emailEnvioTitle')}</div>

      {emailEnvioSaved && (
        <div className="info-box">{t('emailEnvioSaved')}</div>
      )}
      {emailEnvioError && (
        <div className="info-box info-box-error">❌ {emailEnvioError}</div>
      )}

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ margin: 0 }}>{t('emailEnvioLabel')}</label>
          <input
            type="checkbox"
            checked={emailEnvioActivo}
            disabled={emailEnvioLoading}
            onChange={e => handleEmailEnvioToggle(e.target.checked)}
            style={{ width: 'auto', cursor: 'pointer' }}
          />
        </div>
      </div>

      <div className="section-title">{t('changeEmailTitle')}</div>

      {emailSuccess && (
        <div className="info-box">{t('emailSuccess')}</div>
      )}
      {emailErrors.global && (
        <div className="info-box info-box-error">❌ {emailErrors.global}</div>
      )}

      <form onSubmit={handleEmailSubmit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label>{t('fieldNewEmail')}</label>
            <input
              type="email"
              name="newEmail"
              value={emailForm.newEmail}
              onChange={handleEmailChange}
              autoComplete="email"
              required
            />
            {emailErrors.newEmail && <span className="field-error">{emailErrors.newEmail}</span>}
          </div>
        </div>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={emailLoading}>
            {emailLoading ? t('btnUpdatingEmail') : t('btnUpdateEmail')}
          </button>
        </div>
      </form>

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
              autoComplete="current-password"
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
              autoComplete="new-password"
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
              autoComplete="new-password"
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
  )
}
