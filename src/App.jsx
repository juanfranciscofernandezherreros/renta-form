import { useState, useRef, useEffect, useMemo } from 'react'
import './App.css'
import { getPreguntas, createDeclaracion, updateDeclaracion, listDeclaraciones } from './apiClient.js'
import { useLanguage } from './LanguageContext.jsx'
import { generateDeclaracionPDF } from './pdfUtils.js'
import { translateYN } from './i18nUtils.js'


const INITIAL_STATE = {
  // Identificación – únicos campos fijos. Las respuestas a las preguntas se
  // construyen dinámicamente a partir de las preguntas que devuelve la API.
  nombre: '',
  apellidos: '',
  dniNie: '',
  email: '',
  telefono: '',
}

const ID_FIELDS = ['nombre', 'apellidos', 'dniNie', 'email', 'telefono']

const LANG_FLAGS = {
  es: '🇪🇸',
  fr: '🇫🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  pt: '🇵🇹',
  it: '🇮🇹',
  ca: '🏳️',
}

const BrandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
    <path d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M4 7.5L12 12l8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4L8.5 12.1l6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
  </svg>
)

const YesNoField = ({ label, name, value, onChange, t, questionNumber, onAnswer, shake }) => {
  return (
    <div className={`ib-question${shake ? ' shake' : ''}`}>
      <div className="ib-question-head">
        {questionNumber != null && (
          <span className="ib-question-num">{questionNumber}</span>
        )}
        <span className="ib-question-text">{label}</span>
      </div>
      <div className="ib-yesno">
        <button
          type="button"
          className={`ib-yesno-btn is-yes${value === 'si' ? ' is-selected' : ''}`}
          onClick={() => {
            const isNew = value !== 'si'
            onChange({ target: { name, value: 'si' } })
            if (isNew) onAnswer?.()
          }}
        >
          <span aria-hidden="true">✅</span> {t('yes')}
        </button>
        <button
          type="button"
          className={`ib-yesno-btn is-no${value === 'no' ? ' is-selected' : ''}`}
          onClick={() => {
            const isNew = value !== 'no'
            onChange({ target: { name, value: 'no' } })
            if (isNew) onAnswer?.()
          }}
        >
          <span aria-hidden="true">❌</span> {t('no')}
        </button>
      </div>
    </div>
  )
}

const SHAKE_DURATION_MS = 600  // matches .shake CSS animation duration (0.6s)
const CONFETTI_COUNT = 75
const CONFETTI_CLEANUP_MS = 5500
// Wizard step indices for the 2-step form flow.
const STEP_ID = 0
const STEP_QUESTIONS = 1

