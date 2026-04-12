import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { listDeclaraciones as listDeclaracionesReal } from './api/index.ts'
import { listDeclaraciones as listDeclaracionesMock, changePassword as changePasswordMock } from './mockApi.js'
import { DEMO_MODE } from './constants.js'

const listDeclaraciones = DEMO_MODE ? listDeclaracionesMock : listDeclaracionesReal
const changePasswordFn = DEMO_MODE ? changePasswordMock : null

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
    if (!pwForm.oldPassword) errs.oldPassword = 'Introduce la contraseña actual'
    if (!pwForm.newPassword || pwForm.newPassword.length < MIN_PASSWORD_LENGTH) errs.newPassword = `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
    if (pwForm.newPassword !== pwForm.confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden'
    if (Object.keys(errs).length) { setPwErrors(errs); return }
    if (!changePasswordFn) { setPwErrors({ global: 'Función no disponible' }); return }
    setPwLoading(true)
    const { error: apiError } = await changePasswordFn({
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
        <div className="logo">AEAT</div>
        <div className="header-text">
          <h1>Mi Perfil</h1>
          <p>Campaña Renta 2025 · Impuesto sobre la Renta de las Personas Físicas (IRPF)</p>
        </div>
        <nav className="header-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('#/')}>
            📋 Nuevo cuestionario
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
            🚪 Cerrar sesión
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

        <div className="section-title">Mis declaraciones</div>

        {loading && <div className="info-box">⏳ Cargando tus declaraciones…</div>}

        {error && (
          <div className="info-box info-box-error">
            ❌ No se pudieron cargar tus declaraciones: {error}
          </div>
        )}

        {!loading && !error && declaraciones.length === 0 && (
          <div className="info-box">
            <strong>📭 Sin declaraciones</strong>
            Aún no has enviado ningún cuestionario. <button
              type="button"
              className="link-btn"
              onClick={() => onNavigate('#/')}
            >Haz clic aquí para empezar.</button>
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
                    <span>Enviado: {formatFecha(dec.creadoEn)}</span>
                    {dec.actualizadoEn && dec.actualizadoEn !== dec.creadoEn && (
                      <span>Actualizado: {formatFecha(dec.actualizadoEn)}</span>
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
                        <div className="section-title">5. Documentación Adjunta</div>
                        <ul className="documentos-list">
                          {dec.documentos.map(doc => (
                            <li key={doc.id}>
                              📄 {doc.nombreOriginal}
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
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleEdit(dec)}
                      >
                        ✏️ Modificar cuestionario
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {changePasswordFn && (
      <div className="card">
        <div className="section-title">🔑 Cambiar contraseña</div>
        {pwSuccess && (
          <div className="info-box">✅ Contraseña actualizada correctamente.</div>
        )}
        {pwErrors.global && (
          <div className="info-box info-box-error">❌ {pwErrors.global}</div>
        )}
        <form onSubmit={handlePwSubmit} noValidate>
          <div className="form-grid">
            <div className="field">
              <label>Contraseña actual</label>
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
              <label>Nueva contraseña</label>
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
              <label>Confirmar nueva contraseña</label>
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
              {pwLoading ? '⏳ Guardando…' : '💾 Actualizar contraseña'}
            </button>
          </div>
        </form>
      </div>
      )}

      <footer>
        <p>Este formulario es meramente informativo y no constituye una presentación oficial ante la AEAT.</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · Campaña de la Renta 2025</p>
        <p><a href="#/api-docs">📄 API Docs (Swagger UI)</a></p>
      </footer>
    </>
  )
}
