import { useState, useRef, useEffect } from 'react'
import './App.css'
import { getPreguntas, createDeclaracion, updateDeclaracion, deleteDocumento, getDocumentoUrl } from './apiClient.js'
import { useAuth } from './AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import Footer from './Footer.jsx'

const TOKENS_STORAGE_KEY = 'renta_form_tokens'

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

const STEP_ICONS = ['👤', '🏠', '👨‍👩‍👧', '💶', '📁', '📝', '⭐', '❓']

const YesNoField = ({ label, name, value, onChange, indent, t }) => (
  <div className={`question-card${indent ? ' indent' : ''}${value ? ' answered' : ''}`}>
    <div className="question-card-text">{label}</div>
    <div className="yesno-buttons">
      <button
        type="button"
        className={`yesno-btn${value === 'si' ? ' selected yes' : ''}`}
        onClick={() => onChange({ target: { name, value: 'si' } })}
      >
        <span className="yesno-icon">✓</span> {t('yes')}
      </button>
      <button
        type="button"
        className={`yesno-btn${value === 'no' ? ' selected no' : ''}`}
        onClick={() => onChange({ target: { name, value: 'no' } })}
      >
        <span className="yesno-icon">✗</span> {t('no')}
      </button>
    </div>
  </div>
)

export default function App({ onNavigate, editData, onEditDataConsumed }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t, availableLanguages } = useLanguage()
  const [form, setForm] = useState(INITIAL_STATE)
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submissionToken, setSubmissionToken] = useState(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [secciones, setSecciones] = useState([])
  const [loadingPreguntas, setLoadingPreguntas] = useState(true)
  const [errorPreguntas, setErrorPreguntas] = useState(null)
  const [buscarCodigo, setBuscarCodigo] = useState('')
  const [editDocumentos, setEditDocumentos] = useState([])
  const [deletingDocId, setDeletingDocId] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepDirection, setStepDirection] = useState('forward')
  const topRef = useRef(null)

  useEffect(() => {
    if (!editData) return
    setEditId(editData.id)
    setEditDocumentos(editData.documentos ?? [])
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
      setEditId(null)
      setEditDocumentos([])
      setSubmitted(false)
      setSubmissionToken(null)
      setTokenCopied(false)
      setCurrentStep(0)
      setStepDirection('forward')
    }
  }

  const showToast = (msg, type) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  // Wizard step helpers
  // Steps: 0 = ID fields, 1..N = API sections, N+1 = Docs + Comments (last)
  const totalSteps = loadingPreguntas ? 0 : secciones.length + 2

  const handleNext = () => {
    if (currentStep === 0) {
      if (!form.nombre.trim() || !form.apellidos.trim() || !form.dniNie.trim() || !form.telefono.trim()) {
        showToast(t('errValidationRequired'), 'error')
        return
      }
    } else if (currentStep >= 1 && currentStep <= secciones.length) {
      const seccion = secciones[currentStep - 1]
      const unanswered = seccion.preguntas.some(pregunta => {
        const visible = !pregunta.condicion ||
          form[pregunta.condicion.campo] === pregunta.condicion.valor
        return visible && (form[pregunta.id] == null || form[pregunta.id] === '')
      })
      if (unanswered) {
        showToast(t('errValidationQuestions'), 'error')
        return
      }
    }
    setStepDirection('forward')
    setCurrentStep(prev => prev + 1)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlePrev = () => {
    setStepDirection('backward')
    setCurrentStep(prev => prev - 1)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDeleteDocumento = async (docId) => {
    if (!window.confirm(t('confirmDeleteDoc'))) return
    setDeletingDocId(docId)
    const { error } = await deleteDocumento({ path: { docId } })
    setDeletingDocId(null)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setEditDocumentos(prev => prev.filter(d => d.id !== docId))
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()

    // Validate required identification fields
    if (!form.nombre.trim() || !form.apellidos.trim() || !form.dniNie.trim() || !form.telefono.trim()) {
      showToast(t('errValidationRequired'), 'error')
      return
    }

    // Validate all visible questions are answered
    const unanswered = secciones.some(seccion =>
      seccion.preguntas.some(pregunta => {
        const visible = !pregunta.condicion ||
          form[pregunta.condicion.campo] === pregunta.condicion.valor
        return visible && (form[pregunta.id] == null || form[pregunta.id] === '')
      })
    )
    if (unanswered) {
      showToast(t('errValidationQuestions'), 'error')
      return
    }

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
      if (editId && updateDeclaracion) {
        // Update existing declaration
        const updateBody = {
          nombre: form.nombre,
          apellidos: form.apellidos,
          dniNie: form.dniNie,
          email: form.email,
          telefono: form.telefono,
          viviendaAlquiler: form.viviendaAlquiler,
          ...(form.viviendaAlquiler === 'si' && { alquilerMenos35: form.alquilerMenos35 }),
          viviendaPropiedad: form.viviendaPropiedad,
          ...(form.viviendaPropiedad === 'si' && { propiedadAntes2013: form.propiedadAntes2013 }),
          pisosAlquiladosTerceros: form.pisosAlquiladosTerceros,
          segundaResidencia: form.segundaResidencia,
          familiaNumerosa: form.familiaNumerosa,
          ayudasGobierno: form.ayudasGobierno,
          mayores65ACargo: form.mayores65ACargo,
          ...(form.mayores65ACargo === 'si' && { mayoresConviven: form.mayoresConviven }),
          hijosMenores26: form.hijosMenores26,
          ingresosJuego: form.ingresosJuego,
          ingresosInversiones: form.ingresosInversiones,
          comentarios: form.comentarios,
          // New documents to attach (if any were selected)
          ...(form.docDniAnverso && { docDniAnverso: form.docDniAnverso }),
          ...(form.docDniReverso && { docDniReverso: form.docDniReverso }),
          ...(form.docAdicional && { docAdicional: Array.from(form.docAdicional) }),
        }
        const { data, error, response } = await updateDeclaracion({ path: { id: editId }, body: updateBody })
        if (data) {
          setEditId(null)
          setEditDocumentos([])
          setSubmitted(true)
          showToast(t('toastSuccess'), 'success')
          setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        } else {
          showToast(`${t('toastErrorHttp')} ${response?.status ?? '?'}${t('toastErrorHttpSuffix')} ${error?.message ?? ''}`, 'error')
        }
      } else {
        const { data, error, response } = await createDeclaracion({ body })
        if (data) {
          setSubmitted(true)
          if (!user) {
            setSubmissionToken(data.id)
            try {
              const stored = JSON.parse(localStorage.getItem(TOKENS_STORAGE_KEY) ?? '[]')
              stored.unshift({ id: data.id, creadoEn: data.creadoEn, dniNie: body.dniNie })
              localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(stored.slice(0, 20)))
            } catch {
              // localStorage not available
            }
          }
          showToast(t('toastSuccess'), 'success')
          setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        } else {
          showToast(`${t('toastErrorHttp')} ${response?.status ?? '?'}${t('toastErrorHttpSuffix')} ${error?.message ?? ''}`, 'error')
        }
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
        <div className="logo">NH Gestión Integral</div>
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
            {availableLanguages.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {user ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/perfil')}>
                {t('navProfile')}
              </button>
              {user.role === 'admin' && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/admin')}>
                  🛡️ Admin
                </button>
              )}
              <button type="button" className="btn btn-danger btn-sm" onClick={() => { logout(); onNavigate('#/') }}>
                {t('navLogout')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/consulta')}>
                {t('navConsulta')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/login')}>
                {t('navLogin')}
              </button>
            </>
          )}
        </nav>
      </header>

      <div className="card">
        {/* Buscar renta por código */}
        <form
          className="search-renta-form"
          onSubmit={e => {
            e.preventDefault()
            const trimmed = buscarCodigo.trim()
            if (trimmed) onNavigate('#/consulta/' + encodeURIComponent(trimmed))
          }}
        >
          <span className="search-renta-label">{t('buscarRentaTitle')}</span>
          <input
            type="text"
            className="search-renta-input"
            value={buscarCodigo}
            onChange={e => setBuscarCodigo(e.target.value)}
            placeholder={t('tokenPlaceholder')}
            aria-label={t('tokenLabel')}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!buscarCodigo.trim()}>
            {t('btnConsultar')}
          </button>
        </form>

        {/* Progress bar – dynamic based on wizard steps */}
        {!submitted && !loadingPreguntas && !errorPreguntas && (
          <div className="progress-bar">
            {/* Step 0: ID */}
            <div className={`step ${currentStep > 0 ? 'done' : 'active'}`}>
              <div className="bubble">{currentStep > 0 ? '✓' : '1'}</div>
              {t('stepId')}
            </div>
            {/* Dynamic API sections */}
            {secciones.map((sec, idx) => {
              const stepIdx = idx + 1
              const isDone = currentStep > stepIdx
              const isActive = currentStep === stepIdx
              return (
                <div key={sec.id} className={`step ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                  <div className="bubble">{isDone ? '✓' : stepIdx + 1}</div>
                  <span className="progress-step-label">
                    {sec.titulos?.[lang] ?? sec.titulo}
                  </span>
                </div>
              )
            })}
            {/* Last step: docs + comments */}
            {(() => {
              const lastIdx = secciones.length + 1
              const isDone = submitted
              const isActive = currentStep === lastIdx
              return (
                <div className={`step ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                  <div className="bubble">{isDone ? '✓' : lastIdx + 1}</div>
                  {t('stepDocs')}
                </div>
              )
            })()}
          </div>
        )}
        {submitted && (
          <div className="progress-bar">
            {Array.from({ length: secciones.length + 2 }, (_, i) => (
              <div key={i} className="step done">
                <div className="bubble">✓</div>
              </div>
            ))}
          </div>
        )}

        {submitted ? (
          <div className="success-panel">
            <div className="success-icon">✅</div>
            <h2>{t('successTitle')}</h2>
            <p>{t('successText')}</p>
            {!user && submissionToken && (
              <div className="token-box">
                <div className="token-title">{t('tokenTitle')}</div>
                <p className="token-desc">{t('tokenDesc')}</p>
                <div className="token-code-row">
                  <code className="token-code">{submissionToken}</code>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(submissionToken).catch(() => {})
                      setTokenCopied(true)
                      setTimeout(() => setTokenCopied(false), 2000)
                    }}
                  >
                    {tokenCopied ? t('tokenCopied') : t('tokenCopy')}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '8px' }}
                  onClick={() => onNavigate('#/consulta')}
                >
                  {t('navConsulta')}
                </button>
              </div>
            )}
            <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>{t('btnSendAnother')}</button>
          </div>
        ) : (
          <>
            <div className="info-box">
              <strong>{t('instructionsTitle')}</strong>
              {t('instructionsText')}<em>{t('campaignName')}</em>{t('instructionsText2')}
            </div>

            {loadingPreguntas && <div className="info-box">{t('loadingQuestions')}</div>}
            {errorPreguntas && <div className="info-box">{t('errorQuestions')}{errorPreguntas}</div>}

            {!loadingPreguntas && !errorPreguntas && (
              <form onSubmit={handleSubmit} noValidate>
                {/* Animated wizard step container – key change triggers CSS animation */}
                <div
                  key={`step-${currentStep}`}
                  className={`wizard-step${stepDirection === 'backward' ? ' reverse' : ''}`}
                >

                  {/* ── Step 0: Identification ── */}
                  {currentStep === 0 && (
                    <>
                      <div className="wizard-step-header">
                        <div className="wizard-step-icon">👤</div>
                        <div>
                          <div className="wizard-step-title">{t('section1')}</div>
                          <div className="wizard-step-subtitle">{t('instructionsTitle')}</div>
                        </div>
                      </div>
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
                          <label>{t('fieldEmail')} <span className="field-optional">{t('fieldEmailOptional')}</span></label>
                          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('fieldEmailPlaceholder')} />
                        </div>
                        <div className="field">
                          <label>{t('fieldTelefono')}</label>
                          <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} placeholder={t('fieldTelefonoPlaceholder')} required />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Steps 1..N: dynamic API sections ── */}
                  {currentStep >= 1 && currentStep <= secciones.length && (() => {
                    const seccion = secciones[currentStep - 1]
                    const icon = STEP_ICONS[currentStep] ?? '❓'
                    return (
                      <>
                        <div className="wizard-step-header">
                          <div className="wizard-step-icon">{icon}</div>
                          <div>
                            <div className="wizard-step-title">
                              {seccion.numero}. {seccion.titulos?.[lang] ?? seccion.titulo}
                            </div>
                            <div className="wizard-step-subtitle">{t('instructionsTitle')}</div>
                          </div>
                        </div>
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
                      </>
                    )
                  })()}

                  {/* ── Last step: Docs + Comments + Submit ── */}
                  {currentStep === secciones.length + 1 && (
                    <>
                      <div className="wizard-step-header">
                        <div className="wizard-step-icon">📁</div>
                        <div>
                          <div className="wizard-step-title">{t('section5')}</div>
                          <div className="wizard-step-subtitle">{t('docsInfoTitle')}</div>
                        </div>
                      </div>

                      <div className="info-box">
                        <strong>{t('docsInfoTitle')}</strong>
                        {t('docsInfoText')}
                      </div>

                      {/* Already-attached documents when editing */}
                      {editId && editDocumentos.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '0.9em', fontWeight: 600, marginBottom: '6px' }}>
                            {t('docsAlreadyAttached')}
                          </div>
                          <ul className="documentos-list">
                            {editDocumentos.map(doc => (
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
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm btn-xs"
                                  onClick={() => handleDeleteDocumento(doc.id)}
                                  disabled={deletingDocId === doc.id}
                                  style={{ marginLeft: '8px' }}
                                  title="Eliminar documento"
                                >
                                  {deletingDocId === doc.id ? '⏳' : '🗑️'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="form-grid">
                        <div className="field">
                          <label>{t('docDniAnverso')}</label>
                          <input type="file" name="docDniAnverso" accept=".jpg,.jpeg,.png" onChange={handleChange} />
                          {form.docDniAnverso && <span className="file-name">📄 {form.docDniAnverso.name}</span>}
                        </div>
                        <div className="field">
                          <label>{t('docDniReverso')}</label>
                          <input type="file" name="docDniReverso" accept=".jpg,.jpeg,.png" onChange={handleChange} />
                          {form.docDniReverso && <span className="file-name">📄 {form.docDniReverso.name}</span>}
                        </div>
                        <div className="field full">
                          <label>{t('docAdicional')}</label>
                          <input type="file" name="docAdicional" accept=".jpg,.jpeg,.png,.zip" multiple onChange={handleChange} />
                          {form.docAdicional && <span className="file-name">📄 {Array.from(form.docAdicional).map(f => f.name).join(', ')}</span>}
                        </div>
                      </div>

                      {/* Comments */}
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
                    </>
                  )}

                </div>{/* end wizard-step */}

                {/* Wizard navigation */}
                <div className="wizard-nav">
                  <div>
                    {currentStep > 0 && (
                      <button type="button" className="btn btn-secondary" onClick={handlePrev}>
                        {t('btnBack')}
                      </button>
                    )}
                    {currentStep === 0 && (
                      <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>{t('btnClear')}</button>
                    )}
                  </div>
                  <div className="wizard-progress-text">
                    {currentStep + 1} / {totalSteps}
                  </div>
                  <div className="wizard-nav-right">
                    {currentStep < secciones.length + 1 ? (
                      <button type="button" className="btn btn-primary" onClick={handleNext}>
                        {t('btnContinue')}
                      </button>
                    ) : (
                      <button type="submit" className="btn btn-success" disabled={submitting}>
                        {submitting ? t('btnSubmitting') : t('btnSubmit')}
                      </button>
                    )}
                  </div>
                </div>

              </form>
            )}
          </>
        )}
      </div>

      <Footer showApiDocs />

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
