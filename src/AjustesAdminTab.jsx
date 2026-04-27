import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import { changePassword } from './apiClient.js'

const MIN_PASSWORD_LENGTH = 6

export default function AjustesAdminTab({ showToast }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

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

  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 20 }}>
        <label>{t('tokenResultDni')}</label>
        <input type="text" value={user?.dniNie ?? ''} readOnly disabled />
      </div>

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
