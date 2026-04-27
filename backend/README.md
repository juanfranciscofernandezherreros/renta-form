# Renta Form – Backend

Node.js/Express REST API que da soporte al formulario Renta Form. Usa **PostgreSQL** como base de datos.

## Puesta en marcha rápida

### 1. Crear la base de datos PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE renta_form;"
```

### 2. Configurar la conexión

Copia `.env.example` a `.env` y ajusta las credenciales:

```env
PROFILE=db
PORT=3001

# Opción A – URL completa (recomendado para Neon / Heroku)
DATABASE_URL=postgresql://<usuario>:<contraseña>@<host>/<bbdd>?sslmode=require

# Opción B – variables individuales
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=renta_form
# PGUSER=postgres
# PGPASSWORD=postgres

CORS_ORIGIN=http://localhost:5173

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

Todos los endpoints están prefijados con `/v1`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/auth/login` | Login (dniNie + password) |
| POST | `/v1/auth/verificar-codigo` | Verificar código de acceso a intranet |
| POST | `/v1/auth/change-password` | Cambiar contraseña de usuario |
| GET | `/v1/irpf/preguntas` | Catálogo de preguntas del formulario |
| GET | `/v1/irpf/idiomas` | Listar idiomas activos |
| GET | `/v1/irpf/traducciones` | Todas las traducciones agrupadas por código de idioma |
| GET | `/v1/irpf/declaraciones` | Listar declaraciones (paginado) |
| POST | `/v1/irpf/declaraciones` | Enviar nueva declaración (multipart) |
| GET | `/v1/irpf/declaraciones/all` | Listar todas las declaraciones (admin) |
| GET | `/v1/irpf/declaraciones/:id` | Detalle de una declaración |
| PATCH | `/v1/irpf/declaraciones/:id` | Actualizar estado |
| PUT | `/v1/irpf/declaraciones/:id` | Actualizar campos editables |
| DELETE | `/v1/irpf/declaraciones/:id` | Eliminar declaración |
| GET | `/v1/irpf/declaraciones/:id/preguntas` | Preguntas asignadas a la declaración |
| PUT | `/v1/irpf/declaraciones/:id/preguntas` | Upsert de asignaciones de preguntas |
| DELETE | `/v1/irpf/declaraciones/:id/preguntas/:preguntaId` | Eliminar asignación |
| POST | `/v1/irpf/declaraciones/:id/email` | Enviar email de la declaración |
| GET | `/v1/irpf/consulta/:token` | Consulta pública por token |
| GET | `/v1/admin/preguntas` | Listar preguntas adicionales |
| POST | `/v1/admin/preguntas` | Crear pregunta |
| GET | `/v1/admin/preguntas/:id` | Obtener pregunta |
| PUT | `/v1/admin/preguntas/:id` | Actualizar pregunta |
| DELETE | `/v1/admin/preguntas/:id` | Eliminar pregunta |
| GET | `/v1/admin/secciones` | Listar secciones |
| POST | `/v1/admin/secciones` | Crear sección |
| PUT | `/v1/admin/secciones/:id` | Actualizar sección |
| DELETE | `/v1/admin/secciones/:id` | Eliminar sección |
| GET | `/v1/admin/secciones/:id/declaraciones` | Declaraciones de la sección |
| GET | `/v1/admin/secciones/:id/preguntas` | Preguntas de la sección |
| GET | `/v1/admin/users` | Listar usuarios |
| POST | `/v1/admin/users/assign` | Asignar cuenta de usuario |
| GET | `/v1/admin/users/:dniNie` | Obtener usuario |
| PATCH | `/v1/admin/users/:dniNie/block` | Bloquear/desbloquear usuario |
| PATCH | `/v1/admin/users/:dniNie/report` | Denunciar/retirar denuncia |
| DELETE | `/v1/admin/users/:dniNie` | Eliminar usuario |
| POST | `/v1/admin/users/:dniNie/email` | Enviar email al usuario |
| PUT | `/v1/admin/users/:dniNie/preguntas` | Asignar preguntas al usuario |
| PUT | `/v1/admin/users/:dniNie/secciones` | Asignar secciones al usuario |
| GET | `/v1/admin/idiomas` | Listar idiomas (paginado) |
| POST | `/v1/admin/idiomas` | Crear idioma |
| PUT | `/v1/admin/idiomas/:id` | Actualizar idioma |
| DELETE | `/v1/admin/idiomas/:id` | Eliminar idioma |
| GET | `/v1/admin/idiomas/:id/content` | Obtener traducciones de un idioma |
| PUT | `/v1/admin/idiomas/:id/content` | Actualizar traducciones de un idioma |
| GET | `/v1/admin/traducciones/faltantes` | Claves de traducción faltantes por idioma |

---

## Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm start` | Arranca el servidor con PostgreSQL (puerto 3001) |
| `npm run dev` | Arranca con `--watch` (reinicio automático al cambiar ficheros) |
| `npm run migrate` | Aplica el esquema (`database/init.sql`). No arranca el servidor. |
| `npm run seed` | Siembra/actualiza traducciones en la BD. No arranca el servidor. |
| `npm run db:setup` | Ejecuta `migrate` + `seed` en secuencia |
| `npm run db:seed-questions` | Siembra las preguntas del formulario |
| `npm run db:seed-users` | Siembra usuarios de prueba (incluye un admin) |

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
