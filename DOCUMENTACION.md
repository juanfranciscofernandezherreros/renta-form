# Documentación de la Aplicación — Renta Form

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Tecnologías Utilizadas](#2-tecnologías-utilizadas)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Arquitectura y Flujo de Datos](#4-arquitectura-y-flujo-de-datos)
5. [Modos de Funcionamiento](#5-modos-de-funcionamiento)
6. [Rutas de la Aplicación](#6-rutas-de-la-aplicación)
7. [Componentes y Páginas](#7-componentes-y-páginas)
8. [Gestión de Estado y Contextos](#8-gestión-de-estado-y-contextos)
9. [API REST](#9-api-rest)
10. [Internacionalización (i18n)](#10-internacionalización-i18n)
11. [Generación de PDFs](#11-generación-de-pdfs)
12. [Seguridad y Autenticación](#12-seguridad-y-autenticación)
13. [Usuarios de Prueba](#13-usuarios-de-prueba)
14. [Scripts de Desarrollo](#14-scripts-de-desarrollo)

---

## 1. Descripción General

**Renta Form** es una aplicación web desarrollada con **React + Vite** que actúa como cuestionario digital para la **Campaña de la Renta 2025 (IRPF)**. Su objetivo es recopilar la información fiscal de los contribuyentes de forma guiada y estructurada para preparar su expediente fiscal.

La aplicación está pensada como herramienta interna de **NH Gestión Integral**, firma de asesoría fiscal. Cuenta con:

- Un formulario multi-sección para rellenar datos personales, de vivienda, familiares, de ingresos y documentación adjunta.
- Un sistema de autenticación de dos niveles: código de intranet y credenciales de usuario.
- Un área de perfil donde cada contribuyente puede consultar y editar sus declaraciones enviadas.
- Un panel de administración completo para gestionar declaraciones, usuarios, secciones y preguntas.
- Soporte multilingüe (español, francés, inglés, catalán).
- Generación de resúmenes en PDF.

---

## 2. Tecnologías Utilizadas

| Tecnología | Versión | Uso |
|---|---|---|
| **React** | 19 | Framework de UI |
| **Vite** | 8 | Bundler y servidor de desarrollo |
| **@hey-api/client-fetch** | ^0.13 | Cliente HTTP generado desde OpenAPI |
| **@hey-api/openapi-ts** | ^0.95 | Generador de código TypeScript desde OpenAPI |
| **jsPDF** | ^4 | Generación de documentos PDF en el navegador |
| **swagger-ui-react** | ^5 | Documentación interactiva de la API |
| **serve** | ^14 | Servidor estático para producción |
| **ESLint** | ^9 | Linting y calidad de código |

---

## 3. Estructura del Proyecto

```
renta-form/
├── index.html              # Punto de entrada HTML
├── Procfile                # Comando de arranque en producción
├── package.json
├── vite.config.js
├── eslint.config.js
├── openapi-ts.config.js    # Config del generador de código API
├── openapi/
│   └── openapi.yaml        # Especificación OpenAPI 3.0 de la API
├── public/
│   └── openapi.yaml        # Copia pública para Swagger UI
├── database/               # Scripts SQL de base de datos
├── translations/           # Traducciones estáticas de respaldo (JSON)
│   ├── es.json             # Español
│   ├── ca.json             # Catalán
│   ├── en.json             # Inglés
│   └── fr.json             # Francés
├── features/               # Tests E2E con Cucumber + Playwright
│   ├── form.feature        # Escenarios del formulario principal
│   ├── idiomas.feature     # Escenarios de idiomas y traducciones
│   ├── preguntas.feature   # Escenarios de preguntas condicionales y admin
│   ├── step_definitions/   # Implementación de pasos Cucumber
│   └── support/            # Hooks, world y utilidades de test
├── src/
│   ├── main.jsx            # Punto de entrada React
│   ├── App.jsx             # Formulario principal (cuestionario IRPF)
│   ├── Router.jsx          # Enrutador hash-based
│   ├── App.css / index.css # Estilos globales
│   ├── constants.js        # Constantes (URLs de API)
│   ├── apiClient.js        # Cliente HTTP centralizado para el backend
│   ├── i18nUtils.js        # Utilidades de internacionalización (translateYN)
│   ├── pdfUtils.js         # Utilidades para generar PDFs con jsPDF
│   │
│   ├── AuthContext.jsx     # Contexto de autenticación
│   ├── LanguageContext.jsx # Contexto de idioma (carga desde DB + fallback estático)
│   │
│   ├── LoginPage.jsx       # Página de login de usuario
│   ├── ProfilePage.jsx     # Perfil de usuario y sus declaraciones
│   ├── AdminLoginPage.jsx  # Login del panel de administración
│   ├── AdminPage.jsx       # Panel de administración principal (5 pestañas)
│   ├── TokenConsultaPage.jsx  # Consulta de declaración por token
│   ├── ApiDocs.jsx         # Visualizador Swagger UI
│   ├── Footer.jsx          # Pie de página con aviso legal
│   ├── Pagination.jsx      # Componente reutilizable de paginación
│   │
│   ├── PreguntasFormularioAdminTab.jsx  # Tab admin: preguntas del formulario
│   ├── UsuariosAdminTab.jsx             # Tab admin: gestión de usuarios
│   ├── IdiomasAdminTab.jsx              # Tab admin: CRUD de idiomas y sus traducciones
│   ├── TraduccionesAdminTab.jsx         # Tab admin: edición de traducciones por idioma
│   │
│   └── api/                # Código generado automáticamente desde OpenAPI
│       ├── client.gen.ts
│       ├── core/
│       ├── index.ts
│       ├── sdk.gen.ts
│       └── types.gen.ts
```

---

## 4. Arquitectura y Flujo de Datos

La aplicación sigue una arquitectura de **SPA (Single Page Application)** con enrutamiento basado en hash (`#/ruta`).

```
main.jsx
  └── AuthProvider (AuthContext)
        └── LanguageProvider (LanguageContext)
              └── Router.jsx  ← lee window.location.hash
                    ├── App.jsx            (#/ o vacío)
                    ├── LoginPage          (#/login)
                    ├── ProfilePage        (#/perfil)
                    ├── AdminLoginPage     (#/admin sin rol admin)
                    ├── AdminPage          (#/admin con rol admin)
                    ├── TokenConsultaPage  (#/consulta)
                    └── ApiDocs            (#/api-docs, carga lazy)
```

### Flujo del Cuestionario Principal (App.jsx)

1. Al montar, se llama a `getPreguntas()` para cargar el catálogo de secciones y preguntas dinámicas.
2. El formulario muestra 6 secciones; las secciones 2–4 se renderizan con las preguntas cargadas dinámicamente.
3. Al pulsar **Enviar**, se llama a `createDeclaracion()` enviando todos los campos como `multipart/form-data`.
4. Si el usuario está autenticado, la declaración se vincula automáticamente a su cuenta.
5. Se muestra un panel de éxito con el **token de consulta** generado.

---

## 5. Modos de Funcionamiento

La aplicación conecta siempre con el backend PostgreSQL. El fichero `src/constants.js` define las URLs de la API:

```js
export const DEMO_MODE = false  // siempre conecta con la API real
```

| Variable | Valor | Descripción |
|---|---|---|
| `API_BASE_URL` | `/v1` (dev) | Base URL del backend |
| `API_DECLARACIONES_URL` | `/v1/irpf/declaraciones` | Endpoint de declaraciones |
| `API_PREGUNTAS_URL` | `/v1/irpf/preguntas` | Endpoint del catálogo |

---

## 6. Rutas de la Aplicación

La navegación es hash-based, gestionada por `Router.jsx`:

| Ruta | Componente | Acceso |
|---|---|---|
| `#/` (raíz) | `App.jsx` — Cuestionario IRPF | Público |
| `#/login` | `LoginPage.jsx` | Público |
| `#/perfil` | `ProfilePage.jsx` | Usuario autenticado |
| `#/admin` | `AdminPage.jsx` | Usuario con rol `admin` |
| `#/consulta` | `TokenConsultaPage.jsx` | Público |
| `#/api-docs` | `ApiDocs.jsx` | Público |

---

## 7. Componentes y Páginas

### 7.1 `App.jsx` — Cuestionario IRPF (formulario principal)

Es el componente más extenso de la aplicación. Gestiona:

- **Sección 1 — Datos de Identificación**: nombre, apellidos, DNI/NIE, email, teléfono.
- **Secciones 2–4 — Preguntas dinámicas**: cargadas desde la API. Cada pregunta es de tipo `si_no` y puede tener condición de visibilidad.
  - Sección 2: Situación de Vivienda (6 preguntas).
  - Sección 3: Cargas Familiares y Ayudas Públicas (5 preguntas).
  - Sección 4: Ingresos Extraordinarios e Inversiones (2 preguntas).
- **Sección 5 — Documentación Adjunta**: subida de ficheros (DNI anverso, DNI reverso, documentación adicional). Formatos admitidos: PDF, JPG, PNG. Máximo 5 MB por fichero.

**Características adicionales:**
- Indicador de progreso por pasos (Identificación → Vivienda → Familia → Ingresos → Documentación).
- Validación de campos antes del envío.
- Notificación toast con el resultado del envío.
- Panel de éxito con token de consulta.
- Soporte para **edición** de declaraciones existentes (cuando se llega desde el perfil).
- Selector de idioma en la cabecera.

---

### 7.2 `LoginPage.jsx` — Acceso de Usuario

Permite al contribuyente identificarse con su **DNI/NIE** y **contraseña** para acceder a su perfil. Incluye validación de formato de DNI/NIE con expresión regular.

---

### 7.3 `ProfilePage.jsx` — Perfil del Usuario

Muestra todas las declaraciones enviadas por el usuario autenticado. Para cada declaración:

- Muestra todos los campos agrupados por sección.
- Permite expandir/contraer los detalles.
- Ofrece opciones para **editar** o **descargar PDF** de la declaración.
- Muestra el estado del expediente con badges de color.
- Incluye formulario para **cambiar la contraseña**.

**Estados de expediente:**
| Estado | Color |
|---|---|
| `recibido` | Azul |
| `en_revision` | Amarillo |
| `documentacion_pendiente` | Naranja |
| `completado` | Verde |
| `archivado` | Gris |

---

### 7.4 `AdminLoginPage.jsx` — Login de Administrador

Pantalla de acceso para el panel de administración. Acepta un nombre de usuario y contraseña. Verifica que el rol sea `admin`. Credenciales por defecto: usuario `ADMIN`, contraseña `admin1234`.

---

### 7.5 `AdminPage.jsx` — Panel de Administración

Panel central para la gestión interna. Organizado en **cinco pestañas**:

#### Pestaña: Declaraciones
- Lista paginada de todas las declaraciones registradas.
- Filtros por estado, DNI/NIE y texto libre.
- Vista detallada expandible con todos los campos.
- Cambio de estado del expediente.
- Eliminación de declaraciones.
- Envío de email simulado al contribuyente.
- Descarga de PDF de cada declaración.
- Asignación de declaración a cuenta de usuario.

#### Pestaña: Preguntas (`PreguntasFormularioAdminTab`)
- Tabla completa de las preguntas que aparecen en el formulario del cuestionario.
- Edición del texto de cada pregunta (soporte multilingüe: `textos` JSONB).
- Muestra el campo técnico (`campo`) y el orden de cada pregunta.

#### Pestaña: Usuarios (`UsuariosAdminTab`)
- Lista de todos los usuarios registrados.
- Acciones: bloquear/desbloquear, reportar, eliminar, enviar email.
- Vista de declaraciones de cada usuario.

#### Pestaña: Idiomas (`IdiomasAdminTab`)
- CRUD completo de idiomas disponibles en la plataforma.
- Activación/desactivación de idiomas.
- Editor de traducciones por idioma (abre un panel lateral con todos los pares clave→valor).
- Al guardar cambios, recarga las traducciones en todos los clientes activos.

#### Pestaña: Traducciones (`TraduccionesAdminTab`)
- Vista unificada de todas las traducciones agrupadas por idioma.
- Muestra un resumen de claves faltantes respecto al idioma de referencia (`es`).
- Permite añadir nuevas claves de traducción o editar las existentes.
- Enlaza con el endpoint `/v1/admin/traducciones/faltantes` para detectar claves incompletas.

---

### 7.6 `TokenConsultaPage.jsx` — Consulta por Token

Permite consultar el estado de una declaración sin necesidad de autenticarse, usando el **token** generado al enviar el formulario. Muestra un historial de consultas almacenado en `localStorage` y permite descargar el PDF de la declaración.

---

### 7.7 `ApiDocs.jsx` — Documentación de la API

Integración de **Swagger UI** que renderiza la especificación OpenAPI desde `/openapi.yaml`. Cargado de forma lazy para no penalizar el tiempo de carga inicial.

---

### 7.8 `Footer.jsx` — Pie de Página

Componente que incluye el aviso legal y enlace a la Agencia Tributaria.

---

### 7.9 `Pagination.jsx` — Paginación

Componente reutilizable con botones de primera/anterior/siguiente/última página y puntos suspensivos para rangos largos.

---

## 8. Gestión de Estado y Contextos

### `AuthContext.jsx`

Provee el estado de autenticación a toda la aplicación:

| Valor / Función | Tipo | Descripción |
|---|---|---|
| `user` | `object \| null` | Usuario autenticado (`{ dniNie, role }`) |
| `intranetAccess` | `boolean` | Si se ha validado el código de intranet |
| `login(userData)` | función | Guarda el usuario en `localStorage` y en estado |
| `logout()` | función | Borra el usuario de `localStorage` |
| `grantIntranetAccess()` | función | Guarda el flag en `sessionStorage` |

**Persistencia:**
- `user` → `localStorage` (persiste entre recargas y sesiones del navegador).
- `intranetAccess` → `sessionStorage` (se limpia al cerrar la pestaña).

---

### `LanguageContext.jsx`

Provee soporte multilingüe con carga dinámica desde la base de datos:

| Valor / Función | Tipo | Descripción |
|---|---|---|
| `lang` | `string` | Idioma activo (`'es'`, `'fr'`, `'en'`, `'ca'`) |
| `setLang(code)` | función | Cambia el idioma activo |
| `t(key)` | función | Devuelve el texto traducido para la clave dada |
| `reloadTranslations()` | función | Recarga las traducciones desde el backend |
| `availableLanguages` | `array` | Lista de idiomas disponibles `{ code, label }` |

**Cadena de resolución de `t(key)`:**
1. Traducciones cargadas desde la DB para el idioma activo.
2. Fallback al JSON estático de `translations/{lang}.json`.
3. Fallback al JSON estático español (`translations/es.json`).
4. Si nada coincide, devuelve la propia `key`.

**Archivos de traducción estática (respaldo):** `translations/es.json`, `translations/ca.json`, `translations/en.json`, `translations/fr.json` — cada fichero contiene 100 claves.

---

## 9. API REST

La especificación completa se encuentra en `openapi/openapi.yaml`. El cliente TypeScript se genera ejecutando:

```bash
npm run generate
```

Esto genera los ficheros en `src/api/` usando `@hey-api/openapi-ts`.

### Endpoints Principales

#### `GET /irpf/preguntas`
Devuelve el catálogo de secciones y preguntas dinámicas del cuestionario.

**Respuesta exitosa (200):**
```json
{
  "secciones": [
    {
      "id": "vivienda",
      "numero": 2,
      "titulo": "Situación de Vivienda",
      "preguntas": [
        {
          "id": "viviendaAlquiler",
          "texto": "¿Vive actualmente en régimen de alquiler?"
        }
      ]
    }
  ]
}
```

#### `POST /irpf/declaraciones`
Envía un cuestionario completo. Formato: `multipart/form-data`.

Campos principales: `nombre`, `apellidos`, `dniNie`, `email`, `telefono`, respuestas dinámicas (`si`/`no`), ficheros adjuntos.

**Respuesta exitosa (201):**
```json
{ "id": "uuid", "estado": "recibido", "creadoEn": "2025-01-01T00:00:00Z" }
```

#### `GET /irpf/declaraciones`
Lista paginada de declaraciones. Parámetros: `page`, `limit`, `estado`, `dniNie`.

#### `GET /irpf/declaraciones/{id}`
Detalle completo de una declaración.

#### `PATCH /irpf/declaraciones/{id}`
Actualiza el estado de una declaración.

#### Endpoints de Idiomas y Traducciones (públicos)

##### `GET /irpf/idiomas`
Devuelve la lista de idiomas activos disponibles en la plataforma.

**Respuesta exitosa (200):**
```json
[
  { "code": "es", "label": "Español" },
  { "code": "ca", "label": "Català" },
  { "code": "en", "label": "English" },
  { "code": "fr", "label": "Français" }
]
```

##### `GET /irpf/traducciones`
Devuelve todas las traducciones agrupadas por código de idioma.

**Respuesta exitosa (200):**
```json
{
  "es": { "btnContinue": "Continuar", "btnSubmit": "📤 Enviar cuestionario", "yes": "Sí", "no": "No" },
  "en": { "btnContinue": "Continue", "btnSubmit": "Send declaration", "yes": "Yes", "no": "No" }
}
```

#### Endpoints de Administración de Traducciones

- `GET /admin/traducciones/faltantes` — Devuelve las claves requeridas y un resumen de las que faltan por idioma.
- `GET /admin/idiomas` — Lista paginada de idiomas (admin).
- `POST /admin/idiomas` — Crea un nuevo idioma.
- `PUT /admin/idiomas/{id}` — Actualiza un idioma.
- `DELETE /admin/idiomas/{id}` — Elimina un idioma.
- `GET /admin/idiomas/{id}/content` — Obtiene las traducciones de un idioma.
- `PUT /admin/idiomas/{id}/content` — Actualiza las traducciones de un idioma.

#### Endpoints de Administración
- `GET/POST /admin/preguntas` — Gestión de preguntas adicionales.
- `GET/PUT/DELETE /admin/preguntas/{id}` — CRUD individual de preguntas.
- `GET/POST /admin/secciones` — Gestión de secciones.
- `GET/PUT/DELETE /admin/secciones/{id}` — CRUD individual de secciones.

### Servidores

| Entorno | URL |
|---|---|
| Producción | `https://api.renta-form.example/v1` |
| Desarrollo local | `http://localhost:3001/v1` |

---

## 10. Internacionalización (i18n)

La aplicación implementa un sistema de traducción **híbrido**: las traducciones se cargan dinámicamente desde la base de datos y se complementan con ficheros JSON estáticos de respaldo.

### Arquitectura

```
LanguageContext.jsx
  ├── Carga dinámica: GET /v1/irpf/idiomas + GET /v1/irpf/traducciones
  └── Fallback estático: translations/{es,ca,en,fr}.json
```

Al iniciar la aplicación, `LanguageContext` realiza dos llamadas en paralelo al backend para obtener:
1. Los **idiomas disponibles** (`/v1/irpf/idiomas`).
2. Todas las **traducciones** agrupadas por idioma (`/v1/irpf/traducciones`).

Si la API falla o no devuelve datos, se usan automáticamente los ficheros JSON estáticos de `translations/`.

### Idiomas soportados

| Código | Idioma |
|---|---|
| `es` | Español (por defecto) |
| `fr` | Francés |
| `en` | Inglés |
| `ca` | Catalán |

El administrador puede añadir o desactivar idiomas desde el panel de administración (pestaña **Idiomas**).

### Claves de traducción

Existen **100 claves** de traducción que cubren todos los textos de la interfaz. Entre las más importantes:

| Clave | Ejemplo (es) |
|---|---|
| `btnContinue` | `Continuar` |
| `btnSubmit` | `📤 Enviar cuestionario` |
| `btnBack` | `Volver` |
| `yes` / `no` | `Sí` / `No` |
| `fieldNombre` | `Nombre` |
| `fieldDniNie` | `Número de DNI / NIE` |
| `successTitle` | `¡Cuestionario enviado correctamente!` |
| `estadoRecibido` … `estadoArchivado` | Estados del expediente |

### Función `t(key)` y utilidades

El hook `useLanguage()` expone la función `t(key)`, que resuelve la traducción siguiendo la cadena descrita en la sección anterior.

El módulo `src/i18nUtils.js` proporciona la función `translateYN(value, t)`, que convierte los valores `'si'`/`'no'` usando `t('yes')` y `t('no')`.

### Gestión de traducciones por el administrador

Desde el panel de administración (**Idiomas** y **Traducciones**) es posible:
- Crear nuevos idiomas con su lista completa de traducciones.
- Editar las traducciones de cualquier idioma clave a clave.
- Detectar claves faltantes respecto al idioma de referencia (`es`) mediante el endpoint `/v1/admin/traducciones/faltantes`.
- Los cambios se aplican en tiempo real: al guardar se llama a `reloadTranslations()`, que actualiza el contexto de idioma en todos los componentes activos.

---

## 11. Generación de PDFs

El módulo `src/pdfUtils.js` utiliza **jsPDF** para generar un PDF A4 del expediente fiscal de un contribuyente.

**Estructura del PDF generado:**
1. Encabezado con logo de NH Gestión Integral y fecha/hora de generación.
2. Estado del expediente con badges.
3. Secciones de datos (Identificación, Vivienda, Familia, Ingresos, Info Adicional) con sus valores.
4. Pie de página con número de página.

El PDF se descarga automáticamente con el nombre `declaracion-{dniNie}-{fecha}.pdf`.

---

## 12. Seguridad y Autenticación

La aplicación implementa tres capas de acceso:

### Capa 1: Código de Intranet
- Requerido antes de acceder a cualquier ruta.
- Se valida contra el backend (endpoint `/v1/auth/verificar-codigo`).
- Se almacena en `sessionStorage` (expira al cerrar la pestaña).

### Capa 2: Autenticación de Usuario
- DNI/NIE + contraseña para acceder al perfil personal.
- El objeto usuario se persiste en `localStorage`.
- Contraseñas hasheadas con SHA-256 cuando se cambian.
- Validación de formato DNI/NIE con regex: `/^[0-9XYZ][0-9]{7}[A-Z]$/`.

### Capa 3: Rol de Administrador
- El panel `/admin` solo es accesible para usuarios con `role === 'admin'`.
- El login de admin usa el mismo mecanismo pero verifica el rol.

---

## 13. Usuarios de Prueba

El usuario admin se crea automáticamente con `database/init.sql`.

---

## 14. Scripts de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:5173)
npm run dev

# Ejecutar los tests E2E con Cucumber + Playwright
npm test

# Generar cliente TypeScript desde OpenAPI
npm run generate

# Construir para producción
npm run build

# Previsualizar la build de producción
npm run preview

# Servir la carpeta dist en producción
npm start

# Ejecutar el linter
npm run lint
```

### Requisitos del Sistema

- **Node.js** ≥ 20.0.0
- **npm** (incluido con Node.js)

### Tests E2E — Cucumber + Playwright

Los tests E2E están organizados en tres ficheros de funcionalidades:

| Feature | Descripción |
|---|---|
| `features/form.feature` | Flujo completo del formulario, validaciones, envío y pantallas de login/consulta |
| `features/idiomas.feature` | Selector de idioma, cambio de idioma, traducciones aplicadas, API de idiomas, pestaña de admin |
| `features/preguntas.feature` | Preguntas condicionales, barra de progreso, validación, edición de preguntas desde admin |

**Requisitos previos para ejecutar los tests:**

```bash
# Terminal 1 – Backend
cd backend && npm install && npm start

# Terminal 2 – Frontend (con proxy /v1 → localhost:3001)
npm run dev

# Terminal 3 – Tests
npm test
```

Los screenshots se guardan en `screenshots/` con nombres descriptivos.

---

*Documento generado automáticamente — Renta Form · Campaña de la Renta 2025 · NH Gestión Integral*
