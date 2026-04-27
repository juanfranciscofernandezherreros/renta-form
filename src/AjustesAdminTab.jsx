import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import { changePassword, changeEmail, getAjustes, updateAjustes } from './apiClient.js'

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

  const [emailEnabled, setEmailEnabled] = useState(true)
  const [ajustesSaving, setAjustesSaving] = useState(false)
  const [ajustesSuccess, setAjustesSuccess] = useState(false)
  const [ajustesError, setAjustesError] = useState(null)

  // Keep the email field in sync if the user's email loads/changes after mount.
  useEffect(() => {
    setEmailForm(prev => (prev.newEmail ? prev : { ...prev, newEmail: user?.email ?? '' }))
  }, [user?.email])

  // Load current settings on mount
  useEffect(() => {
    let cancelled = false
    getAjustes().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setEmailEnabled(data.emailEnabled !== false)
    })
    return () => { cancelled = true }
  }, [])

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
      dniNie: user.dniNie,
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
      dniNie: user.dniNie,
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

  const handleAjustesSubmit = async e => {
    e.preventDefault()
    setAjustesSaving(true)
    setAjustesSuccess(false)
    setAjustesError(null)
    const { error: apiError } = await updateAjustes({ emailEnabled })
    setAjustesSaving(false)
    if (apiError) {
      setAjustesError(apiError.message)
      if (showToast) showToast(apiError.message, 'error')
      return
    }
    setAjustesSuccess(true)
    if (showToast) showToast(t('ajustesSaved'))
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 20 }}>
        <label>{t('tokenResultDni')}</label>
        <input type="text" value={user?.dniNie ?? ''} readOnly disabled />
      </div>

      <div className="section-title">{t('ajustesEmailTitle')}</div>

      {ajustesSuccess && (
        <div className="info-box">{t('ajustesSaved')}</div>
      )}
      {ajustesError && (
        <div className="info-box info-box-error">❌ {ajustesError}</div>
      )}

      <form onSubmit={handleAjustesSubmit} noValidate>
        <div className="form-grid">
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={e => { setEmailEnabled(e.target.checked); setAjustesSuccess(false) }}
                style={{ width: 18, height: 18 }}
              />
              {t('ajustesEmailLabel')}
            </label>
            <p style={{ marginTop: 6, color: '#666', fontSize: '0.9em' }}>{t('ajustesEmailDesc')}</p>
          </div>
        </div>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={ajustesSaving}>
            {ajustesSaving ? t('btnSavingAjustes') : t('btnSaveAjustes')}
          </button>
        </div>
      </form>

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
