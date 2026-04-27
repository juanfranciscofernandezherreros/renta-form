#!/usr/bin/env node
'use strict'

// ---------------------------------------------------------------------------
//  scripts/run-frontend-tests.cjs
//
//  Orchestrates the frontend Playwright/Cucumber suite:
//    1. Starts a lightweight mock API server on port 3001 that serves the
//       minimal JSON responses the frontend needs (no DB required).
//    2. Starts the Vite dev server on port 5173.
//    3. Waits for both to be available.
//    4. Runs `cucumber-js --tags @frontend` which generates:
//         - cucumber-report.html  (HTML report)
//    5. Stops both servers.
//    6. Propagates the cucumber exit code.
//
//  Environment variables:
//    VITE_PORT   – Vite dev server port (default: 5173)
//    MOCK_PORT   – Mock API server port (default: 3001)
// ---------------------------------------------------------------------------

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..')
const VITE_PORT = process.env.VITE_PORT || '5173'
const MOCK_PORT = process.env.MOCK_PORT || '3001'
const VITE_KILL_TIMEOUT_MS = 8000
const FRONTEND_URL = `http://localhost:${VITE_PORT}`
const MOCK_URL = `http://localhost:${MOCK_PORT}`

// ── Mock API data ────────────────────────────────────────────────────────────

const MOCK_IDIOMAS = [{ code: 'es', label: 'Español' }]

const MOCK_TRADUCCIONES = {
  es: {
    btnAdmin: 'Área de gestión', btnBack: 'Volver', btnClear: 'Resetear formulario',
    btnConsultando: 'Consultando…', btnConsultar: 'Consultar', btnContinue: 'Continuar',
    btnDismissError: 'Cerrar error', btnDownloadPDF: 'Descargar PDF',
    btnLoggingIn: 'Iniciando sesión…', btnLogin: 'Iniciar sesión', btnFinalize: 'Finalizar',
    btnSubmit: 'Enviar declaración', btnSubmitting: 'Enviando…',
    btnUpdatePassword: 'Actualizar contraseña', btnUpdatingPassword: 'Actualizando…',
    btnUpdateEmail: 'Actualizar email', btnUpdatingEmail: 'Actualizando…',
    campaignName: 'Renta 2024', changeEmailTitle: 'Cambiar email',
    changePasswordTitle: 'Cambiar contraseña',
    confirmClear: '¿Seguro que quieres limpiar el formulario?',
    errDniDuplicate: 'Ya existe una declaración con este DNI/NIE.',
    errDniFormat: 'El formato del DNI/NIE no es válido.',
    errEmailFormat: 'El formato del email no es válido.',
    errEmailRequired: 'El email es obligatorio.',
    errNewPasswordLength: 'La nueva contraseña debe tener al menos',
    errNewPasswordLengthSuffix: 'caracteres.',
    errOldPasswordRequired: 'Debes introducir la contraseña actual.',
    errPasswordRequired: 'La contraseña es obligatoria.',
    errPasswordsNoMatch: 'Las contraseñas no coinciden.',
    errTokenRequired: 'Introduce un token de consulta.',
    errUserBlocked: 'Tu cuenta está bloqueada.',
    errValidationQuestions: 'Debes responder todas las preguntas antes de continuar.',
    errValidationRequired: 'Este campo es obligatorio.',
    errorQuestions: 'Error al cargar las preguntas: ',
    fieldApellidos: 'Apellidos', fieldApellidosPlaceholder: 'Tus apellidos',
    fieldConfirmPassword: 'Confirmar nueva contraseña', fieldDniNie: 'DNI / NIE',
    fieldEmail: 'Email', fieldEmailOptional: '(Opcional)',
    fieldEmailPlaceholder: 'tu@email.es',
    fieldName: 'Nombre', fieldNombre: 'Nombre', fieldNamePlaceholder: 'Tu nombre',
    fieldNewEmail: 'Nuevo email', fieldNewPassword: 'Nueva contraseña',
    fieldOldPassword: 'Contraseña actual', fieldTelefono: 'Teléfono',
    fieldTelefonoPlaceholder: 'Tu número de teléfono', fieldUsername: 'Usuario',
    instructionsTitle: 'Formulario de declaración de la Renta',
    instructionsText: 'Por favor rellena el formulario de declaración de la Renta ',
    instructionsText2: '. Todos los campos marcados son obligatorios.',
    labelTelefono: 'Teléfono', langLabel: 'Idioma', logoText: 'Renta Form',
    loadingQuestions: 'Cargando preguntas…',
    navAdmin: 'Administración', navLogout: 'Cerrar sesión', no: 'No',
    noQuestions: 'No hay preguntas configuradas.', passwordChangeSuccess: 'Contraseña actualizada.',
    profileEditLocked: 'Envío completado', profileTabTitle: 'Mi perfil',
    section1: 'Datos personales', sectionConfirm: 'Confirmar y enviar',
    statusArchived: 'Archivada', statusCompleted: 'Completada',
    statusDocsPending: 'Documentación pendiente', statusReceived: 'Recibida',
    statusUnderReview: 'En revisión',
    successText: 'Tu declaración ha sido enviada correctamente.',
    successTitle: '¡Enviado!', summaryTitle: 'Resumen', summaryYourData: 'Tus datos',
    tabDeclaraciones: 'Declaraciones', tabPreguntas: 'Preguntas',
    toastErrorHttp: 'Error HTTP ', toastErrorHttpSuffix: ':',
    toastErrorNetwork: 'Error de red.', toastSuccess: 'Guardado correctamente.',
    tokenConsultaTitle: 'Consulta tu declaración', yes: 'Sí',
    estadoRecibido: 'Recibida', estadoEnRevision: 'En revisión',
    estadoDocumentacionPendiente: 'Documentación pendiente',
    estadoCompletado: 'Completada', estadoArchivado: 'Archivada',
    step1Subtitle: 'Rellena tus datos de identificación',
    instructionsTitle2: '',
  },
}

