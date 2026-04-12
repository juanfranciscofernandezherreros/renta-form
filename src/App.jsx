import { useState, useRef, useEffect } from 'react'
import './App.css'
import { getPreguntas as getPreguntasReal, createDeclaracion as createDeclaracionReal } from './api/index.ts'
import { getPreguntas as getPreguntasMock, createDeclaracion as createDeclaracionMock } from './mockApi.js'
import { DEMO_MODE } from './constants.js'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import { LANGUAGES } from './i18n.js'

const getPreguntas = DEMO_MODE ? getPreguntasMock : getPreguntasReal
const createDeclaracion = DEMO_MODE ? createDeclaracionMock : createDeclaracionReal

const INITIAL_STATE = {
  // 1. Datos de identificación
  nombre: '',
  apellidos: '',
  dniNie: '',
  email: '',
  telefono: '',
  // 2. Situación de vivienda
  viviendaAlquiler: '',
  alquilerMenos35: '',
  viviendaPropiedad: '',
  propiedadAntes2013: '',
  pisosAlquiladosTerceros: '',
  segundaResidencia: '',
  // 3. Cargas familiares y ayudas públicas
  familiaNumerosa: '',
  ayudasGobierno: '',
  mayores65ACargo: '',
  mayoresConviven: '',
  hijosMenores26: '',
  // 4. Ingresos extraordinarios e inversiones
  ingresosJuego: '',
  ingresosInversiones: '',
  // 5. Documentación adjunta
  docDniAnverso: null,
  docDniReverso: null,
  docAdicional: null,
  // 6. Información adicional
  comentarios: '',
}

const YesNoField = ({ label, name, value, onChange, indent, t }) => (
  <div className={`question-row${indent ? ' indent' : ''}`}>
    <span className="question-text">{label}</span>
    <div className="radio-group">
      <label className="radio-label">
        <input type="radio" name={name} value="si" checked={value === 'si'} onChange={onChange} />
        {t('yes')}
      </label>
      <label className="radio-label">
        <input type="radio" name={name} value="no" checked={value === 'no'} onChange={onChange} />
        {t('no')}
      </label>
    </div>
  </div>
)

