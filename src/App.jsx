import { useState, useRef, useEffect } from 'react'
import './App.css'
import { API_DECLARACIONES_URL, API_PREGUNTAS_URL } from './constants'

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

const YesNoField = ({ label, name, value, onChange, indent }) => (
  <div className={`question-row${indent ? ' indent' : ''}`}>
    <span className="question-text">{label}</span>
    <div className="radio-group">
      <label className="radio-label">
        <input type="radio" name={name} value="si" checked={value === 'si'} onChange={onChange} />
        Sí
      </label>
      <label className="radio-label">
        <input type="radio" name={name} value="no" checked={value === 'no'} onChange={onChange} />
        No
      </label>
    </div>
  </div>
)

export default function App() {
  const [form, setForm] = useState(INITIAL_STATE)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [secciones, setSecciones] = useState([])
  const [loadingPreguntas, setLoadingPreguntas] = useState(true)
  const [errorPreguntas, setErrorPreguntas] = useState(null)
  const topRef = useRef(null)

  useEffect(() => {
    fetch(API_PREGUNTAS_URL, { headers: { Accept: 'application/json' } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setSecciones(data.secciones ?? [])
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
    if (window.confirm('¿Seguro que quiere limpiar todos los campos?')) {
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

    const payload = new FormData()

    // Identification
    payload.append('nombre', form.nombre)
    payload.append('apellidos', form.apellidos)
    payload.append('dniNie', form.dniNie)
    payload.append('email', form.email)
    payload.append('telefono', form.telefono)

    // Housing
    payload.append('viviendaAlquiler', form.viviendaAlquiler)
    if (form.viviendaAlquiler === 'si') payload.append('alquilerMenos35', form.alquilerMenos35)
    payload.append('viviendaPropiedad', form.viviendaPropiedad)
    if (form.viviendaPropiedad === 'si') payload.append('propiedadAntes2013', form.propiedadAntes2013)
    payload.append('pisosAlquiladosTerceros', form.pisosAlquiladosTerceros)
    payload.append('segundaResidencia', form.segundaResidencia)

    // Family
    payload.append('familiaNumerosa', form.familiaNumerosa)
    payload.append('ayudasGobierno', form.ayudasGobierno)
    payload.append('mayores65ACargo', form.mayores65ACargo)
    if (form.mayores65ACargo === 'si') payload.append('mayoresConviven', form.mayoresConviven)
    payload.append('hijosMenores26', form.hijosMenores26)

    // Extraordinary income
    payload.append('ingresosJuego', form.ingresosJuego)
    payload.append('ingresosInversiones', form.ingresosInversiones)

    // Documents
    if (form.docDniAnverso) payload.append('docDniAnverso', form.docDniAnverso)
    if (form.docDniReverso) payload.append('docDniReverso', form.docDniReverso)
    if (form.docAdicional) {
      for (const file of form.docAdicional) {
        payload.append('docAdicional', file)
      }
    }

    // Comments
    payload.append('comentarios', form.comentarios)

    setSubmitting(true)
    try {
      const response = await fetch(API_DECLARACIONES_URL, {
        method: 'POST',
        body: payload,
      })
      if (response.ok) {
        setSubmitted(true)
        showToast('✅ Cuestionario enviado correctamente. Nos pondremos en contacto contigo en breve.', 'success')
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      } else {
        showToast(`❌ Error al enviar el cuestionario (HTTP ${response.status}). Inténtelo de nuevo.`, 'error')
      }
    } catch {
      showToast('❌ No se pudo conectar con el servidor. Compruebe su conexión e inténtelo de nuevo.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header ref={topRef}>
        <div className="logo">AEAT</div>
        <div className="header-text">
          <h1>Cuestionario para Expediente Fiscal</h1>
          <p>Campaña Renta 2025 · Impuesto sobre la Renta de las Personas Físicas (IRPF)</p>
        </div>
      </header>

      <div className="card">
        {/* Progress bar */}
        <div className="progress-bar">
          <div className={`step ${submitted ? 'done' : 'active'}`}><div className="bubble">{submitted ? '✓' : '1'}</div> Identificación</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '2'}</div> Vivienda</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '3'}</div> Familia</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '4'}</div> Ingresos</div>
          <div className={`step ${submitted ? 'done' : ''}`}><div className="bubble">{submitted ? '✓' : '5'}</div> Documentación</div>
        </div>

        {submitted ? (
          <div className="success-panel">
            <div className="success-icon">✅</div>
            <h2>¡Cuestionario enviado correctamente!</h2>
            <p>Hemos recibido tu información. Nuestro equipo revisará tu expediente fiscal y se pondrá en contacto contigo en breve.</p>
            <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>Enviar otro cuestionario</button>
          </div>
        ) : (
          <>
            <div className="info-box">
              <strong>📋 Instrucciones</strong>
              Rellene el siguiente cuestionario con la mayor precisión posible. La información proporcionada nos permitirá
              preparar su expediente fiscal para la <em>Campaña de la Renta 2025</em>. Todos los datos se tratarán con
              total confidencialidad conforme a la normativa de protección de datos.
            </div>

            <form onSubmit={handleSubmit} noValidate>

              {/* 1. Datos de identificación */}
              <div className="section-title">1. Datos de Identificación</div>
              <div className="form-grid">
                <div className="field">
                  <label>Nombre</label>
                  <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre" required />
                </div>
                <div className="field">
                  <label>Apellidos</label>
                  <input type="text" name="apellidos" value={form.apellidos} onChange={handleChange} placeholder="Primer apellido Segundo apellido" required />
                </div>
                <div className="field">
                  <label>Número de DNI / NIE</label>
                  <input type="text" name="dniNie" value={form.dniNie} onChange={handleChange} placeholder="00000000A" maxLength={9} required />
                </div>
                <div className="field">
                  <label>Correo electrónico de contacto</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="ejemplo@correo.es" required />
                </div>
                <div className="field">
                  <label>Teléfono móvil</label>
                  <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} placeholder="600 000 000" required />
                </div>
              </div>

              {/* 2–4. Preguntas dinámicas cargadas desde el endpoint */}
              {loadingPreguntas && (
                <div className="info-box">⏳ Cargando preguntas…</div>
              )}
              {errorPreguntas && (
                <div className="info-box">❌ No se pudieron cargar las preguntas: {errorPreguntas}</div>
              )}
              {!loadingPreguntas && !errorPreguntas && secciones.map(seccion => (
                <div key={seccion.id}>
                  <div className="section-title">{seccion.numero}. {seccion.titulo}</div>
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
                          label={pregunta.texto}
                          indent={pregunta.indentada}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* 5. Documentación adjunta */}
              <div className="section-title">5. Documentación Adjunta</div>
              <div className="info-box">
                <strong>📎 Formatos admitidos</strong>
                Se admiten archivos en formato PDF, JPG o PNG. Tamaño máximo por archivo: 5 MB.
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Copia escaneada del DNI/NIE — Anverso</label>
                  <input type="file" name="docDniAnverso" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} />
                  {form.docDniAnverso && <span className="file-name">📄 {form.docDniAnverso.name}</span>}
                </div>
                <div className="field">
                  <label>Copia escaneada del DNI/NIE — Reverso</label>
                  <input type="file" name="docDniReverso" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} />
                  {form.docDniReverso && <span className="file-name">📄 {form.docDniReverso.name}</span>}
                </div>
                <div className="field full">
                  <label>Documentación adicional (Nóminas, certificados de retenciones, facturas deducibles, etc.)</label>
                  <input type="file" name="docAdicional" accept=".pdf,.jpg,.jpeg,.png,.zip" multiple onChange={handleChange} />
                  {form.docAdicional && <span className="file-name">📄 {Array.from(form.docAdicional).map(f => f.name).join(', ')}</span>}
                </div>
              </div>

              {/* 6. Información adicional */}
              <div className="section-title">6. Información Adicional</div>
              <div className="form-grid">
                <div className="field full">
                  <label>Comentarios sobre situaciones especiales</label>
                  <textarea
                    name="comentarios"
                    value={form.comentarios}
                    onChange={handleChange}
                    placeholder="Indique aquí cualquier situación especial que deba tenerse en cuenta: ventas de inmuebles, inversiones en el extranjero, cambios en el estado civil, herencias, etc."
                    rows={5}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>🗑 Limpiar</button>
                <button type="submit" className="btn btn-success" disabled={submitting}>
                  {submitting ? '⏳ Enviando…' : '📤 Enviar cuestionario'}
                </button>
              </div>

            </form>
          </>
        )}
      </div>

      <footer>
        <p>Este formulario es meramente informativo y no constituye una presentación oficial ante la AEAT.</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · Campaña de la Renta 2025</p>
      </footer>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