const MOCK_PREGUNTAS = {
  secciones: [
    {
      id: 'vivienda', numero: 1, titulo: 'Vivienda', titulos: { es: 'Vivienda' },
      preguntas: [
        { id: 'q-viv-1', campo: 'viviendaAlquiler', texto: '¿Pagas alquiler de tu vivienda habitual?', textos: { es: '¿Pagas alquiler de tu vivienda habitual?' } },
        { id: 'q-viv-2', campo: 'viviendaHipoteca', texto: '¿Tienes hipoteca sobre tu vivienda habitual?', textos: { es: '¿Tienes hipoteca sobre tu vivienda habitual?' } },
      ],
    },
    {
      id: 'familia', numero: 2, titulo: 'Cargas familiares', titulos: { es: 'Cargas familiares' },
      preguntas: [
        { id: 'q-fam-1', campo: 'hijosmenores', texto: '¿Tienes hijos menores a tu cargo?', textos: { es: '¿Tienes hijos menores a tu cargo?' } },
      ],
    },
  ],
}

// ── Mock HTTP server ──────────────────────────────────────────────────────────

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' })
  res.end(body)
}

function startMockServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.method === 'OPTIONS') { jsonResponse(res, 204, {}); return }

      const url = req.url.split('?')[0]

      if (url === '/health' || url === '/v1/health') {
        jsonResponse(res, 200, { status: 'ok' }); return
      }
      if (url === '/v1/irpf/idiomas') {
        jsonResponse(res, 200, MOCK_IDIOMAS); return
      }
      if (url === '/v1/irpf/traducciones') {
        jsonResponse(res, 200, MOCK_TRADUCCIONES); return
      }
      if (url.startsWith('/v1/irpf/preguntas')) {
        jsonResponse(res, 200, MOCK_PREGUNTAS); return
      }
      if (url.startsWith('/v1/irpf/declaraciones') && req.method === 'GET') {
        jsonResponse(res, 200, { data: [], total: 0 }); return
      }
      if (url.startsWith('/v1/public/declaraciones') && req.method === 'POST') {
        jsonResponse(res, 201, { id: 'mock-001', nombre: 'Test', estado: 'recibida' }); return
      }
      // Fallback 404
      jsonResponse(res, 404, { error: 'not found' })
    })
    server.listen(port, '127.0.0.1', () => {
      console.log(`[run-frontend-tests] Mock API server escuchando en puerto ${port}`)
      resolve(server)
    })
  })
}

function waitFor(url, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(url)
        if (r.ok || r.status < 500) return resolve()
      } catch { /* keep polling */ }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`${url} no respondió en ${timeoutMs}ms`))
      }
      setTimeout(tick, 500)
    }
    tick()
  })
}

function spawnPromise(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('exit', (code, signal) => resolve({ code, signal, child }))
  })
}

async function main() {
  // 1) Start mock API server
  let mockServer = null
  try {
    mockServer = await startMockServer(Number(MOCK_PORT))
  } catch (err) {
    console.warn(`[run-frontend-tests] No se pudo iniciar el mock server (puerto ${MOCK_PORT} ocupado?): ${err.message}`)
    console.warn('[run-frontend-tests] Continuando sin mock server (asumiendo que ya hay un servidor en ese puerto).')
  }

  // 2) Start Vite dev server – point API base URL directly at the mock server
  // so the React app skips Vite's proxy and talks to our local mock directly.
  console.log('[run-frontend-tests] Arrancando Vite dev server…')
  const vite = spawn(
    process.execPath,
    [path.join('node_modules', '.bin', 'vite'), '--port', VITE_PORT],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        VITE_PORT,
        // Expose the mock server's base URL to the React client bundle
        VITE_API_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    }
  )

  let viteStopped = false
  const viteExited = new Promise((resolve) => { vite.once('exit', resolve) })
  const stopVite = async () => {
    if (viteStopped) return viteExited
    viteStopped = true
    vite.kill('SIGTERM')
    const killer = setTimeout(() => { try { vite.kill('SIGKILL') } catch { /* */ } }, VITE_KILL_TIMEOUT_MS)
    killer.unref()
    return viteExited
  }

  const cleanup = async () => {
    await stopVite()
    if (mockServer) mockServer.close()
  }
  process.on('SIGINT', () => cleanup().then(() => process.exit(130)))
  process.on('SIGTERM', () => cleanup().then(() => process.exit(143)))

  // 3) Wait for Vite to be ready
  try {
    await waitFor(FRONTEND_URL)
    console.log('[run-frontend-tests] Frontend disponible en', FRONTEND_URL)
  } catch (err) {
    console.error('[run-frontend-tests] Error de arranque Vite:', err.message)
    await cleanup()
    process.exit(1)
  }

  // 4) Run cucumber with @frontend tag
  console.log('[run-frontend-tests] Ejecutando tests @frontend con Cucumber…')
  const cuc = await spawnPromise(
    process.execPath,
    [
      path.join('node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js'),
      '--tags', '@frontend',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        BASE_URL: FRONTEND_URL,
        API_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
      },
    }
  )

  // 5) Stop servers
  await cleanup()

  if (cuc.code !== 0) {
    console.error(`[run-frontend-tests] cucumber-js falló con código ${cuc.code}`)
    process.exit(cuc.code || 1)
  }

  console.log('[run-frontend-tests] ✅ Todos los tests frontend pasaron. Reporte generado: cucumber-report.html')
  process.exit(0)
}

main().catch((err) => {
  console.error('[run-frontend-tests] error inesperado:', err)
  process.exit(1)
})
