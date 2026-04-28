# Renta Form – Backend

Node.js/Express REST API que da soporte al formulario Renta Form. Usa **PostgreSQL** como base de datos.

## Puesta en marcha rápida

### 1. Crear la base de datos PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE renta_form;"
```

### 2. Configurar la conexión

Copia `.env.example` a `.env` y ajusta las credenciales:

```bash
cp .env.example .env
```

Variables más importantes:

```env
PROFILE=db
PORT=3001

# Opción A – URL completa (recomendado para Neon / Heroku / Render)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/renta_form

# Opción B – variables individuales (solo si no usas DATABASE_URL)
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=renta_form
# PGUSER=postgres
# PGPASSWORD=postgres

CORS_ORIGIN=http://localhost:5173

# Clave de firma de tokens (HMAC-SHA256). Generar con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=cambia-esto-en-produccion

# Clave AES-256 para cifrar DNI/NIE (64 hex chars). Generar con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# DNI_ENCRYPTION_KEY=

# Envío de correo (opcional). Si no están definidas, el envío de correo se
# omite con un log informativo y la API sigue funcionando con normalidad.
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=tu-usuario
# SMTP_PASS=tu-contraseña
# MAIL_FROM="Renta Form <noreply@example.com>"
```

> Cuando una declaración se guarda correctamente (`POST /v1/irpf/declaraciones`), se notifica por correo a todos los usuarios con `role = 'admin'` cuyo `email` esté informado en la tabla `usuarios`. El envío es asíncrono (no bloquea la respuesta) y, si el SMTP no está configurado, se omite silenciosamente.

### 3. Inicializar la base de datos

```bash
cd backend

# Crea las tablas (database/init.sql)
npm run migrate

# Solo sembrar traducciones (idempotente)
npm run seed

# Solo sembrar preguntas (idempotente)
npm run db:seed-questions

# Solo sembrar usuarios (incluye un admin)
npm run db:seed-users

# Migración + seed en un comando
npm run db:setup
```

> `npm run migrate` aplica `database/init.sql` si las tablas no existen. Los scripts `npm run db:seed-*` también ejecutan la migración antes de sembrar, por lo que pueden usarse de forma autónoma sobre una BD vacía.

### 4. Arrancar el servidor

```bash
npm start
```

El servidor escucha en `http://localhost:3001`.

---

## URL base de la API

Todos los endpoints de la API están prefijados con `/v1`. Los endpoints marcados con 🔒 requieren un token de administrador en la cabecera `Authorization: Bearer <token>`.

### Salud del servidor

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check – devuelve `{ status: "ok", time: "…" }` |

### Autenticación (`/v1/auth`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/v1/auth/admin-login` | Login del administrador (`username` + `password`) → devuelve token |
| POST | `/v1/auth/change-password` | Cambiar contraseña (`username`, `oldPassword`, `newPassword`) |
| POST | `/v1/auth/change-email` | Cambiar email del administrador (`username`, `newEmail`) |

### Formulario IRPF (`/v1/irpf`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/v1/irpf/preguntas` | – | Catálogo de preguntas (acepta `?lang=es|fr|ca|en`) |
| GET | `/v1/irpf/idiomas` | – | Idiomas activos de la aplicación |
| GET | `/v1/irpf/traducciones` | – | Todas las traducciones agrupadas por idioma |
| GET | `/v1/irpf/declaraciones` | – | Listar declaraciones propias (paginado, `?dniNie&estado&page&limit`) |
| POST | `/v1/irpf/declaraciones` | – | Enviar nueva declaración |
| GET | `/v1/irpf/declaraciones/all` | 🔒 | Listar todas las declaraciones (admin, `?dniNie&estado&page&limit`) |
| GET | `/v1/irpf/declaraciones/:id` | – | Detalle de una declaración |
| PATCH | `/v1/irpf/declaraciones/:id` | 🔒 | Actualizar estado de la declaración |
| PUT | `/v1/irpf/declaraciones/:id` | – | Actualizar campos editables de la declaración |
| DELETE | `/v1/irpf/declaraciones/bulk` | 🔒 | Borrado masivo de declaraciones (body: `{ ids: [...] }`) |
| DELETE | `/v1/irpf/declaraciones/:id` | 🔒 | Eliminar declaración |
| POST | `/v1/irpf/declaraciones/:id/email` | 🔒 | Enviar email de la declaración |
| GET | `/v1/irpf/consulta/:token` | – | Consulta pública por token de seguimiento |

### Endpoint público (`/v1/public`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/v1/public/declaraciones` | Crear declaración – alias sin autenticación (para clientes sin sesión) |

### Panel de administración (`/v1/admin`) 🔒

Todos los endpoints de `/v1/admin` requieren token de administrador.

