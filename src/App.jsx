import { useState, useRef, useEffect, useMemo } from 'react'
import './App.css'
import { getPreguntas, createDeclaracion, updateDeclaracion } from './apiClient.js'
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
}

const STEP_ICONS = ['👤', '🏠', '👨‍👩‍👧', '💶', '📝', '⭐', '❓']

const LANG_FLAGS = {
  es: '🇪🇸',
  fr: '🇫🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  pt: '🇵🇹',
  it: '🇮🇹',
}

const YesNoField = ({ label, name, value, onChange, indent, t, questionNumber, onAnswer }) => {
  const [ringKey, setRingKey] = useState(null)
  return (
    <div className={`question-card${indent ? ' indent' : ''}${value ? ' answered' : ''}`} style={{ position: 'relative' }}>
      {ringKey != null && <div key={ringKey} className={`answer-ring${value === 'no' ? ' no' : ''}`} />}
      <div className="question-card-text">
        {questionNumber != null && (
          <span style={{
            background: 'linear-gradient(135deg, #6c11c8, #9b23e8)',
            color: '#fff',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '.8rem',
            fontWeight: '900',
            flexShrink: 0,
            marginRight: '4px',
          }}>{questionNumber}</span>
        )}
        {label}
      </div>
      <div className="yesno-buttons">
        <button
          type="button"
          className={`yesno-btn${value === 'si' ? ' selected yes' : ''}`}
          onClick={() => {
            const isNew = value !== 'si'
            onChange({ target: { name, value: 'si' } })
            if (isNew) { onAnswer?.(); setRingKey(Date.now()) }
          }}
        >
          <span className="yesno-icon">✅</span> {t('yes')}
        </button>
        <button
          type="button"
          className={`yesno-btn${value === 'no' ? ' selected no' : ''}`}
          onClick={() => {
            const isNew = value !== 'no'
            onChange({ target: { name, value: 'no' } })
            if (isNew) { onAnswer?.(); setRingKey(Date.now()) }
          }}
        >
          <span className="yesno-icon">❌</span> {t('no')}
        </button>
      </div>
    </div>
  )
}

const SHAKE_DURATION_MS = 600  // matches .shake CSS animation duration (0.6s)
const CONFETTI_COUNT = 75
const CONFETTI_CLEANUP_MS = 5500

