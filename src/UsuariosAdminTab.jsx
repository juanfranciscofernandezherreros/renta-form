import { useState, useEffect, useCallback } from 'react'
import {
  listUsersAdmin,
  blockUser,
  reportUser,
  deleteUser,
  sendEmailToUser,
  listDeclaraciones,
} from './apiClient.js'
import Pagination from './Pagination.jsx'

// Re-use the same PDF logic as AdminPage
const ESTADOS_LABELS = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  documentacion_pendiente: 'Documentación pendiente',
  completado: 'Completado',
  archivado: 'Archivado',
}

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
}

const SECCIONES_DATOS = [
  { titulo: '1. Datos de Identificación', campos: ['nombre', 'apellidos', 'dniNie', 'email', 'telefono'] },
  { titulo: '2. Situación de Vivienda', campos: ['viviendaAlquiler', 'alquilerMenos35', 'viviendaPropiedad', 'propiedadAntes2013', 'pisosAlquiladosTerceros', 'segundaResidencia'] },
  { titulo: '3. Cargas Familiares y Ayudas Públicas', campos: ['familiaNumerosa', 'ayudasGobierno', 'mayores65ACargo', 'mayoresConviven', 'hijosMenores26'] },
  { titulo: '4. Ingresos Extraordinarios e Inversiones', campos: ['ingresosJuego', 'ingresosInversiones'] },
]
const YN_LABELS = { si: 'Sí', no: 'No' }

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

