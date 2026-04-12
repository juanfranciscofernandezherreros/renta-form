import { lazy, Suspense } from 'react'
import App from './App.jsx'

const ApiDocs = lazy(() => import('./ApiDocs.jsx'))

export default function Router() {
  const isApiDocs = window.location.hash === '#/api-docs'
  return isApiDocs ? (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Cargando documentación…</div>}>
      <ApiDocs />
    </Suspense>
  ) : (
    <App />
  )
}