export default function App({ onNavigate, editData, onEditDataConsumed }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t, availableLanguages } = useLanguage()
  const [form, setForm] = useState(INITIAL_STATE)
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submissionToken, setSubmissionToken] = useState(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [secciones, setSecciones] = useState([])
  const [loadingPreguntas, setLoadingPreguntas] = useState(true)
  const [errorPreguntas, setErrorPreguntas] = useState(null)
  const [buscarCodigo, setBuscarCodigo] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [stepDirection, setStepDirection] = useState('forward')
  const [fieldErrors, setFieldErrors] = useState({})
  const topRef = useRef(null)

  // Game animation state
  const [xpPopups, setXpPopups] = useState([])
  const [streak, setStreak] = useState(0)
  const [questionShake, setQuestionShake] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState([])
  const xpCounterRef = useRef(0)

  useEffect(() => {
    if (!editData) return
    setEditId(editData.id)
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
    if (fieldErrors[name]) {
      setFieldErrors(prev => { const { [name]: _, ...rest } = prev; return rest })
    }
  }

  const handleLimpiar = () => {
    if (window.confirm(t('confirmClear'))) {
      setForm(INITIAL_STATE)
      setEditId(null)
      setSubmitted(false)
      setSubmissionToken(null)
      setTokenCopied(false)
      setCurrentStep(0)
      setStepDirection('forward')
      setFieldErrors({})
    }
  }

  const showToast = (msg, type) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Game helpers ──
  const spawnXpPopup = () => {
    const id = ++xpCounterRef.current
    setXpPopups(prev => [...prev, { id }])
    setTimeout(() => setXpPopups(prev => prev.filter(p => p.id !== id)), 1100)
  }

  const handleAnswer = () => {
    spawnXpPopup()
    setStreak(s => s + 1)
    // Auto-advance after answering a yes/no question
    const nextStep = visibleSteps[safeStep + 1]
    if (nextStep) {
      setStepDirection('forward')
      setCurrentStep(prev => prev + 1)
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  const spawnConfetti = () => {
    const colors = ['#6c11c8', '#c333e0', '#00b09b', '#ffd700', '#ff6b00', '#fff', '#9b23e8', '#ff69b4', '#00cfff']
    setConfettiPieces(Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 55,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 13,
      duration: 1.8 + Math.random() * 2.5,
      delay: Math.random() * 1.1,
      rise: i % 2 === 0,
      rotation: Math.random() * 360,
      shape: i % 3,
    })))
    setTimeout(() => setConfettiPieces([]), CONFETTI_CLEANUP_MS)
  }

  // Wizard step helpers
  // Steps: 0 = ID fields, 1..N = API sections, N+1 = Docs + Comments (last)
  // Build a flat list of visible steps: id → individual questions → docs
  const visibleSteps = useMemo(() => {
    if (loadingPreguntas || secciones.length === 0) return []
    const steps = [{ type: 'id', key: 'id' }]
    for (const seccion of secciones) {
      for (const pregunta of seccion.preguntas) {
        steps.push({ type: 'question', key: `q:${pregunta.id}`, seccion, pregunta })
      }
    }
    return steps
  }, [loadingPreguntas, secciones])
  const totalSteps = visibleSteps.length
  const safeStep = Math.min(currentStep, Math.max(0, visibleSteps.length - 1))
  const currentStepInfo = visibleSteps[safeStep]

  const handleNext = () => {
    const info = currentStepInfo
    if (info?.type === 'id') {
      const errors = {}
      if (!form.nombre.trim()) errors.nombre = t('errValidationRequired')
      if (!form.apellidos.trim()) errors.apellidos = t('errValidationRequired')
      if (!form.dniNie.trim()) errors.dniNie = t('errValidationRequired')
      if (!form.telefono.trim()) errors.telefono = t('errValidationRequired')
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        setQuestionShake(true)
        setTimeout(() => setQuestionShake(false), SHAKE_DURATION_MS)
        return
      }
    } else if (info?.type === 'question') {
      const { pregunta } = info
      if (form[pregunta.id] == null || form[pregunta.id] === '') {
        setFormError(t('errValidationQuestions'))
        setQuestionShake(true)
        setTimeout(() => setQuestionShake(false), SHAKE_DURATION_MS)
        return
      }
    }
    setFormError(null)
    setStepDirection('forward')
    setCurrentStep(prev => prev + 1)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlePrev = () => {
    setStepDirection('backward')
    setStreak(0)
    setFieldErrors({})
    setFormError(null)
    setCurrentStep(prev => Math.max(0, prev - 1))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setFormError(null)

    // Validate required identification fields
    if (!form.nombre.trim() || !form.apellidos.trim() || !form.dniNie.trim() || !form.telefono.trim()) {
      setFormError(t('errValidationRequired'))
      return
    }

    // Validate all questions are answered
    const unanswered = secciones.some(seccion =>
      seccion.preguntas.some(pregunta => {
        return form[pregunta.id] == null || form[pregunta.id] === ''
      })
    )
    if (unanswered) {
      setFormError(t('errValidationQuestions'))
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
        }
        const { data, error, response } = await updateDeclaracion({ path: { id: editId }, body: updateBody })
        if (data) {
          setEditId(null)
          setSubmitted(true)
          spawnConfetti()
          showToast(t('toastSuccess'), 'success')
          setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        } else {
          setFormError(`${t('toastErrorHttp')} ${response?.status ?? '?'}${t('toastErrorHttpSuffix')} ${error?.message ?? ''}`)
        }
      } else {
        const { data, error, response } = await createDeclaracion({ body })
        if (data) {
          setSubmitted(true)
          spawnConfetti()
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
          setFormError(`${t('toastErrorHttp')} ${response?.status ?? '?'}${t('toastErrorHttpSuffix')} ${error?.message ?? ''}`)
        }
      }
    } catch {
      setFormError(t('toastErrorNetwork'))
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
          <div className="lang-flags" role="group" aria-label={t('langLabel')}>
            {availableLanguages.map(l => (
              <button
                key={l.code}
                type="button"
                className={`lang-flag-btn${lang === l.code ? ' active' : ''}`}
                onClick={() => setLang(l.code)}
                aria-label={l.label}
                title={l.label}
              >
                <span className="lang-flag-emoji">{LANG_FLAGS[l.code] ?? '🌐'}</span>
                <span className="lang-flag-code">{l.code.toUpperCase()}</span>
              </button>
            ))}
          </div>
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

        {/* Quiz progress bar */}
        {!submitted && !loadingPreguntas && !errorPreguntas && totalSteps > 0 && (
          <div className="quiz-progress-header">
            <div className="quiz-progress-top">
              <div className="quiz-counter">{safeStep + 1} <span>/ {totalSteps}</span></div>
            </div>
            <div className="quiz-linear-bar-wrap">
              <div
                className="quiz-linear-bar"
                style={{ width: `${totalSteps > 0 ? ((safeStep + 1) / totalSteps) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {submitted && (
          <div className="quiz-progress-header">
            <div className="quiz-progress-top">
              <span className="quiz-section-badge">🎉 {t('successTitle')}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="quiz-counter">✓</div>
              </div>
            </div>
            <div className="quiz-linear-bar-wrap">
              <div className="quiz-linear-bar" style={{ width: '100%' }} />
            </div>
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
            {loadingPreguntas && <div className="info-box">{t('loadingQuestions')}</div>}
            {errorPreguntas && <div className="info-box">{t('errorQuestions')}{errorPreguntas}</div>}

            {!loadingPreguntas && !errorPreguntas && (
              <form onSubmit={handleSubmit} noValidate>
                {/* Animated wizard step container – key change triggers CSS animation */}
                <div
                  key={`step-${currentStep}`}
                  className={`wizard-step${stepDirection === 'backward' ? ' reverse' : ''}${questionShake ? ' shake' : ''}`}
                >

                  {/* ── Step: Identification ── */}
                  {currentStepInfo?.type === 'id' && (
                    <>
                      <div className="info-box">
                        <strong>{t('instructionsTitle')}</strong>
                        {t('instructionsText')}<em>{t('campaignName')}</em>{t('instructionsText2')}
                      </div>
                      <div className="wizard-step-header">
                        <div className="wizard-step-icon">👤</div>
                        <div>
                          <div className="wizard-step-title">{t('section1')}</div>
                          <div className="wizard-step-subtitle">{t('step1Subtitle')}</div>
                        </div>
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label>{t('fieldNombre')}</label>
                          <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder={t('fieldNombre')} required className={fieldErrors.nombre ? 'is-invalid' : ''} />
                          {fieldErrors.nombre && <span className="field-error">{fieldErrors.nombre}</span>}
                        </div>
                        <div className="field">
                          <label>{t('fieldApellidos')}</label>
                          <input type="text" name="apellidos" value={form.apellidos} onChange={handleChange} placeholder={t('fieldApellidosPlaceholder')} required className={fieldErrors.apellidos ? 'is-invalid' : ''} />
                          {fieldErrors.apellidos && <span className="field-error">{fieldErrors.apellidos}</span>}
                        </div>
                        <div className="field">
                          <label>{t('fieldDniNie')}</label>
                          <input type="text" name="dniNie" value={form.dniNie} onChange={handleChange} placeholder="00000000A" maxLength={9} required className={fieldErrors.dniNie ? 'is-invalid' : ''} />
                          {fieldErrors.dniNie && <span className="field-error">{fieldErrors.dniNie}</span>}
                        </div>
                        <div className="field">
                          <label>{t('fieldEmail')} <span className="field-optional">{t('fieldEmailOptional')}</span></label>
                          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('fieldEmailPlaceholder')} />
                        </div>
                        <div className="field">
                          <label>{t('fieldTelefono')}</label>
                          <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} placeholder={t('fieldTelefonoPlaceholder')} required className={fieldErrors.telefono ? 'is-invalid' : ''} />
                          {fieldErrors.telefono && <span className="field-error">{fieldErrors.telefono}</span>}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Step: Single question (quiz style) ── */}
                  {currentStepInfo?.type === 'question' && (() => {
                    const { pregunta } = currentStepInfo
                    return (
                      <div className="quiz-single-question">
                        <YesNoField
                          name={pregunta.id}
                          value={form[pregunta.id] ?? ''}
                          onChange={handleChange}
                          label={pregunta.textos?.[lang] ?? pregunta.texto}
                          indent={false}
                          t={t}
                          onAnswer={handleAnswer}
                        />
                      </div>
                    )
                  })()}

                </div>{/* end wizard-step */}

                {/* Inline error message */}
                {formError && (
                  <div className="form-error-banner" role="alert">
                    <span>{formError}</span>
                    <button type="button" className="form-error-dismiss" onClick={() => setFormError(null)} aria-label={t('btnDismissError')}>×</button>
                  </div>
                )}

                {/* Wizard navigation */}
                <div className="wizard-nav">
                  <div>
                    {safeStep > 0 && (
                      <button type="button" className="btn btn-secondary" onClick={handlePrev}>
                        {t('btnBack')}
                      </button>
                    )}
                    {safeStep === 0 && (
                      <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>{t('btnClear')}</button>
                    )}
                  </div>
                  <div className="wizard-progress-text">
                    {safeStep + 1} / {totalSteps}
                  </div>
                  <div className="wizard-nav-right">
                    {safeStep < totalSteps - 1 ? (
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

      {/* Confetti on submission */}
      {confettiPieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: p.shape === 0 ? '50%' : p.shape === 1 ? '2px' : '0',
            transform: `rotate(${p.rotation}deg)`,
            animation: `${p.rise ? 'confettiRise' : 'confettiFall'} ${p.duration}s ease ${p.delay}s forwards`,
          }}
        />
      ))}

    </>
  )
}
