import { useState } from 'react'
import { useLanguage } from './LanguageContext.jsx'

const HOW_STEPS = [
  { titleKey: 'footerStep1Title', textKey: 'footerStep1Text', icon: '🔑' },
  { titleKey: 'footerStep2Title', textKey: 'footerStep2Text', icon: '📋' },
  { titleKey: 'footerStep3Title', textKey: 'footerStep3Text', icon: '📤' },
  { titleKey: 'footerStep4Title', textKey: 'footerStep4Text', icon: '🔍' },
  { titleKey: 'footerStep5Title', textKey: 'footerStep5Text', icon: '📬' },
]

export default function Footer({ showApiDocs = false }) {
  const { t } = useLanguage()
  const [howOpen, setHowOpen] = useState(false)

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
      </div>

      <footer>
        <p>{t('footerDisclaimer')}</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · {t('campaignName')}</p>
        {showApiDocs && <p><a href="#/api-docs">{t('footerApiDocs')}</a></p>}
      </footer>
    </>
  )
}