async function downloadUserDeclaracionPdf(dniNie) {
  const { data: result } = await listDeclaraciones({ query: { dniNie, limit: 1 } })
  const dec = result?.data?.[0]
  if (!dec) {
    alert('Este usuario no tiene ninguna declaración registrada.')
    return
  }

  const allSections = [
    ...SECCIONES_DATOS,
    { titulo: '5. Documentación Adjunta', campos: [] },
  ]

  const rows = allSections.flatMap(sec => {
    if (sec.campos.length === 0) {
      if (!dec.documentos?.length) return []
      return [
        `<tr><td colspan="2" class="sec-header">${escHtml(sec.titulo)}</td></tr>`,
        ...dec.documentos.map(
          doc => `<tr><td class="lbl">📄 ${escHtml(doc.nombreOriginal)}</td><td class="val">${escHtml(doc.mimeType)} · ${Math.round(doc.tamanyo / 1024)} KB</td></tr>`
        ),
      ]
    }
    const camposVisibles = sec.campos
      .map(c => [c, dec[c]])
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (!camposVisibles.length) return []
    return [
      `<tr><td colspan="2" class="sec-header">${escHtml(sec.titulo)}</td></tr>`,
      ...camposVisibles.map(
        ([c, v]) => `<tr><td class="lbl">${escHtml(CAMPOS_LABELS[c] ?? c)}</td><td class="val">${escHtml(YN_LABELS[v] ?? v)}</td></tr>`
      ),
    ]
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Declaración ${escHtml(dec.id.slice(0, 8))}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 32px; }
  h1 { font-size: 18px; color: #003087; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  .sec-header { background: #003087; color: #fff; font-weight: bold; font-size: 12px; padding: 8px 10px; }
  .lbl { color: #555; width: 55%; }
  .val { font-weight: bold; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>🏛️ NH Gestión Integral – Cuestionario IRPF 2025</h1>
<div class="meta">
  Declaración: <strong>${escHtml(dec.id)}</strong> &nbsp;·&nbsp;
  Estado: <strong>${escHtml(ESTADOS_LABELS[dec.estado] ?? dec.estado)}</strong> &nbsp;·&nbsp;
  Enviada: <strong>${escHtml(formatFecha(dec.creadoEn))}</strong> &nbsp;·&nbsp;
  Última actualización: <strong>${escHtml(formatFecha(dec.actualizadoEn))}</strong>
</div>
<table>${rows}</table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

export default function UsuariosAdminTab({ showToast }) {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroBloqueado, setFiltroBloqueado] = useState('')
  const [filtroDenunciado, setFiltroDenunciado] = useState('')
  const [page, setPage] = useState(1)
  const limit = 10
  const [refreshKey, setRefreshKey] = useState(0)

  // Modals
  const [emailModal, setEmailModal] = useState(null)
  const [emailMsg, setEmailMsg] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const query = { page, limit }
    if (filtroBloqueado !== '') query.bloqueado = filtroBloqueado === 'true'
    if (filtroDenunciado !== '') query.denunciado = filtroDenunciado === 'true'
    listUsersAdmin({ query })
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setUsers(data?.data ?? [])
        setTotal(data?.total ?? 0)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filtroBloqueado, filtroDenunciado, page, refreshKey])

  const handleBlock = async (user) => {
    const nuevoEstado = !user.bloqueado
    const { error: apiErr } = await blockUser({
      path: { dniNie: user.dniNie },
      body: { bloqueado: nuevoEstado },
    })
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast(nuevoEstado ? `Usuario ${user.dniNie} bloqueado` : `Usuario ${user.dniNie} desbloqueado`)
    refresh()
  }

  const handleReport = async (user) => {
    const nuevoEstado = !user.denunciado
    const { error: apiErr } = await reportUser({
      path: { dniNie: user.dniNie },
      body: { denunciado: nuevoEstado },
    })
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast(nuevoEstado ? `Usuario ${user.dniNie} denunciado` : `Denuncia de ${user.dniNie} retirada`)
    refresh()
  }

  const handleDelete = async (dniNie) => {
    setConfirmDelete(null)
    const { error: apiErr } = await deleteUser({ path: { dniNie } })
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast('Usuario eliminado correctamente')
    refresh()
  }

  const handleSendEmail = async () => {
    if (!emailModal) return
    setEmailSending(true)
    const { error: apiErr } = await sendEmailToUser({
      dniNie: emailModal.dniNie,
      email: emailModal.email,
      mensaje: emailMsg || undefined,
    })
    setEmailSending(false)
    setEmailModal(null)
    setEmailMsg('')
    if (apiErr) { showToast(`Error al enviar email: ${apiErr.message}`, 'error'); return }
    showToast(`📧 Email enviado a ${emailModal.email}`)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{total} usuario{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="admin-filters">
          <select
            className="admin-filter-select"
            value={filtroBloqueado}
            onChange={e => { setFiltroBloqueado(e.target.value); setPage(1) }}
          >
            <option value="">Todos (bloqueo)</option>
            <option value="true">Bloqueados</option>
            <option value="false">No bloqueados</option>
          </select>
          <select
            className="admin-filter-select"
            value={filtroDenunciado}
            onChange={e => { setFiltroDenunciado(e.target.value); setPage(1) }}
          >
            <option value="">Todos (denuncia)</option>
            <option value="true">Denunciados</option>
            <option value="false">No denunciados</option>
          </select>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando usuarios…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && users.length === 0 && (
        <div className="info-box">No se encontraron usuarios con los filtros aplicados.</div>
      )}

      {!loading && !error && users.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>DNI / NIE</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.dniNie}>
                  <td>
                    <div className="pregunta-texto">{u.nombre} {u.apellidos}</div>
                    <div className="pregunta-seccion">📞 {u.telefono || '—'}</div>
                  </td>
                  <td><code>{u.dniNie}</code></td>
                  <td style={{ fontSize: '.85rem' }}>{u.email}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {u.bloqueado && (
                        <span className="estado-badge badge-orange">🔒 Bloqueado</span>
                      )}
                      {u.denunciado && (
                        <span className="estado-badge badge-orange" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          🚨 Denunciado
                        </span>
                      )}
                      {!u.bloqueado && !u.denunciado && (
                        <span className="estado-badge badge-activa">✅ Activo</span>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>{formatFecha(u.creadoEn)}</td>
                  <td>
                    <div className="pregunta-actions" style={{ flexWrap: 'wrap', gap: 4 }}>
                      <button
                        type="button"
                        className={`btn btn-sm btn-xs ${u.bloqueado ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleBlock(u)}
                        title={u.bloqueado ? 'Desbloquear usuario' : 'Bloquear usuario'}
                      >
                        {u.bloqueado ? '🔓 Desbloquear' : '🔒 Bloquear'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm btn-xs ${u.denunciado ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleReport(u)}
                        title={u.denunciado ? 'Retirar denuncia' : 'Denunciar usuario'}
                      >
                        {u.denunciado ? '✅ Retirar denuncia' : '🚨 Denunciar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => { setEmailModal(u); setEmailMsg('') }}
                        title="Enviar email al usuario"
                      >
                        📧 Email
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-xs"
                        onClick={() => downloadUserDeclaracionPdf(u.dniNie)}
                        title="Descargar PDF de la declaración"
                      >
                        📄 PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-xs"
                        onClick={() => setConfirmDelete(u.dniNie)}
                        title="Eliminar usuario"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
      />

      {/* Email modal */}
      {emailModal && (
        <div className="admin-modal-overlay" onClick={() => setEmailModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">📧 Enviar email</h2>
            <p className="admin-modal-desc">
              Destinatario: <strong>{emailModal.nombre} {emailModal.apellidos}</strong><br />
              Correo: <strong>{emailModal.email}</strong>
            </p>
            <div className="field">
              <label>Mensaje (opcional)</label>
              <textarea
                value={emailMsg}
                onChange={e => setEmailMsg(e.target.value)}
                placeholder="Escribe un mensaje personalizado para el usuario…"
                rows={4}
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setEmailModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={emailSending}
                onClick={handleSendEmail}
              >
                {emailSending ? 'Enviando…' : '📧 Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Estás seguro de que quieres eliminar este usuario y todas sus declaraciones? Esta acción no se puede deshacer.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign secciones modal */}
    </div>
  )
}
