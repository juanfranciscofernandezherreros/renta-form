import { useState, useRef } from 'react'
import './App.css'
import { API_DECLARACIONES_URL } from './constants'

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
  const topRef = useRef(null)

  const handleChange = e => {
    const { name, value, type } = e.target
    if (type === 'file') {
      setForm(prev => ({ ...prev, [name]: e.target.files[0] ?? null }))
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
    if (form.docAdicional)  payload.append('docAdicional',  form.docAdicional)

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

              {/* 2. Situación de vivienda */}
              <div className="section-title">2. Situación de Vivienda</div>
              <div className="questions-list">
                <YesNoField
                  id="viviendaAlquiler" name="viviendaAlquiler" value={form.viviendaAlquiler} onChange={handleChange}
                  label="¿Vives actualmente de alquiler?"
                />
                {form.viviendaAlquiler === 'si' && (
                  <YesNoField
                    id="alquilerMenos35" name="alquilerMenos35" value={form.alquilerMenos35} onChange={handleChange}
                    label="En caso de vivir de alquiler, ¿tienes menos de 35 años?"
                    indent
                  />
                )}
                <YesNoField
                  id="viviendaPropiedad" name="viviendaPropiedad" value={form.viviendaPropiedad} onChange={handleChange}
                  label="¿Tu vivienda habitual es de propiedad?"
                />
                {form.viviendaPropiedad === 'si' && (
                  <YesNoField
                    id="propiedadAntes2013" name="propiedadAntes2013" value={form.propiedadAntes2013} onChange={handleChange}
                    label="En caso de ser de propiedad, ¿la compraste antes del 1 de enero de 2013?"
                    indent
                  />
                )}
                <YesNoField
                  id="pisosAlquiladosTerceros" name="pisosAlquiladosTerceros" value={form.pisosAlquiladosTerceros} onChange={handleChange}
                  label="¿Tienes otros pisos de tu propiedad que estén alquilados a terceros?"
                />
                <YesNoField
                  id="segundaResidencia" name="segundaResidencia" value={form.segundaResidencia} onChange={handleChange}
                  label="¿Tienes una segunda residencia para tu propio uso y disfrute?"
                />
              </div>

              {/* 3. Cargas familiares y ayudas públicas */}
              <div className="section-title">3. Cargas Familiares y Ayudas Públicas</div>
              <div className="questions-list">
                <YesNoField
                  id="familiaNumerosa" name="familiaNumerosa" value={form.familiaNumerosa} onChange={handleChange}
                  label="¿Tienes el título de familia numerosa?"
                />
                <YesNoField
                  id="ayudasGobierno" name="ayudasGobierno" value={form.ayudasGobierno} onChange={handleChange}
                  label="¿Has recibido alguna ayuda o subvención del gobierno durante el año 2025?"
                />
                <YesNoField
                  id="mayores65ACargo" name="mayores65ACargo" value={form.mayores65ACargo} onChange={handleChange}
                  label="¿Tienes personas mayores de 65 años a tu cargo?"
                />
                {form.mayores65ACargo === 'si' && (
                  <YesNoField
                    id="mayoresConviven" name="mayoresConviven" value={form.mayoresConviven} onChange={handleChange}
                    label="En caso de tener mayores a cargo, ¿viven contigo en el mismo domicilio?"
                    indent
                  />
                )}
                <YesNoField
                  id="hijosMenores26" name="hijosMenores26" value={form.hijosMenores26} onChange={handleChange}
                  label="¿Tienes hijos menores de 26 años a tu cargo?"
                />
              </div>

              {/* 4. Ingresos extraordinarios e inversiones */}
              <div className="section-title">4. Ingresos Extraordinarios e Inversiones</div>
              <div className="questions-list">
                <YesNoField
                  id="ingresosJuego" name="ingresosJuego" value={form.ingresosJuego} onChange={handleChange}
                  label="¿Has recibido ingresos procedentes del juego o apuestas (online o presenciales) durante el año 2025?"
                />
                <YesNoField
                  id="ingresosInversiones" name="ingresosInversiones" value={form.ingresosInversiones} onChange={handleChange}
                  label="¿Has recibido ingresos procedentes de depósitos bancarios, fondos de inversión, venta de acciones en bolsa o similares?"
                />
              </div>

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
                  {form.docAdicional && <span className="file-name">📄 {form.docAdicional.name}</span>}
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
