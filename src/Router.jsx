import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import App from './App.jsx'
import AdminPage from './AdminPage.jsx'
import AdminLoginPage from './AdminLoginPage.jsx'
import LoginPage from './LoginPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import TokenConsultaPage from './TokenConsultaPage.jsx'
import { useAuth } from './AuthContext.jsx'

const ApiDocs = lazy(() => import('./ApiDocs.jsx'))

export default function Router() {
  const [hash, setHash] = useState(window.location.hash)
  const [editData, setEditData] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (newHash) => {
    // eslint-disable-next-line react-hooks/immutability
    window.location.hash = newHash
    setHash(newHash)
  }

  const handleEditDeclaracion = useCallback((dec) => setEditData(dec), [])
  const handleEditDataConsumed = useCallback(() => setEditData(null), [])

  if (hash === '#/api-docs') {
    return (
      <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Cargando documentación…</div>}>
        <ApiDocs />
      </Suspense>
    )
  }

  if (hash === '#/backend_admin') {
    if (!user || user.role !== 'admin') {
      return <AdminLoginPage />
    }
    return <AdminPage onNavigate={navigate} />
  }

  if (hash === '#/login') {
    return <LoginPage onNavigate={navigate} />
  }

  if (hash === '#/perfil') {
    if (!user) {
      return <LoginPage onNavigate={navigate} />
    }
    return (
      <ProfilePage
        onNavigate={navigate}
        onEditDeclaracion={handleEditDeclaracion}
      />
    )
  }

  if (hash === '#/consulta' || hash.startsWith('#/consulta/')) {
    const token = hash.startsWith('#/consulta/') ? hash.slice('#/consulta/'.length) : ''
    return (
      <TokenConsultaPage
        onNavigate={navigate}
        onEditDeclaracion={handleEditDeclaracion}
        initialToken={token}
      />
    )
  }

  return (
    <App
      onNavigate={navigate}
      editData={editData}
      onEditDataConsumed={handleEditDataConsumed}
    />
  )
}
