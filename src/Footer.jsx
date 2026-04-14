import { useLanguage } from './LanguageContext.jsx'

export default function Footer({ showApiDocs = false }) {
  const { t } = useLanguage()

  return (
    <footer className="footer-main">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">NH Gestión Integral</span>
          <p className="footer-tagline">{t('footerDisclaimer')}</p>
        </div>

        <div className="footer-links">
          <a
            href="https://www.agenciatributaria.es"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            🏛️ Agencia Tributaria
          </a>
          {showApiDocs && (
            <a href="#/api-docs" className="footer-link">
              {t('footerApiDocs')}
            </a>
          )}
        </div>

        <div className="footer-copy">
          <span>© {new Date().getFullYear()} NH Gestión Integral · {t('campaignName')}</span>
        </div>
      </div>
    </footer>
  )
}
