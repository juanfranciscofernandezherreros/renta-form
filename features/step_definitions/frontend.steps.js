import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber'

setDefaultTimeout(60 * 1000)

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_IDIOMAS = [{ code: 'es', label: 'Español' }]

const MOCK_TRADUCCIONES = {
  es: {
    btnAdmin: 'Área de gestión',
    btnBack: 'Volver',
    btnClear: 'Resetear formulario',
    btnConsultando: 'Consultando…',
    btnConsultar: 'Consultar',
    btnContinue: 'Continuar',
    btnDismissError: 'Cerrar error',
    btnDownloadPDF: 'Descargar PDF',
    btnLoggingIn: 'Iniciando sesión…',
    btnLogin: 'Iniciar sesión',
    btnFinalize: 'Finalizar',
    btnSubmit: 'Enviar declaración',
    btnSubmitting: 'Enviando…',
    btnUpdatePassword: 'Actualizar contraseña',
    btnUpdatingPassword: 'Actualizando…',
    btnUpdateEmail: 'Actualizar email',
    btnUpdatingEmail: 'Actualizando…',
    campaignName: 'Renta 2024',
    changeEmailTitle: 'Cambiar email',
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
    fieldApellidos: 'Apellidos',
    fieldApellidosPlaceholder: 'Tus apellidos',
    fieldConfirmPassword: 'Confirmar nueva contraseña',
    fieldDniNie: 'DNI / NIE',
    fieldEmail: 'Email',
    fieldName: 'Nombre',
    fieldNamePlaceholder: 'Tu nombre',
    fieldNewEmail: 'Nuevo email',
    fieldNewPassword: 'Nueva contraseña',
    fieldOldPassword: 'Contraseña actual',
    fieldTelefono: 'Teléfono',
    fieldTelefonoPlaceholder: 'Tu número de teléfono',
    fieldUsername: 'Usuario',
    instructionsText1: 'Rellena este formulario',
    instructionsText2: '. Todos los campos marcados son obligatorios.',
    labelTelefono: 'Teléfono',
    navAdmin: 'Administración',
    navLogout: 'Cerrar sesión',
    no: 'No',
    noQuestions: 'No hay preguntas configuradas. Contacta con el administrador.',
    passwordChangeSuccess: 'Contraseña actualizada correctamente.',
    profileEditLocked: 'Envío completado – no editable',
    profileTabTitle: 'Mi perfil',
    section1: 'Datos personales',
    sectionConfirm: 'Confirmar y enviar',
    statusArchived: 'Archivada',
    statusCompleted: 'Completada',
    statusDocsPending: 'Documentación pendiente',
    statusReceived: 'Recibida',
    statusUnderReview: 'En revisión',
    successText: 'Tu declaración ha sido enviada correctamente.',
    successTitle: '¡Enviado!',
    tabDeclaraciones: 'Declaraciones',
    tabPreguntas: 'Preguntas',
    toastErrorHttp: 'Error HTTP ',
    toastErrorHttpSuffix: ':',
    toastErrorNetwork: 'Error de red.',
    toastSuccess: 'Guardado correctamente.',
    tokenConsultaTitle: 'Consulta tu declaración',
    yes: 'Sí',
    estadoRecibido: 'Recibida',
    estadoEnRevision: 'En revisión',
    estadoDocumentacionPendiente: 'Documentación pendiente',
    estadoCompletado: 'Completada',
    estadoArchivado: 'Archivada',
  },
}

const MOCK_PREGUNTAS = {
  secciones: [
    {
      id: 'vivienda',
      numero: 1,
      titulo: 'Vivienda',
      titulos: { es: 'Vivienda' },
      preguntas: [
        {
          id: 'q-viv-1',
          campo: 'viviendaAlquiler',
          texto: '¿Pagas alquiler de tu vivienda habitual?',
          textos: { es: '¿Pagas alquiler de tu vivienda habitual?' },
        },
        {
          id: 'q-viv-2',
          campo: 'viviendaHipoteca',
          texto: '¿Tienes hipoteca sobre tu vivienda habitual?',
          textos: { es: '¿Tienes hipoteca sobre tu vivienda habitual?' },
        },
      ],
    },
    {
      id: 'familia',
      numero: 2,
      titulo: 'Cargas familiares',
      titulos: { es: 'Cargas familiares' },
      preguntas: [
        {
          id: 'q-fam-1',
          campo: 'hijosmenores',
          texto: '¿Tienes hijos menores de 25 años a tu cargo?',
          textos: { es: '¿Tienes hijos menores de 25 años a tu cargo?' },
        },
      ],
    },
  ],
}

const MOCK_DECLARACIONES_LIST = { data: [], total: 0 }

const MOCK_DECLARACION_CREATED = {
  id: 'mock-decl-001',
  nombre: 'Test',
  apellidos: 'Usuario',
  dniNie: '12345678A',
  email: 'test@ejemplo.es',
  telefono: '600000000',
  estado: 'recibida',
  creadaEn: new Date().toISOString(),
}

// ── Mock setup (handled by run-frontend-tests.cjs mock server) ────────────
// The mock server is started by scripts/run-frontend-tests.cjs on port 3001.
// Vite's proxy rewrites /v1 → http://localhost:3001/v1, so no client-side
// mocking is needed. This step is kept as a documentation/tagging step.