**Preguntas del formulario**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/preguntas-formulario` | Listar preguntas (`?page&limit`) |
| POST | `/v1/admin/preguntas-formulario` | Crear pregunta |
| PUT | `/v1/admin/preguntas-formulario/:id` | Actualizar pregunta |
| DELETE | `/v1/admin/preguntas-formulario/:id` | Eliminar pregunta |

**Usuarios**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/users` | Listar usuarios (`?bloqueado&denunciado&search&page&limit`) |
| POST | `/v1/admin/users/assign` | Asignar cuenta de usuario |
| GET | `/v1/admin/users/:dniNie` | Obtener usuario |
| PATCH | `/v1/admin/users/:dniNie/block` | Bloquear / desbloquear usuario |
| PATCH | `/v1/admin/users/:dniNie/report` | Denunciar / retirar denuncia |
| DELETE | `/v1/admin/users/:dniNie` | Eliminar usuario |
| GET | `/v1/admin/users/:dniNie/roles` | Obtener roles del usuario |
| PUT | `/v1/admin/users/:dniNie/roles` | Asignar roles al usuario |
| POST | `/v1/admin/users/:dniNie/email` | Enviar email al usuario |

**Roles**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/roles` | Listar roles del catálogo |
| POST | `/v1/admin/roles` | Crear rol |
| PUT | `/v1/admin/roles/:id` | Actualizar rol |
| DELETE | `/v1/admin/roles/:id` | Eliminar rol |

**Idiomas y traducciones**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/idiomas` | Listar idiomas (`?activo&page&limit`) |
| POST | `/v1/admin/idiomas` | Crear idioma |
| PUT | `/v1/admin/idiomas/:idiomaId` | Actualizar idioma |
| DELETE | `/v1/admin/idiomas/:idiomaId` | Eliminar idioma |
| GET | `/v1/admin/idiomas/:idiomaId/content` | Obtener traducciones del idioma |
| PUT | `/v1/admin/idiomas/:idiomaId/content` | Actualizar traducciones del idioma |
| GET | `/v1/admin/traducciones/faltantes` | Claves de traducción faltantes (`?ref=static\|db`) |

**Declaraciones – importación masiva**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/declaraciones/import/template` | Descargar plantilla CSV |
| POST | `/v1/admin/declaraciones/import` | Importar declaraciones desde CSV (body: `{ csv: "…" }`) |

**Configuración**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/configuracion` | Obtener pares clave/valor de configuración |
| PUT | `/v1/admin/configuracion/:clave` | Actualizar un valor de configuración |

---

## Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm start` | Arranca el servidor con PostgreSQL (puerto 3001) |
| `npm run dev` | Arranca con `--watch` (reinicio automático al cambiar ficheros) |
| `npm run migrate` | Aplica el esquema (`database/init.sql`). No arranca el servidor. |
| `npm run seed` | Siembra/actualiza traducciones en la BD. No arranca el servidor. |
| `npm run db:drop` | Borra todas las tablas, tipos y funciones (`database/drop.sql`). ⚠️ Destructivo. |
| `npm run db:reset` | `db:drop` + `migrate` + `seed-translations` + `seed-questions` + `seed-users`. ⚠️ Destructivo. |
| `npm run db:setup` | `migrate` + `seed-translations` + `seed-questions` |
| `npm run db:setup-all` | `migrate` + `seed-translations` + `seed-questions` + `seed-users` |
| `npm run db:setup-100` | `migrate` + `seed-translations` + `seed-questions` + 100 usuarios + 100 declaraciones |
| `npm run db:seed-translations` | Siembra/actualiza idiomas y traducciones |
| `npm run db:seed-languages` | Siembra/actualiza solo la tabla `idiomas` |
| `npm run db:seed-questions` | Siembra/actualiza las preguntas del formulario |
| `npm run db:seed-users` | Siembra usuarios de prueba (incluye un admin) |
| `npm run seed:admin` | Inserta/actualiza solo el usuario administrador |

---

## Proxy de desarrollo

El frontend de Vite redirige `/v1` → `http://localhost:3001/v1`. Para desarrollar en local arranca ambos servidores:

```bash
# Terminal 1 – backend (PostgreSQL)
cd backend && npm start

# Terminal 2 – frontend
cd .. && npm run dev
```

---

## Internacionalización (i18n)

Los idiomas y traducciones se almacenan en las tablas `idiomas` y `traducciones` de la BD.

| Endpoint público | Descripción |
|---|---|
| `GET /v1/irpf/idiomas` | Devuelve los idiomas activos (`[{ code, label }]`) |
| `GET /v1/irpf/traducciones` | Devuelve todas las traducciones agrupadas por código de idioma |

El `LanguageContext` del frontend consume ambos endpoints al arrancar. Si la BD no tiene datos, hace fallback a los ficheros JSON estáticos en `translations/`.

Usa `GET /v1/admin/traducciones/faltantes` para auditar qué claves de traducción faltan en cada idioma respecto al idioma de referencia (`es`).