export default function App({ editData, onEditDataConsumed }) {
  const { lang, setLang, t, availableLanguages } = useLanguage()
  const [form, setForm] = useState(INITIAL_STATE)
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [secciones, setSecciones] = useState([])
  const [loadingPreguntas, setLoadingPreguntas] = useState(true)
  const [errorPreguntas, setErrorPreguntas] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [_stepDirection, setStepDirection] = useState('forward')
  const [fieldErrors, setFieldErrors] = useState({})
  const topRef = useRef(null)
  const formRef = useRef(null)

  // Game animation state
  const [xpPopups, setXpPopups] = useState([])
  const [streak, setStreak] = useState(0)
  const [questionShake, setQuestionShake] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState([])
  const xpCounterRef = useRef(0)

  useEffect(() => {
    if (!editData) return
    setEditId(editData.id)
    // Copy identification fields and any answer-style property already
    // present on editData (each `pregunta.id` becomes a top-level key).
    const next = { ...INITIAL_STATE }
    for (const f of ID_FIELDS) next[f] = editData[f] ?? ''
    for (const [k, v] of Object.entries(editData)) {
      if (ID_FIELDS.includes(k)) continue
      if (v === 'si' || v === 'no') next[k] = v
    }
    setForm(next)
    setSubmitted(false)
    // Land directly on the questions step so the user can immediately review
    // and modify any answers from the saved declaration.
    setCurrentStep(STEP_QUESTIONS)
    setStepDirection('forward')
    setFieldErrors({})
    setFormError(null)
    onEditDataConsumed?.()
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [editData, onEditDataConsumed])

  useEffect(() => {
    setLoadingPreguntas(true)
    setErrorPreguntas(null)
    getPreguntas(lang)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message ?? 'Error desconocido')
        setSecciones(data?.secciones ?? [])
        setLoadingPreguntas(false)
      })
      .catch(err => {
        setErrorPreguntas(err.message)
        setLoadingPreguntas(false)
      })
  }, [lang])

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

  const resetFormState = () => {
    setForm(INITIAL_STATE)
    setEditId(null)
    setSubmitted(false)
    setCurrentStep(0)
    setStepDirection('forward')
    setFieldErrors({})
  }

  const handleLimpiar = () => {
    if (window.confirm(t('confirmClear'))) {
      resetFormState()
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
    // Auto-advance after answering a yes/no question.
    // If the next step is the confirm step (or there is no next step), auto-submit
    // immediately so the user doesn't have to press any extra button.
    const nextStep = visibleSteps[safeStep + 1]
    if (nextStep && nextStep.type !== 'confirm') {
      setStepDirection('forward')
      setCurrentStep(prev => prev + 1)
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } else {
      // Last question answered – auto-submit after React commits the answer state
      setTimeout(() => formRef.current?.requestSubmit(), 0)
    }
  }

  const handleFinalizar = () => {
    resetFormState()
    setStreak(0)
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
  // Steps: 0 = ID fields, 1..N = one step per question from the catalog.
  // Every question returned by the API is shown as its own step, with
  // auto-advance on yes/no click and auto-submit on the last answer.
  const visibleSteps = useMemo(() => {
    if (loadingPreguntas || secciones.length === 0) return []
    const steps = [{ type: 'id', key: 'id' }]
    for (const seccion of secciones) {
      for (const pregunta of seccion.preguntas) {
        steps.push({ type: 'question', key: `q:${pregunta.id}`, seccion, pregunta })
      }
    }
    // Final review step: shows a summary of the answers and the submit button
    // so the user must explicitly confirm before sending the declaration.
    steps.push({ type: 'confirm', key: 'confirm' })
    return steps
  }, [loadingPreguntas, secciones])
  const totalSteps = visibleSteps.length
  const safeStep = Math.min(currentStep, Math.max(0, visibleSteps.length - 1))
  const currentStepInfo = visibleSteps[safeStep]

  const [checkingDni, setCheckingDni] = useState(false)
  const handleNext = async () => {
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
      // Check whether a declaration with this DNI/NIE already exists.
      // When editing, the current declaration itself must not trigger the error.
      // The unique constraint guarantees at most one match, so limit: 1 is enough.
      setCheckingDni(true)
      try {
        const { data } = await listDeclaraciones({ query: { dniNie: form.dniNie.trim(), limit: 1 } })
        const existing = (data?.data ?? []).filter(d => d.id !== editId)
        if (existing.length > 0) {
          setFieldErrors({ dniNie: t('errDniDuplicate') })
          setQuestionShake(true)
          setTimeout(() => setQuestionShake(false), SHAKE_DURATION_MS)
          return
        }
      } catch (err) {
        // On network errors, allow advancing; the final submit will still validate.
        console.warn('DNI duplicate check failed:', err)
      } finally {
        setCheckingDni(false)
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

    // Guard: no questions configured at all
    const allPreguntas = secciones.flatMap(s => s.preguntas ?? [])
    if (allPreguntas.length === 0) {
      setFormError(t('noQuestions'))
      return
    }

    // Validate all questions are answered
    const unanswered = allPreguntas.some(p => form[p.id] == null || form[p.id] === '')
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
    }
    // Append every dynamic answer (one property per pregunta.id)
    for (const p of allPreguntas) {
      const v = form[p.id]
      if (v === 'si' || v === 'no') body[p.id] = v
    }

    setSubmitting(true)
    try {
      if (editId && updateDeclaracion) {
        // Update existing declaration with the same dynamic body
        const updateBody = { ...body }
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

  // ── Sidebar stepper: 1 step for ID + 1 step per sección + 1 final
  // "Confirmar y enviar" step that lights up on the last wizard step. ──
  const sidebarSteps = useMemo(() => {
    const steps = [{ key: 'id', title: t('section1') }]
    for (const seccion of secciones) {
      steps.push({
        key: `s:${seccion.id}`,
        title: seccion.titulos?.[lang] ?? seccion.titulo ?? `Sección ${seccion.numero ?? ''}`.trim(),
        seccionId: seccion.id,
      })
    }
    steps.push({ key: 'confirm', title: t('sectionConfirm') })
    return steps
  }, [secciones, lang, t])

  // Index of the active sidebar step based on the current wizard step.
  // The final "confirm" step (last index) becomes active when the user is on
  // the last wizard step (where the Submit button is shown), and is marked
  // done once the declaration has been submitted.
  const activeSidebarIndex = useMemo(() => {
    const confirmIdx = sidebarSteps.length - 1
    if (submitted) return confirmIdx + 1 // mark all (including confirm) as done
    if (totalSteps > 1 && safeStep === totalSteps - 1) return confirmIdx
    if (!currentStepInfo) return 0
    if (currentStepInfo.type === 'id') return 0
    const idx = secciones.findIndex(s => s.id === currentStepInfo.seccion?.id)
    return idx >= 0 ? idx + 1 : 0
  }, [currentStepInfo, secciones, sidebarSteps.length, safeStep, totalSteps, submitted])

  // Active question text/subtitle for the main header
  const mainHeading = useMemo(() => {
    if (!currentStepInfo) return { title: t('section1'), subtitle: t('step1Subtitle') }
    if (currentStepInfo.type === 'id') {
      return { title: t('section1'), subtitle: t('step1Subtitle') }
    }
    if (currentStepInfo.type === 'confirm') {
      return { title: t('sectionConfirm'), subtitle: t('summaryTitle') }
    }
    const sec = currentStepInfo.seccion
    const title = sec?.titulos?.[lang] ?? sec?.titulo ?? t('section1')
    return { title, subtitle: t('instructionsTitle') }
  }, [currentStepInfo, lang, t])

  return (
    <div className="ib-shell">
      {/* ── Sidebar with stepper ───────────────────────────────────── */}
      <aside className="ib-sidebar">
        <div className="ib-brand">
          <span className="ib-brand-icon"><BrandIcon /></span>
          <span className="ib-brand-name">{t('logoText')}</span>
        </div>
        {sidebarSteps.length > 0 && (
          <ol className="ib-stepper">
            {sidebarSteps.map((step, idx) => {
              const status =
                idx < activeSidebarIndex ? 'is-done'
                  : idx === activeSidebarIndex ? 'is-active'
                  : 'is-pending'
              return (
                <li key={step.key} className={`ib-step ${status}`}>
                  <div className="ib-step-bullet-col">
                    <span className="ib-step-bullet">
                      {status === 'is-done' ? <CheckIcon /> : (idx + 1)}
                    </span>
                    {idx < sidebarSteps.length - 1 && <span className="ib-step-line" />}
                  </div>
                  <div className="ib-step-label">
                    <span className="ib-step-tag">{`${idx + 1} / ${sidebarSteps.length}`}</span>
                    <span className="ib-step-title">{step.title}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="ib-main">
        <div className="ib-topbar">
          <div className="ib-langs" role="group" aria-label={t('langLabel')}>
            {availableLanguages.map(l => (
              <button
                key={l.code}
                type="button"
                className={`ib-lang-btn${lang === l.code ? ' is-active' : ''}`}
                onClick={() => setLang(l.code)}
                aria-label={l.label}
                title={l.label}
              >
                <span aria-hidden="true">{LANG_FLAGS[l.code] ?? '🌐'}</span>
                <span>{l.code.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ib-content" ref={topRef}>
          <div className="ib-content-inner">
            {!submitted && !loadingPreguntas && !errorPreguntas && totalSteps > 0 && (
              <div className="ib-progress">
                <span>{safeStep + 1} / {totalSteps}</span>
                <span className="ib-progress-bar">
                  <span
                    className="ib-progress-fill"
                    style={{ width: `${totalSteps > 0 ? ((safeStep + 1) / totalSteps) * 100 : 0}%` }}
                  />
                </span>
              </div>
            )}

            {submitted ? (
              <div className="ib-success">
                <div className="ib-success-icon">✓</div>
                <h2>{t('successTitle')}</h2>
                <p>{t('successText')}</p>

                <section className="ib-summary" aria-label={t('summaryTitle')}>
                  <h3 className="ib-summary-title">{t('summaryTitle')}</h3>

                  <div className="ib-summary-section">
                    <h4 className="ib-summary-section-title">{t('summaryYourData')}</h4>
                    <dl className="ib-summary-list">
                      <div className="ib-summary-row">
                        <dt>{t('fieldNombre')}</dt>
                        <dd>{form.nombre || '-'}</dd>
                      </div>
                      <div className="ib-summary-row">
                        <dt>{t('fieldApellidos')}</dt>
                        <dd>{form.apellidos || '-'}</dd>
                      </div>
                      <div className="ib-summary-row">
                        <dt>{t('fieldDniNie')}</dt>
                        <dd>{form.dniNie || '-'}</dd>
                      </div>
                      {form.email && (
                        <div className="ib-summary-row">
                          <dt>{t('fieldEmail')}</dt>
                          <dd>{form.email}</dd>
                        </div>
                      )}
                      <div className="ib-summary-row">
                        <dt>{t('fieldTelefono')}</dt>
                        <dd>{form.telefono || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  {secciones.map(seccion => {
                    const preguntasConRespuesta = (seccion.preguntas ?? []).filter(p => {
                      const v = form[p.id]
                      return v === 'si' || v === 'no'
                    })
                    if (preguntasConRespuesta.length === 0) return null
                    const seccionTitulo = seccion.titulos?.[lang] ?? seccion.titulo ?? ''
                    return (
                      <div key={seccion.id} className="ib-summary-section">
                        <h4 className="ib-summary-section-title">{seccionTitulo}</h4>
                        <dl className="ib-summary-list">
                          {preguntasConRespuesta.map(p => (
                            <div key={p.id} className="ib-summary-row">
                              <dt>{p.textos?.[lang] ?? p.texto}</dt>
                              <dd>{translateYN(form[p.id], t)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )
                  })}
                </section>

                <div className="ib-success-actions">
                  <button
                    type="button"
                    className="ib-btn ib-btn-primary"
                    onClick={() => generateDeclaracionPDF(form, secciones, lang)}
                  >
                    {t('btnDownloadPDF')}
                  </button>
                  <button type="button" className="ib-btn ib-btn-secondary" onClick={handleFinalizar}>
                    {t('btnFinalize')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="ib-title">{mainHeading.title}</h1>
                <p className="ib-subtitle">{mainHeading.subtitle}</p>

                {loadingPreguntas && <div className="ib-empty">{t('loadingQuestions')}</div>}
                {errorPreguntas && <div className="ib-empty">{t('errorQuestions')}{errorPreguntas}</div>}
                {!loadingPreguntas && !errorPreguntas && visibleSteps.length === 0 && (
                  <div className="ib-empty">{t('noQuestions')}</div>
                )}

                {!loadingPreguntas && !errorPreguntas && visibleSteps.length > 0 && (
                  <form ref={formRef} onSubmit={handleSubmit} noValidate className="ib-form">
                    {currentStepInfo?.type === 'id' && (
                      <>
                        <div className="ib-info">
                          <strong>{t('instructionsTitle')}</strong>
                          {t('instructionsText')}<em>{t('campaignName')}</em>{t('instructionsText2')}
                        </div>
                        <div className="ib-field">
                          <label htmlFor="ib-nombre">{t('fieldNombre')}</label>
                          <input
                            id="ib-nombre"
                            className={`ib-input${fieldErrors.nombre ? ' is-invalid' : ''}`}
                            type="text" name="nombre" value={form.nombre}
                            onChange={handleChange} placeholder={t('fieldNombre')} required
                          />
                          {fieldErrors.nombre && <span className="ib-field-error">{fieldErrors.nombre}</span>}
                        </div>
                        <div className="ib-row">
                          <div className="ib-field">
                            <label htmlFor="ib-apellidos">{t('fieldApellidos')}</label>
                            <input
                              id="ib-apellidos"
                              className={`ib-input${fieldErrors.apellidos ? ' is-invalid' : ''}`}
                              type="text" name="apellidos" value={form.apellidos}
                              onChange={handleChange} placeholder={t('fieldApellidosPlaceholder')} required
                            />
                            {fieldErrors.apellidos && <span className="ib-field-error">{fieldErrors.apellidos}</span>}
                          </div>
                          <div className="ib-field">
                            <label htmlFor="ib-dni">{t('fieldDniNie')}</label>
                            <input
                              id="ib-dni"
                              className={`ib-input${fieldErrors.dniNie ? ' is-invalid' : ''}`}
                              type="text" name="dniNie" value={form.dniNie}
                              onChange={handleChange} placeholder="00000000A" maxLength={9} required
                            />
                            {fieldErrors.dniNie && <span className="ib-field-error">{fieldErrors.dniNie}</span>}
                          </div>
                        </div>
                        <div className="ib-row">
                          <div className="ib-field">
                            <label htmlFor="ib-email">
                              {t('fieldEmail')}
                              <span className="ib-optional">{t('fieldEmailOptional')}</span>
                            </label>
                            <input
                              id="ib-email"
                              className="ib-input"
                              type="email" name="email" value={form.email}
                              onChange={handleChange} placeholder={t('fieldEmailPlaceholder')}
                            />
                          </div>
                          <div className="ib-field">
                            <label htmlFor="ib-tel">{t('fieldTelefono')}</label>
                            <input
                              id="ib-tel"
                              className={`ib-input${fieldErrors.telefono ? ' is-invalid' : ''}`}
                              type="tel" name="telefono" value={form.telefono}
                              onChange={handleChange} placeholder={t('fieldTelefonoPlaceholder')} required
                            />
                            {fieldErrors.telefono && <span className="ib-field-error">{fieldErrors.telefono}</span>}
                          </div>
                        </div>
                      </>
                    )}

                    {currentStepInfo?.type === 'question' && (() => {
                      const { pregunta } = currentStepInfo
                      return (
                        <YesNoField
                          name={pregunta.id}
                          value={form[pregunta.id] ?? ''}
                          onChange={handleChange}
                          label={pregunta.textos?.[lang] ?? pregunta.texto}
                          t={t}
                          onAnswer={handleAnswer}
                          shake={questionShake}
                        />
                      )
                    })()}

                    {currentStepInfo?.type === 'confirm' && (
                      <section className="ib-summary" aria-label={t('summaryTitle')}>
                        <h3 className="ib-summary-title">{t('summaryTitle')}</h3>

                        <div className="ib-summary-section">
                          <h4 className="ib-summary-section-title">{t('summaryYourData')}</h4>
                          <dl className="ib-summary-list">
                            <div className="ib-summary-row">
                              <dt>{t('fieldNombre')}</dt>
                              <dd>{form.nombre || '-'}</dd>
                            </div>
                            <div className="ib-summary-row">
                              <dt>{t('fieldApellidos')}</dt>
                              <dd>{form.apellidos || '-'}</dd>
                            </div>
                            <div className="ib-summary-row">
                              <dt>{t('fieldDniNie')}</dt>
                              <dd>{form.dniNie || '-'}</dd>
                            </div>
                            {form.email && (
                              <div className="ib-summary-row">
                                <dt>{t('fieldEmail')}</dt>
                                <dd>{form.email}</dd>
                              </div>
                            )}
                            <div className="ib-summary-row">
                              <dt>{t('fieldTelefono')}</dt>
                              <dd>{form.telefono || '-'}</dd>
                            </div>
                          </dl>
                        </div>

                        {secciones.map(seccion => {
                          const preguntasConRespuesta = (seccion.preguntas ?? []).filter(p => {
                            const v = form[p.id]
                            return v === 'si' || v === 'no'
                          })
                          if (preguntasConRespuesta.length === 0) return null
                          const seccionTitulo = seccion.titulos?.[lang] ?? seccion.titulo ?? ''
                          return (
                            <div key={seccion.id} className="ib-summary-section">
                              <h4 className="ib-summary-section-title">{seccionTitulo}</h4>
                              <dl className="ib-summary-list">
                                {preguntasConRespuesta.map(p => (
                                  <div key={p.id} className="ib-summary-row">
                                    <dt>{p.textos?.[lang] ?? p.texto}</dt>
                                    <dd>{translateYN(form[p.id], t)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )
                        })}
                      </section>
                    )}

                    {formError && (
                      <div className="ib-error-banner" role="alert">
                        <span>{formError}</span>
                        <button
                          type="button"
                          className="ib-error-dismiss"
                          onClick={() => setFormError(null)}
                          aria-label={t('btnDismissError')}
                        >×</button>
                      </div>
                    )}

                    <div className="ib-actions">
                      {safeStep < totalSteps - 1 ? (
                        <button
                          type="button"
                          className="ib-btn ib-btn-primary"
                          onClick={handleNext}
                          disabled={checkingDni}
                        >
                          {t('btnContinue')}
                        </button>
                      ) : (
                        <>
                          <button
                            type="submit"
                            className="ib-btn ib-btn-success"
                            disabled={submitting}
                          >
                            {submitting ? t('btnSubmitting') : t('btnSubmit')}
                          </button>
                          <button
                            type="button"
                            className="ib-btn ib-btn-secondary"
                            onClick={() => generateDeclaracionPDF(form, secciones, lang)}
                          >
                            {t('btnDownloadPDF')}
                          </button>
                        </>
                      )}
                      {safeStep > 0 ? (
                        <button type="button" className="ib-btn ib-btn-secondary" onClick={handlePrev}>
                          {t('btnBack')}
                        </button>
                      ) : (
                        <button type="button" className="ib-btn ib-btn-secondary" onClick={handleLimpiar}>
                          {t('btnClear')}
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* Confetti on submission – existing keyframes live in index.css */}
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
    </div>
  )
}