async function setupApiMocks(_page) {
  // No-op: the mock API server is managed by the orchestration script.
}

// ── Steps ──────────────────────────────────────────────────────────────────

Given('la API está mockeada con datos de prueba', async function () {
  // Ensure browser is open before setting up routes
  if (!this.page) await this.openBrowser()
  await setupApiMocks(this.page)
})

Given('el usuario abre la aplicación', async function () {
  await this.page.goto(this.baseUrl, { waitUntil: 'load' })
  // Wait for the identification form to be ready (requires preguntas API to respond)
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 20000 })
})

Then('se muestra el formulario de identificación', async function () {
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 10000 })
})

Then('el campo {string} está presente y es editable', async function (fieldName) {
  const input = this.page.locator(`input[name="${fieldName}"]`)
  await input.waitFor({ state: 'visible', timeout: 10000 })
  const isEditable = await input.isEditable()
  if (!isEditable) {
    throw new Error(`El campo "${fieldName}" no es editable`)
  }
})

When('el usuario pulsa el botón Continuar sin rellenar nada', async function () {
  // Wait until the identification form (and its Continue button) is visible.
  // The Continue button has class ib-btn-primary (matches App.jsx).
  await this.page.waitForSelector('.ib-btn.ib-btn-primary', { timeout: 10000 })
  await this.page.locator('.ib-btn.ib-btn-primary').first().click()
  await this.page.waitForTimeout(500)
})

Then('se muestran errores de validación en los campos requeridos', async function () {
  await this.page.waitForSelector('.ib-field-error, .is-invalid', { timeout: 10000 })
})

When('el usuario completa los datos de identificación', async function () {
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 10000 })
  await this.page.fill('input[name="nombre"]', 'Ana')
  await this.page.fill('input[name="apellidos"]', 'García López')
  await this.page.fill('input[name="dniNie"]', '12345678A')
  await this.page.fill('input[name="email"]', 'ana@ejemplo.es')
  await this.page.fill('input[name="telefono"]', '600111222')
})

Then('el botón Continuar está habilitado', async function () {
  await this.page.waitForSelector('.ib-btn.ib-btn-primary', { timeout: 10000 })
  const btn = this.page.locator('.ib-btn.ib-btn-primary').first()
  const isDisabled = await btn.isDisabled()
  if (isDisabled) {
    throw new Error('El botón Continuar debería estar habilitado pero está deshabilitado')
  }
})

When('el usuario pulsa Continuar para avanzar', async function () {
  // Click the primary action button (Continue) and wait for the page to advance.
  await this.page.waitForSelector('.ib-btn.ib-btn-primary', { timeout: 10000 })
  await this.page.locator('.ib-btn.ib-btn-primary').first().click()
  // Wait for the app to advance to the question step
  await this.page.waitForSelector('.ib-question', { timeout: 10000 })
})

Then('se muestra el primer bloque de preguntas', async function () {
  await this.page.waitForSelector('.ib-question', { timeout: 10000 })
})

When('el usuario responde Sí a la primera pregunta visible', async function () {
  await this.page.waitForSelector('.ib-question', { timeout: 10000 })
  await this.page.waitForTimeout(300)
  // Click the Yes button (ib-yesno-btn is-yes)
  await this.page.locator('.ib-yesno-btn.is-yes').first().click()
  await this.page.waitForTimeout(800)
})

When('el usuario responde No a la primera pregunta visible', async function () {
  await this.page.waitForSelector('.ib-question', { timeout: 10000 })
  await this.page.waitForTimeout(300)
  // Click the No button (ib-yesno-btn is-no)
  await this.page.locator('.ib-yesno-btn.is-no').first().click()
  await this.page.waitForTimeout(800)
})

When('el usuario pulsa el botón Volver', async function () {
  // Back button has class ib-btn-secondary and shows when safeStep > 0.
  // The Clear button (step 0) also uses ib-btn-secondary, so filter by step > 0.
  // At step 1+ (question step), the only ib-btn-secondary is the Volver button.
  await this.page.waitForSelector('.ib-btn.ib-btn-secondary', { timeout: 10000 })
  await this.page.locator('.ib-btn.ib-btn-secondary').first().click()
  await this.page.waitForSelector('input[name="nombre"]', { timeout: 10000 })
})

When('el usuario responde todas las preguntas con No', async function () {
  // Answer all mock questions. After each answer the app auto-advances.
  // After the last question the form auto-submits.
  const totalPreguntas = MOCK_PREGUNTAS.secciones.reduce(
    (acc, s) => acc + s.preguntas.length, 0
  )
  for (let i = 0; i < totalPreguntas; i++) {
    await this.page.waitForSelector('.ib-question', { timeout: 10000 })
    await this.page.waitForTimeout(300)
    await this.page.locator('.ib-yesno-btn.is-no').first().click()
    await this.page.waitForTimeout(800)
  }
})

Then('se muestra la pantalla de éxito', async function () {
  await this.page.waitForSelector('.ib-success', { timeout: 20000 })
})

Then('el selector de idioma está visible en la página', async function () {
  // Language selector buttons have class ib-lang-btn inside .ib-langs
  await this.page.waitForSelector('.ib-lang-btn', { timeout: 10000 })
})

Then('se toma screenshot {string}', async function (name) {
  await this.page.waitForTimeout(300)
  const path = await this.screenshot(name)
  console.log(`  Screenshot guardado: ${path}`)
})
