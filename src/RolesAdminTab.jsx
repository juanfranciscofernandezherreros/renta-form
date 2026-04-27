import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  listRolesAdmin,
  createRoleAdmin,
  updateRoleAdmin,
  deleteRoleAdmin,
} from './apiClient.js'

const RESERVED_ROLES = new Set(['admin', 'user'])

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function RolesAdminTab({ showToast }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Modal state
  const [editModal, setEditModal] = useState(null) // { id?, nombre, descripcion, isNew, saving }
  const [confirmDelete, setConfirmDelete] = useState(null)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    listRolesAdmin()
      .then(({ data, error: apiErr }) => {
        if (cancelled) return
        if (apiErr) throw new Error(apiErr.message ?? 'Error desconocido')
        setRoles(data ?? [])
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const openNewRol = () => setEditModal({ id: null, nombre: '', descripcion: '', isNew: true, saving: false })
  const openEditRol = (rol) => setEditModal({ id: rol.id, nombre: rol.nombre, descripcion: rol.descripcion, isNew: false, saving: false })

  const handleSave = async () => {
    if (!editModal) return
    const nombre = editModal.nombre.trim()
    if (!nombre) {
      showToast('El nombre del rol es obligatorio', 'error')
      return
    }
    setEditModal(prev => prev ? { ...prev, saving: true } : prev)
    const body = { nombre, descripcion: editModal.descripcion.trim() }
    const { error: apiErr } = editModal.isNew
      ? await createRoleAdmin(body)
      : await updateRoleAdmin({ id: editModal.id, ...body })
    if (apiErr) {
      showToast(`Error: ${apiErr.message}`, 'error')
      setEditModal(prev => prev ? { ...prev, saving: false } : prev)
      return
    }
    showToast(editModal.isNew ? 'Rol creado correctamente' : 'Rol actualizado')
    setEditModal(null)
    refresh()
  }

  const handleDelete = async (id) => {
    setConfirmDelete(null)
    const { error: apiErr } = await deleteRoleAdmin({ id })
    if (apiErr) { showToast(`Error: ${apiErr.message}`, 'error'); return }
    showToast('Rol eliminado')
    refresh()
  }

  return (
    <div>
      <div className="admin-toolbar">
        <div className="admin-stats">
          <span className="admin-stat-badge">{roles.length} rol{roles.length !== 1 ? 'es' : ''}</span>
        </div>
        <div className="admin-filters">
          <button type="button" className="btn btn-primary btn-sm" onClick={openNewRol}>
            ➕ Nuevo rol
          </button>
        </div>
      </div>

      {loading && <div className="info-box">⏳ Cargando roles…</div>}
      {error && <div className="info-box info-box-error">❌ {error}</div>}

      {!loading && !error && roles.length === 0 && (
        <div className="info-box">No hay roles definidos.</div>
      )}

      {!loading && !error && roles.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="preguntas-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Usuarios</th>
                <th>Creado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => {
                const reserved = RESERVED_ROLES.has(r.nombre)
                return (
                  <tr key={r.id}>
                    <td>
                      <code style={{ fontWeight: 600 }}>{r.nombre}</code>
                      {reserved && (
                        <span className="estado-badge badge-blue" style={{ marginLeft: 6 }}>🔒 Sistema</span>
                      )}
                    </td>
                    <td style={{ fontSize: '.9rem', color: '#444' }}>{r.descripcion || <em style={{ color: '#999' }}>—</em>}</td>
                    <td style={{ textAlign: 'right' }}>{r.usuarios ?? 0}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>{formatFecha(r.creadoEn)}</td>
                    <td>
                      <div className="pregunta-actions" style={{ flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-xs"
                          onClick={() => openEditRol(r)}
                          title="Editar rol"
                        >
                          ✏️ Editar
                        </button>
                        {!reserved && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-xs"
                            onClick={() => setConfirmDelete(r)}
                            title="Eliminar rol"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editModal && createPortal(
        <div className="admin-modal-overlay" onClick={() => !editModal.saving && setEditModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">{editModal.isNew ? '➕ Nuevo rol' : '✏️ Editar rol'}</h2>
            <div className="field">
              <label>Nombre</label>
              <input
                type="text"
                value={editModal.nombre}
                disabled={!editModal.isNew && RESERVED_ROLES.has(editModal.nombre)}
                onChange={e => setEditModal(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="p. ej. supervisor"
                maxLength={50}
              />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea
                value={editModal.descripcion}
                onChange={e => setEditModal(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
                placeholder="Descripción opcional del rol"
              />
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditModal(null)}
                disabled={editModal.saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={editModal.saving}
              >
                {editModal.saving ? '⏳ Guardando…' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {confirmDelete && createPortal(
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">⚠️ Confirmar eliminación</h2>
            <p className="admin-modal-desc">
              ¿Eliminar el rol <strong>{confirmDelete.nombre}</strong>? Se quitará de todos los usuarios que lo tengan asignado.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