export default function App({ onNavigate, editData, onEditDataConsumed }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const [form, setForm] = useState(INITIAL_STATE)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [secciones, setSecciones] = useState([])
  const [loadingPreguntas, setLoadingPreguntas] = useState(true)
  const [errorPreguntas, setErrorPreguntas] = useState(null)
  const topRef = useRef(null)

  useEffect(() => {
    if (!editData) return
    setForm({
      ...INITIAL_STATE,
      nombre: editData.nombre ?? '',
      apellidos: editData.apellidos ?? '',
      dniNie: editData.dniNie ?? '',
      email: editData.email ?? '',
      telefono: editData.telefono ?? '',
      viviendaAlquiler: editData.viviendaAlquiler ?? '',
      alquilerMenos35: editData.alquilerMenos35 ?? '',
      viviendaPropiedad: editData.viviendaPropiedad ?? '',
      propiedadAntes2013: editData.propiedadAntes2013 ?? '',
      pisosAlquiladosTerceros: editData.pisosAlquiladosTerceros ?? '',
      segundaResidencia: editData.segundaResidencia ?? '',
      familiaNumerosa: editData.familiaNumerosa ?? '',
      ayudasGobierno: editData.ayudasGobierno ?? '',
      mayores65ACargo: editData.mayores65ACargo ?? '',
      mayoresConviven: editData.mayoresConviven ?? '',
      hijosMenores26: editData.hijosMenores26 ?? '',
      ingresosJuego: editData.ingresosJuego ?? '',
      ingresosInversiones: editData.ingresosInversiones ?? '',
      comentarios: editData.comentarios ?? '',
    })
    setSubmitted(false)
    onEditDataConsumed?.()
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [editData, onEditDataConsumed])

  useEffect(() => {
    getPreguntas()
      .then(({ data, error }) => {
        if (error) throw new Error(error.message ?? 'Error desconocido')
        setSecciones(data?.secciones ?? [])
        setLoadingPreguntas(false)
      })
      .catch(err => {
        setErrorPreguntas(err.message)
        setLoadingPreguntas(false)
      })
  }, [])

  const handleChange = e => {
    const { name, value, type } = e.target
    if (type === 'file') {
      if (e.target.multiple) {
        setForm(prev => ({ ...prev, [name]: e.target.files.length > 0 ? e.target.files : null }))
      } else {
        setForm(prev => ({ ...prev, [name]: e.target.files[0] ?? null }))
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleLimpiar = () => {
    if (window.confirm(t('confirmClear'))) {
      setForm(INITIAL_STATE)
      setSubmitted(false)
    }
  }

  const showToast = (msg, type) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const handleSubmit = async e => {
    e.preventDefault()

    /** @type {import('./api/types.gen').DeclaracionInput} */
    const body = {
      // Identification
      nombre: form.nombre,
      apellidos: form.apellidos,
      dniNie: form.dniNie,
      email: form.email,
      telefono: form.telefono,
      // Housing
      viviendaAlquiler: form.viviendaAlquiler,
      ...(form.viviendaAlquiler === 'si' && { alquilerMenos35: form.alquilerMenos35 }),
      viviendaPropiedad: form.viviendaPropiedad,
      ...(form.viviendaPropiedad === 'si' && { propiedadAntes2013: form.propiedadAntes2013 }),
      pisosAlquiladosTerceros: form.pisosAlquiladosTerceros,
      segundaResidencia: form.segundaResidencia,
      // Family
      familiaNumerosa: form.familiaNumerosa,
      ayudasGobierno: form.ayudasGobierno,
      mayores65ACargo: form.mayores65ACargo,
      ...(form.mayores65ACargo === 'si' && { mayoresConviven: form.mayoresConviven }),
      hijosMenores26: form.hijosMenores26,
      // Extraordinary income
      ingresosJuego: form.ingresosJuego,
      ingresosInversiones: form.ingresosInversiones,
      // Documents
      ...(form.docDniAnverso && { docDniAnverso: form.docDniAnverso }),
      ...(form.docDniReverso && { docDniReverso: form.docDniReverso }),
      ...(form.docAdicional && { docAdicional: Array.from(form.docAdicional) }),
      // Comments
      comentarios: form.comentarios,
    }

    setSubmitting(true)
    try {
      const { data, error, response } = await createDeclaracion({ body })
      if (data) {
        setSubmitted(true)
        showToast(t('toastSuccess'), 'success')
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      } else {
        showToast(`${t('toastErrorHttp')} ${response?.status ?? '?'}${t('toastErrorHttpSuffix')} ${error?.message ?? ''}`, 'error')
      }
    } catch {
      showToast(t('toastErrorNetwork'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header ref={topRef}>
        <div className="logo">AEAT</div>
        <div className="header-text">
          <h1>{t('headerTitle')}</h1>
          <p>{t('headerSubtitle')}</p>
        </div>
        <nav className="header-nav">
          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label={t('langLabel')}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {user ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/perfil')}>
                {t('navProfile')}
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => { logout(); onNavigate('#/') }}>
                {t('navLogout')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/login')}>
              {t('navLogin')}
            </button>
          )}
        </nav>
      </header>

      <div className="card">
        {/* Progress bar */}
        <div className="progress-bar">
          <div className={`step ${submitted ? 'done' : 'active'}`}><div className="bubble">{submitted ? '✓' : '1'}</div> {t('stepId')}</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '2'}</div> {t('stepHousing')}</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '3'}</div> {t('stepFamily')}</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '4'}</div> {t('stepIncome')}</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '5'}</div> {t('stepDocs')}</div>
        </div>

        {submitted ? (
          <div className="success-panel">
            <div className="success-icon">✅</div>
            <h2>{t('successTitle')}</h2>
            <p>{t('successText')}</p>
            <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>{t('btnSendAnother')}</button>
          </div>
        ) : (
          <>
            <div className="info-box">
              <strong>{t('instructionsTitle')}</strong>
              {t('instructionsText')}<em>{t('campaignName')}</em>{t('instructionsText2')}
            </div>

            <form onSubmit={handleSubmit} noValidate>

              {/* 1. Datos de identificación */}
              <div className="section-title">{t('section1')}</div>
              <div className="form-grid">
                <div className="field">
                  <label>{t('fieldNombre')}</label>
                  <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder={t('fieldNombre')} required />
                </div>
                <div className="field">
                  <label>{t('fieldApellidos')}</label>
                  <input type="text" name="apellidos" value={form.apellidos} onChange={handleChange} placeholder={t('fieldApellidosPlaceholder')} required />
                </div>
                <div className="field">
                  <label>{t('fieldDniNie')}</label>
                  <input type="text" name="dniNie" value={form.dniNie} onChange={handleChange} placeholder="00000000A" maxLength={9} required />
                </div>
                <div className="field">
                  <label>{t('fieldEmail')}</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('fieldEmailPlaceholder')} required />
                </div>
                <div className="field">
                  <label>{t('fieldTelefono')}</label>
                  <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} placeholder={t('fieldTelefonoPlaceholder')} required />
                </div>
              </div>

              {/* 2–4. Preguntas dinámicas cargadas desde el endpoint */}
              {loadingPreguntas && (
                <div className="info-box">{t('loadingQuestions')}</div>
              )}
              {errorPreguntas && (
                <div className="info-box">{t('errorQuestions')}{errorPreguntas}</div>
              )}
              {!loadingPreguntas && !errorPreguntas && secciones.map(seccion => (
                <div key={seccion.id}>
                  <div className="section-title">{seccion.numero}. {seccion.titulos?.[lang] ?? seccion.titulo}</div>
                  <div className="questions-list">
                    {seccion.preguntas.map(pregunta => {
                      const visible = !pregunta.condicion ||
                        form[pregunta.condicion.campo] === pregunta.condicion.valor
                      if (!visible) return null
                      return (
                        <YesNoField
                          key={pregunta.id}
                          name={pregunta.id}
                          value={form[pregunta.id] ?? ''}
                          onChange={handleChange}
                          label={pregunta.textos?.[lang] ?? pregunta.texto}
                          indent={pregunta.indentada}
                          t={t}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* 5. Documentación adjunta */}
              <div className="section-title">{t('section5')}</div>
              <div className="info-box">
                <strong>{t('docsInfoTitle')}</strong>
                {t('docsInfoText')}
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>{t('docDniAnverso')}</label>
                  <input type="file" name="docDniAnverso" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} />
                  {form.docDniAnverso && <span className="file-name">📄 {form.docDniAnverso.name}</span>}
                </div>
                <div className="field">
                  <label>{t('docDniReverso')}</label>
                  <input type="file" name="docDniReverso" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} />
                  {form.docDniReverso && <span className="file-name">📄 {form.docDniReverso.name}</span>}
                </div>
                <div className="field full">
                  <label>{t('docAdicional')}</label>
                  <input type="file" name="docAdicional" accept=".pdf,.jpg,.jpeg,.png,.zip" multiple onChange={handleChange} />
                  {form.docAdicional && <span className="file-name">📄 {Array.from(form.docAdicional).map(f => f.name).join(', ')}</span>}
                </div>
              </div>

              {/* 6. Información adicional */}
              <div className="section-title">{t('section6')}</div>
              <div className="form-grid">
                <div className="field full">
                  <label>{t('commentsLabel')}</label>
                  <textarea
                    name="comentarios"
                    value={form.comentarios}
                    onChange={handleChange}
                    placeholder={t('commentsPlaceholder')}
                    rows={5}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>{t('btnClear')}</button>
                <button type="submit" className="btn btn-success" disabled={submitting}>
                  {submitting ? t('btnSubmitting') : t('btnSubmit')}
                </button>
              </div>

            </form>
          </>
        )}
      </div>

      <footer>
        <p>{t('footerDisclaimer')}</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · {t('campaignName')}</p>
        <p><a href="#/api-docs">{t('footerApiDocs')}</a></p>
      </footer>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
