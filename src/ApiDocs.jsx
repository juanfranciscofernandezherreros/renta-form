import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function ApiDocs() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '12px' }}>
        <a href="#" onClick={e => { e.preventDefault(); window.location.hash = '' }}>
          ← Volver al formulario
        </a>
      </div>
      <SwaggerUI url="/openapi.yaml" />
    </div>
  )
}
