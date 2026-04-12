import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Router from './Router.jsx'
import { client } from './api/client.gen.ts'
import { API_BASE_URL } from './constants.js'

client.setConfig({ baseUrl: API_BASE_URL })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
