import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { listDeclaraciones, changePassword, getDocumentoUrl } from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'
import Footer from './Footer.jsx'
import { generateDeclaracionPDF, downloadRentaPdf } from './pdfUtils.js'

const MIN_PASSWORD_LENGTH = 6

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

const YN_LABELS = { si: 'Sí', no: 'No' }

const CAMPOS_LABELS = {
  nombre: 'Nombre',
  apellidos: 'Apellidos',
  dniNie: 'DNI / NIE',
  email: 'Correo electrónico',
  telefono: 'Teléfono',
  viviendaAlquiler: '¿Vive de alquiler?',
  alquilerMenos35: '¿Alquiler inferior al 35% de ingresos?',
  viviendaPropiedad: '¿Tiene vivienda en propiedad?',
  propiedadAntes2013: '¿Adquirida antes de 2013?',
  pisosAlquiladosTerceros: '¿Tiene pisos alquilados a terceros?',
  segundaResidencia: '¿Tiene segunda residencia?',
  familiaNumerosa: '¿Familia numerosa?',
  ayudasGobierno: '¿Ha recibido ayudas del gobierno?',
  mayores65ACargo: '¿Tiene mayores de 65 años a cargo?',
  mayoresConviven: '¿Conviven con usted?',
  hijosMenores26: '¿Tiene hijos menores de 26 años?',
  ingresosJuego: '¿Ha obtenido ingresos por juego?',
  ingresosInversiones: '¿Ha obtenido ingresos por inversiones?',
  comentarios: 'Comentarios',
}

const SECCIONES_ANTES_DOCS = [
  { titulo: '1. Datos de Identificación', campos: ['nombre', 'apellidos', 'dniNie', 'email', 'telefono'] },
  { titulo: '2. Situación de Vivienda', campos: ['viviendaAlquiler', 'alquilerMenos35', 'viviendaPropiedad', 'propiedadAntes2013', 'pisosAlquiladosTerceros', 'segundaResidencia'] },
  { titulo: '3. Cargas Familiares y Ayudas Públicas', campos: ['familiaNumerosa', 'ayudasGobierno', 'mayores65ACargo', 'mayoresConviven', 'hijosMenores26'] },
  { titulo: '4. Ingresos Extraordinarios e Inversiones', campos: ['ingresosJuego', 'ingresosInversiones'] },
]

const SECCION_INFO_ADICIONAL = { titulo: '6. Información Adicional', campos: ['comentarios'] }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ProfilePage({ onNavigate, onEditDeclaracion }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t, availableLanguages } = useLanguage()
  const [declaraciones, setDeclaraciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    listDeclaraciones({ query: { dniNie: user.dniNie, limit: 10 } })
      .then(({ data, error: apiError }) => {
        if (apiError) throw new Error(apiError.message ?? 'Error desconocido')
        setDeclaraciones(data?.data ?? [])
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
        <div className="logo">NH Gestión Integral</div>
        <div className="header-text">
          <h1>{t('profileTitle')}</h1>
          <p>{t('headerSubtitle')}</p>
        </div>
        <nav className="header-nav">
          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label={t('langLabel')}
          >
            {availableLanguages.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
            {t('navNewForm')}
          </button>
          {user?.role === 'admin' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/admin')}>
              🛡️ Admin
            </button>
          )}
          <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
            {t('navLogout')}
          </button>
        </nav>
      </header>

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
                      {ESTADO_LABELS[dec.estado] ?? dec.estado}
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
                    {SECCIONES_ANTES_DOCS.map(seccion => (
                      <div key={seccion.titulo}>
                        <div className="section-title">{seccion.titulo}</div>
                        <table className="respuestas-table">
                          <tbody>
                            {seccion.campos.map(campo => {
                              const valor = dec[campo]
                              if (valor === undefined || valor === null) return null
                              return (
                                <tr key={campo}>
                                  <td className="campo-label">{CAMPOS_LABELS[campo] ?? campo}</td>
                                  <td className="campo-valor">
                                    {YN_LABELS[valor] ?? valor}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {dec.documentos?.length > 0 && (
                      <div>
                        <div className="section-title">{t('section5')}</div>
                        <ul className="documentos-list">
                          {dec.documentos.map(doc => (
                            <li key={doc.id}>
                              <a
                                href={getDocumentoUrl(doc.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="doc-download-link"
                              >
                                📄 {doc.nombreOriginal}
                              </a>
                              <span className="doc-meta">{doc.mimeType} · {Math.round(doc.tamanyo / 1024)} KB</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div key={SECCION_INFO_ADICIONAL.titulo}>
                      <div className="section-title">{SECCION_INFO_ADICIONAL.titulo}</div>
                      <table className="respuestas-table">
                        <tbody>
                          {SECCION_INFO_ADICIONAL.campos.map(campo => {
                            const valor = dec[campo]
                            if (valor === undefined || valor === null) return null
                            return (
                              <tr key={campo}>
                                <td className="campo-label">{CAMPOS_LABELS[campo] ?? campo}</td>
                                <td className="campo-valor">{YN_LABELS[valor] ?? valor}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

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
                        onClick={() => generateDeclaracionPDF(dec)}
                      >
                        {t('btnDownloadPDF')}
                      </button>
                      {dec.rentaPdf && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => downloadRentaPdf(dec.rentaPdf)}
                          title="Descargar el PDF de la renta preparado por el gestor"
                        >
                          📥 Descargar PDF de la renta
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
