import { lazy, Suspense, useState, useEffect } from 'react'
import App from './App.jsx'
import LoginPage from './LoginPage.jsx'
import ProfilePage from './ProfilePage.jsx'
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

  if (hash === '#/api-docs') {
    return (
      <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Cargando documentación…</div>}>
        <ApiDocs />
      </Suspense>
    )
  }

  if (hash === '#/login') {
    return <LoginPage onNavigate={navigate} />
  }

  if (hash === '#/perfil') {
    if (!user) {
      navigate('#/login')
      return null
    }
    return (
      <ProfilePage
        onNavigate={navigate}
        onEditDeclaracion={(dec) => setEditData(dec)}
      />
    )
  }

  return (
    <App
      onNavigate={navigate}
      editData={editData}
      onEditDataConsumed={() => setEditData(null)}
    />
  )
}
