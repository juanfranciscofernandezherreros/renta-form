import { lazy, Suspense, useState, useEffect } from 'react'
import App from './App.jsx'

const ApiDocs = lazy(() => import('./ApiDocs.jsx'))

export default function Router() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return hash === '#/api-docs' ? (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Cargando documentación…</div>}>
      <ApiDocs />
    </Suspense>
  ) : (
    <App />
  )
}
