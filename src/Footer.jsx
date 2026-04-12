import { useState } from 'react'
import { useLanguage } from './LanguageContext.jsx'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const HOW_STEPS = [
  { titleKey: 'footerStep1Title', textKey: 'footerStep1Text', icon: '🔑' },
  { titleKey: 'footerStep2Title', textKey: 'footerStep2Text', icon: '📋' },
  { titleKey: 'footerStep3Title', textKey: 'footerStep3Text', icon: '📤' },
  { titleKey: 'footerStep4Title', textKey: 'footerStep4Text', icon: '🔍' },
  { titleKey: 'footerStep5Title', textKey: 'footerStep5Text', icon: '📬' },
]

const INITIAL_CONTACT = { name: '', email: '', subject: '', message: '' }

export default function Footer({ showApiDocs = false }) {
  const { t } = useLanguage()
  const [howOpen, setHowOpen] = useState(false)
  const [contactForm, setContactForm] = useState(INITIAL_CONTACT)
  const [contactErrors, setContactErrors] = useState({})
  const [contactSending, setContactSending] = useState(false)
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactError, setContactError] = useState(null)

  const handleContactChange = e => {
    const { name, value } = e.target
    setContactForm(prev => ({ ...prev, [name]: value }))
    setContactErrors(prev => ({ ...prev, [name]: null }))
    setContactSuccess(false)
    setContactError(null)
  }

  const validateContact = () => {
    const errs = {}
    if (!contactForm.name.trim()) errs.name = t('footerContactErrName')
    if (!EMAIL_REGEX.test(contactForm.email.trim())) errs.email = t('footerContactErrEmail')
    if (!contactForm.subject.trim()) errs.subject = t('footerContactErrSubject')
    if (contactForm.message.trim().length < 10) errs.message = t('footerContactErrMessage')
    return errs
  }

  const handleContactSubmit = async e => {
    e.preventDefault()
    const errs = validateContact()
    if (Object.keys(errs).length) {
      setContactErrors(errs)
      return
    }
    setContactSending(true)
    setContactError(null)
    try {
      // Simulate sending (no real backend endpoint for contact messages)
      await new Promise(resolve => setTimeout(resolve, 900))
      setContactSuccess(true)
      setContactForm(INITIAL_CONTACT)
    } catch {
      setContactError(t('footerContactError'))
    } finally {
      setContactSending(false)
    }
  }

  return (
    <>
      <div className="footer-enhanced">
        <div className="footer-section-how">
          <button
            type="button"
            className="footer-how-toggle"
            onClick={() => setHowOpen(o => !o)}
            aria-expanded={howOpen}
          >
            {howOpen ? t('footerHideHow') : t('footerShowHow')}
          </button>

          {howOpen && (
            <div className="footer-how-content">
              <h2 className="footer-how-title">{t('footerHowTitle')}</h2>
              <div className="footer-steps">
                {HOW_STEPS.map(step => (
                  <div key={step.titleKey} className="footer-step">
                    <div className="footer-step-icon">{step.icon}</div>
                    <div className="footer-step-body">
                      <strong className="footer-step-title">{t(step.titleKey)}</strong>
                      <p className="footer-step-text">{t(step.textKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="footer-section-contact">
          <h2 className="footer-contact-title">{t('footerContactTitle')}</h2>

          {contactSuccess && (
            <div className="info-box footer-contact-success">{t('footerContactSuccess')}</div>
          )}
          {contactError && (
            <div className="info-box info-box-error">{contactError}</div>
          )}

          <form onSubmit={handleContactSubmit} noValidate className="footer-contact-form">
            <div className="form-grid">
              <div className="field">
                <label>{t('footerContactName')}</label>
                <input
                  type="text"
                  name="name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  placeholder={t('footerContactName')}
                  required
                />
                {contactErrors.name && <span className="field-error">{contactErrors.name}</span>}
              </div>
              <div className="field">
                <label>{t('footerContactEmail')}</label>
                <input
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  placeholder="ejemplo@correo.es"
                  required
                />
                {contactErrors.email && <span className="field-error">{contactErrors.email}</span>}
              </div>
              <div className="field full">
                <label>{t('footerContactSubject')}</label>
                <input
                  type="text"
                  name="subject"
                  value={contactForm.subject}
                  onChange={handleContactChange}
                  placeholder={t('footerContactSubject')}
                  required
                />
                {contactErrors.subject && <span className="field-error">{contactErrors.subject}</span>}
              </div>
              <div className="field full">
                <label>{t('footerContactMessage')}</label>
                <textarea
                  name="message"
                  value={contactForm.message}
                  onChange={handleContactChange}
                  placeholder={t('footerContactMessagePlaceholder')}
                  rows={4}
                  required
                />
                {contactErrors.message && <span className="field-error">{contactErrors.message}</span>}
              </div>
            </div>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={contactSending}>
                {contactSending ? t('footerContactSending') : t('footerContactSend')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <footer>
        <p>{t('footerDisclaimer')}</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · {t('campaignName')}</p>
        {showApiDocs && <p><a href="#/api-docs">{t('footerApiDocs')}</a></p>}
      </footer>
    </>
  )
}
