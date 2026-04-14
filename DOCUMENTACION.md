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
10. [Mock API y Datos de Demo](#10-mock-api-y-datos-de-demo)
11. [Internacionalización (i18n)](#11-internacionalización-i18n)
12. [Generación de PDFs](#12-generación-de-pdfs)
13. [Seguridad y Autenticación](#13-seguridad-y-autenticación)
14. [Usuarios de Prueba](#14-usuarios-de-prueba)
15. [Scripts de Desarrollo](#15-scripts-de-desarrollo)

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
├── database/               # (Reservado para datos persistidos)
├── src/
│   ├── main.jsx            # Punto de entrada React
│   ├── App.jsx             # Formulario principal (cuestionario IRPF)
│   ├── Router.jsx          # Enrutador hash-based
│   ├── App.css / index.css # Estilos globales
│   ├── constants.js        # Constantes (DEMO_MODE, URLs de API)
│   ├── i18n.js             # Traducciones (es, fr, en, ca)
│   ├── demoData.js         # Datos en memoria para el modo demo
│   ├── mockApi.js          # Implementación mock de la API
│   ├── pdfUtils.js         # Utilidades para generar PDFs con jsPDF
│   │
│   ├── AuthContext.jsx     # Contexto de autenticación
│   ├── LanguageContext.jsx # Contexto de idioma
│   │
│   ├── LoginPage.jsx       # Página de login de usuario
│   ├── ProfilePage.jsx     # Perfil de usuario y sus declaraciones
│   ├── AdminLoginPage.jsx  # Login del panel de administración
│   ├── AdminPage.jsx       # Panel de administración principal
│   ├── IntranetLoginPage.jsx  # Puerta de entrada a la intranet
│   ├── TokenConsultaPage.jsx  # Consulta de declaración por token
│   ├── ApiDocs.jsx         # Visualizador Swagger UI
│   ├── Footer.jsx          # Pie de página con "Cómo funciona" y contacto
│   ├── Pagination.jsx      # Componente reutilizable de paginación
│   │
│   ├── PreguntasAdminTab.jsx      # Tab admin: gestión de preguntas
│   ├── SeccionesAdminTab.jsx      # Tab admin: gestión de secciones
│   ├── UsuariosAdminTab.jsx       # Tab admin: gestión de usuarios
│   ├── DeclaracionPreguntasPanel.jsx # Panel de preguntas adicionales por declaración
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
                    ├── IntranetLoginPage  (si !intranetAccess)
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

El fichero `src/constants.js` controla el modo activo:

```js
export const DEMO_MODE = true  // false → conecta con la API real
```

| Modo | Comportamiento |
|---|---|
| `DEMO_MODE = true` | Todos los datos se sirven desde memoria (mockApi.js + demoData.js). No requiere backend. |
| `DEMO_MODE = false` | Las llamadas van a `https://api.renta-form.example/v1` usando el cliente generado desde OpenAPI. |

En modo demo, al recargar la página los datos de declaraciones enviadas **se persisten en `localStorage`** para simular persistencia básica.

---

## 6. Rutas de la Aplicación

La navegación es hash-based, gestionada por `Router.jsx`:

| Ruta | Componente | Acceso |
|---|---|---|
| `#/` (raíz) | `App.jsx` — Cuestionario IRPF | Requiere código de intranet |
| `#/login` | `LoginPage.jsx` | Requiere código de intranet |
| `#/perfil` | `ProfilePage.jsx` | Usuario autenticado |
| `#/admin` | `AdminPage.jsx` | Usuario con rol `admin` |
| `#/consulta` | `TokenConsultaPage.jsx` | Requiere código de intranet |
| `#/api-docs` | `ApiDocs.jsx` | Requiere código de intranet |

> **Nota:** Todas las rutas están protegidas por la pantalla `IntranetLoginPage`, que se muestra si el usuario no ha introducido el código de intranet en la sesión actual.

---

## 7. Componentes y Páginas

### 7.1 `IntranetLoginPage.jsx` — Puerta de la Intranet

Primera pantalla que ve cualquier visitante. Solicita un **código de acceso** de un solo uso para la sesión. En modo demo, el código es `intranet2025`. Al validarse, se guarda en `sessionStorage` y se concede acceso vía `AuthContext.grantIntranetAccess()`.

---

### 7.2 `App.jsx` — Cuestionario IRPF (formulario principal)

Es el componente más extenso de la aplicación. Gestiona:

- **Sección 1 — Datos de Identificación**: nombre, apellidos, DNI/NIE, email, teléfono.
- **Secciones 2–4 — Preguntas dinámicas**: cargadas desde la API. Cada pregunta es de tipo `si_no` y puede tener condición de visibilidad.
  - Sección 2: Situación de Vivienda (6 preguntas).
  - Sección 3: Cargas Familiares y Ayudas Públicas (5 preguntas).
  - Sección 4: Ingresos Extraordinarios e Inversiones (2 preguntas).
- **Sección 5 — Documentación Adjunta**: subida de ficheros (DNI anverso, DNI reverso, documentación adicional). Formatos admitidos: PDF, JPG, PNG. Máximo 5 MB por fichero.
- **Sección 6 — Información Adicional**: campo de comentarios libres.

**Características adicionales:**
- Indicador de progreso por pasos (Identificación → Vivienda → Familia → Ingresos → Documentación).
- Validación de campos antes del envío.
- Notificación toast con el resultado del envío.
- Panel de éxito con token de consulta.
- Soporte para **edición** de declaraciones existentes (cuando se llega desde el perfil).
- Selector de idioma en la cabecera.

---

### 7.3 `LoginPage.jsx` — Acceso de Usuario

Permite al contribuyente identificarse con su **DNI/NIE** y **contraseña** para acceder a su perfil. Incluye validación de formato de DNI/NIE con expresión regular.

---

### 7.4 `ProfilePage.jsx` — Perfil del Usuario

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

### 7.5 `AdminLoginPage.jsx` — Login de Administrador

Pantalla de acceso para el panel de administración. Acepta un nombre de usuario y contraseña. Verifica que el rol sea `admin`. En modo demo: usuario `admin`, contraseña `admin`.

---

### 7.6 `AdminPage.jsx` — Panel de Administración

Panel central para la gestión interna. Organizado en **cuatro pestañas**:

#### Pestaña: Declaraciones
- Lista paginada de todas las declaraciones registradas.
- Filtros por estado, DNI/NIE y texto libre.
- Vista detallada expandible con todos los campos.
- Cambio de estado del expediente.
- Eliminación de declaraciones.
- Envío de email simulado al contribuyente.
- Descarga de PDF de cada declaración.
- Panel de preguntas adicionales por declaración (`DeclaracionPreguntasPanel`).
- Asignación de declaración a cuenta de usuario.

#### Pestaña: Preguntas (`PreguntasAdminTab`)
- CRUD completo de preguntas adicionales personalizadas.
- Tipos de respuesta soportados: Sí/No, texto libre, número, fecha, importe, porcentaje, texto largo.
- Asociación de preguntas a secciones.
- Activación/desactivación de preguntas.

#### Pestaña: Secciones (`SeccionesAdminTab`)
- CRUD completo de secciones del cuestionario.
- Vista del número de declaraciones y preguntas por sección.
- Ordenación y activación de secciones.

#### Pestaña: Usuarios (`UsuariosAdminTab`)
- Lista de todos los usuarios registrados.
- Acciones: bloquear/desbloquear, reportar, eliminar, enviar email.
- Asignación de preguntas y secciones personalizadas por usuario.
- Vista de declaraciones de cada usuario.

---

### 7.7 `TokenConsultaPage.jsx` — Consulta por Token

Permite consultar el estado de una declaración sin necesidad de autenticarse, usando el **token** generado al enviar el formulario. Muestra un historial de consultas almacenado en `localStorage` y permite descargar el PDF de la declaración.

---

### 7.8 `ApiDocs.jsx` — Documentación de la API

Integración de **Swagger UI** que renderiza la especificación OpenAPI desde `/openapi.yaml`. Cargado de forma lazy para no penalizar el tiempo de carga inicial.

---

### 7.9 `Footer.jsx` — Pie de Página

Componente avanzado que incluye:

- Sección desplegable **"Cómo funciona"** con 5 pasos explicativos.
- Formulario de **contacto** con validación (nombre, email, asunto, mensaje). Simulado en modo demo.
- Enlace a la documentación de la API (si `showApiDocs = true`).
- Aviso legal y enlace a la Agencia Tributaria.

---

### 7.10 `Pagination.jsx` — Paginación

Componente reutilizable con botones de primera/anterior/siguiente/última página y puntos suspensivos para rangos largos.

---

### 7.11 `DeclaracionPreguntasPanel.jsx` — Preguntas Adicionales por Declaración

Panel dentro del admin que permite asignar preguntas adicionales específicas a una declaración concreta y registrar sus respuestas.

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

Provee soporte multilingüe:

| Valor / Función | Tipo | Descripción |
|---|---|---|
| `lang` | `string` | Idioma activo (`'es'`, `'fr'`, `'en'`, `'ca'`) |
| `setLang(code)` | función | Cambia el idioma activo |
| `t(key)` | función | Devuelve el texto traducido para la clave dada |

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

Campos principales: `nombre`, `apellidos`, `dniNie`, `email`, `telefono`, respuestas dinámicas (`si`/`no`), `comentarios`, ficheros adjuntos.

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

## 10. Mock API y Datos de Demo

### `demoData.js` — Almacenes en Memoria

Contiene los datos iniciales usados en modo demo:

| Store | Descripción |
|---|---|
| `CATALOGO_PREGUNTAS` | Catálogo completo con preguntas en 4 idiomas |
| `declaracionesStore` | Array de declaraciones de los 4 usuarios de prueba |
| `passwordsStore` | Contraseñas (en texto plano inicialmente, con soporte de hash SHA-256) |
| `rolesStore` | Rol de cada usuario (`user` o `admin`) |
| `usersStore` | Datos completos de los usuarios |
| `preguntasAdicionalesStore` | Preguntas adicionales creadas por el admin |
| `seccionesStore` | Secciones creadas por el admin |
| `codigosAccesoStore` | Códigos de acceso a la intranet |

**Persistencia de datos demo:** Las declaraciones enviadas se guardan en `localStorage` para sobrevivir recargas de página durante la demo.

### `mockApi.js` — Funciones Mock

Implementa todas las funciones de la API con retardos simulados (~300 ms) para emular latencia de red. Las funciones siguen exactamente la misma firma que el cliente generado desde OpenAPI.

**Funciones disponibles:**
- `getPreguntas()`, `createDeclaracion()`, `listDeclaraciones()`, `getDeclaracion()`, `updateDeclaracion()`, `deleteDeclaracion()`
- `loginUser()`, `changePassword()`
- `listDeclaracionesAll()`, `updateEstadoDeclaracion()`, `sendEmailDeclaracion()`, `assignUserAccount()`
- `listPreguntasAdmin()`, `createPreguntaAdmin()`, `updatePreguntaAdmin()`, `deletePreguntaAdmin()`
- `listSeccionesAdmin()`, `createSeccionAdmin()`, `updateSeccionAdmin()`, `deleteSeccionAdmin()`
- `listUsersAdmin()`, `blockUser()`, `reportUser()`, `deleteUser()`, `sendEmailToUser()`
- `getDeclaracionByToken()`, `verificarCodigoAcceso()`
- `getDeclaracionPreguntas()`, `upsertDeclaracionPreguntas()`, `removeDeclaracionPregunta()`
- `setUserPreguntas()`, `setUserSecciones()`, `getUserByDniNie()`

**Seguridad de contraseñas en demo:** Las contraseñas se hashean con **SHA-256** usando la Web Crypto API cuando el usuario las cambia. El login soporta tanto comparación directa (contraseñas iniciales) como verificación de hash.

---

## 11. Internacionalización (i18n)

El fichero `src/i18n.js` contiene todas las cadenas de texto de la interfaz organizadas por idioma:

| Código | Idioma |
|---|---|
| `es` | Español (por defecto) |
| `fr` | Francés |
| `en` | Inglés |
| `ca` | Catalán |

Las preguntas del cuestionario también tienen traducción completa (campo `textos` en `demoData.js`), lo que permite que el formulario se muestre íntegramente en el idioma seleccionado por el usuario. El idioma se puede cambiar en cualquier momento desde el selector en la cabecera.

---

## 12. Generación de PDFs

El módulo `src/pdfUtils.js` utiliza **jsPDF** para generar un PDF A4 del expediente fiscal de un contribuyente.

**Estructura del PDF generado:**
1. Encabezado con logo de NH Gestión Integral y fecha/hora de generación.
2. Estado del expediente con badges.
3. Secciones de datos (Identificación, Vivienda, Familia, Ingresos, Info Adicional) con sus valores.
4. Pie de página con número de página.

El PDF se descarga automáticamente con el nombre `declaracion-{dniNie}-{fecha}.pdf`.

---

## 13. Seguridad y Autenticación

La aplicación implementa tres capas de acceso:

### Capa 1: Código de Intranet
- Requerido antes de acceder a cualquier ruta.
- Se valida contra el store `codigosAccesoStore`.
- Se almacena en `sessionStorage` (expira al cerrar la pestaña).
- Código demo: `intranet2025`.

### Capa 2: Autenticación de Usuario
- DNI/NIE + contraseña para acceder al perfil personal.
- El objeto usuario se persiste en `localStorage`.
- Contraseñas hasheadas con SHA-256 cuando se cambian.
- Validación de formato DNI/NIE con regex: `/^[0-9XYZ][0-9]{7}[A-Z]$/`.

### Capa 3: Rol de Administrador
- El panel `/admin` solo es accesible para usuarios con `role === 'admin'`.
- El login de admin usa el mismo mecanismo pero verifica el rol.

---

## 14. Usuarios de Prueba

### Usuarios Contribuyentes (acceso al perfil)

| DNI/NIE | Nombre | Contraseña |
|---|---|---|
| `12345678A` | María García López | `renta2025` |
| `87654321B` | Carlos Martínez Ruiz | `renta2025` |
| `11223344C` | Ana López Sánchez | `renta2025` |
| `44332211D` | Pedro Fernández González | `renta2025` |

### Administrador (acceso al panel `/admin`)

| Usuario | Contraseña |
|---|---|
| `admin` | `admin` |

### Código de Intranet

| Código |
|---|
| `intranet2025` |

---

## 15. Scripts de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:5173)
npm run dev

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

---

*Documento generado automáticamente — Renta Form · Campaña de la Renta 2025 · NH Gestión Integral*
