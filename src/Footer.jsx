import { useLanguage } from './LanguageContext.jsx'

export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="footer-main">
      <div className="footer-inner">
        <p className="footer-brand-name">{t('footerBrandName')}</p>
        <p className="footer-disclaimer">
          {t('footerDisclaimer')}
        </p>
      </div>
    </footer>
  )
}
