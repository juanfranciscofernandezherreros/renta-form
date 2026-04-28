# Renta Form

Aplicación web para la gestión de declaraciones de la Renta (IRPF). Incluye un formulario público para ciudadanos y un **panel de administración** para gestionar declaraciones, usuarios, preguntas e internacionalización.

## Arquitectura

```
renta-form/
├── src/              # Frontend React (Vite)
├── backend/          # API REST Node.js / Express
├── database/         # Esquema SQL e inicialización
├── openapi/          # Especificación OpenAPI (Swagger)
└── features/         # Tests E2E con Cucumber + Playwright
```

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Frontend | React 19 + Vite | 5173 (dev) |
| Backend | Node.js / Express | 3001 |
| Base de datos | PostgreSQL 16 | 5432 |

---

## Puesta en marcha local

### Opción A – Con Docker (recomendado)

```bash
# 1. Levantar PostgreSQL
docker-compose up -d

# 2. Instalar dependencias
npm install
cd backend && npm install && cd ..

# 3. Configurar el backend (copiar y ajustar .env)
cp backend/.env.example backend/.env

# 4. Inicializar BD + sembrar datos
npm run db:setup-all   # migrate + seed traducciones + preguntas + usuarios

# 5. Arrancar backend y frontend en terminales separadas
npm run start:backend  # Terminal 1 → http://localhost:3001
npm run dev            # Terminal 2 → http://localhost:5173
```

### Opción B – PostgreSQL local existente

```bash
# Crear la base de datos
psql -U postgres -c "CREATE DATABASE renta_form;"

# Configurar credenciales en backend/.env
cp backend/.env.example backend/.env
# Editar DATABASE_URL o las variables PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD

# Instalar dependencias e inicializar BD
npm install
cd backend && npm install
npm run db:setup-all
cd ..

# Arrancar ambos servidores
npm run start:backend  # Terminal 1
npm run dev            # Terminal 2
```

---

## Acceso al panel de administración

### 1. Navegar a la ruta de administración

Abre en el navegador:

```
http://localhost:5173/#/admin
```

O usando el script npm incluido (abre el navegador directamente en el panel):

```bash
npm run run:admin
```

### 2. Credenciales por defecto

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin` |

> ⚠️ **Importante:** cambia la contraseña en producción. Puedes sobreescribir las credenciales del seed mediante variables de entorno antes de ejecutar `npm run db:seed-admin`:
> ```
> ADMIN_DNI=miusuario ADMIN_PASSWORD=MiContraseñaSegura npm run db:seed-admin
> ```

### 3. Funcionalidades del panel

Una vez dentro de `/#/admin` encontrarás las siguientes pestañas:

| Pestaña | Descripción |
|---------|-------------|
| **Declaraciones** | Ver, editar, cambiar estado y eliminar declaraciones IRPF |
| **Usuarios** | Gestión de cuentas (bloqueo, denuncia, asignación de preguntas) |
| **Preguntas** | CRUD de preguntas del formulario con soporte multiidioma |
| **Idiomas / Traducciones** | Gestión de idiomas activos y sus traducciones |

### 4. Documentación de la API

La especificación OpenAPI (Swagger UI) está disponible en:

```
http://localhost:5173/#/api-docs
```

---

## Scripts npm (raíz)

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo Vite (frontend + proxy `/v1` → backend) |
| `npm run build` | Compila el frontend para producción en `dist/` |
| `npm run start` | Sirve el frontend compilado (`dist/`) |
| `npm run start:backend` | Arranca el backend Express |
| `npm run run:admin` | Abre el navegador directamente en `/#/admin` |
| `npm run db:setup-all` | Migración + seed completo (traducciones + preguntas + usuarios) |
| `npm run db:seed-admin` | Crea / actualiza solo el usuario administrador |
| `npm run db:seed-users` | Siembra 100 usuarios de prueba |
| `npm run db:seed-questions` | Siembra las preguntas del formulario |
| `npm run test` | Ejecuta los tests E2E con Cucumber |
| `npm run test:backend` | Ejecuta el suite Cucumber `@api` que cubre todos los endpoints del backend (requiere PostgreSQL en marcha y un backend escuchando en `BACKEND_BASE_URL`/`http://localhost:3001`) |
| `npm run test:backend:coverage` | Lanza el backend bajo `c8`, ejecuta el suite `@api` y verifica que la cobertura de líneas del backend sea ≥ 90 % (umbral configurable con `COVERAGE_THRESHOLD`) |
| `npm run lint` | Ejecuta ESLint sobre el código fuente |

---

## Variables de entorno (backend)

Crea el fichero `backend/.env` a partir de `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Variables más importantes:

```env
PROFILE=db
PORT=3001

# Opción A – URL completa (Heroku / Neon / Render)
DATABASE_URL=postgresql://<usuario>:<contraseña>@<host>/<bbdd>?sslmode=require

# Opción B – variables individuales
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=renta_form
# PGUSER=postgres
# PGPASSWORD=postgres

CORS_ORIGIN=http://localhost:5173

# Clave de firma de tokens HMAC-SHA256 (>=32 chars en producción)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=cambia-esto-en-produccion

# Clave AES-256 para cifrar DNI/NIE (64 hex chars)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# DNI_ENCRYPTION_KEY=

# Credenciales del usuario administrador (usadas por el seed)
ADMIN_DNI=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin
```

Consulta `backend/.env.example` para la lista completa de variables, incluidas las opciones de SMTP para notificaciones por correo.

---

## Seguridad

| Aspecto | Detalle |
|---------|---------|
| **Tokens** | Tokens bearer HMAC-SHA256 firmados con `AUTH_SECRET`. TTL de 8 horas. Sin dependencias externas (usa el módulo `crypto` de Node.js). |
| **DNI/NIE** | Almacenados cifrados con AES-256-CBC (IV aleatorio por registro) en `dni_nie` y en claro HMAC en `dni_nie_hash` para búsquedas. Clave desde `DNI_ENCRYPTION_KEY`. |
| **Contraseñas** | Hash con bcrypt (coste 10). |
| **Rate limiting** | Limitador de 20 req/15 min en endpoints de autenticación; 600 req/15 min en endpoints de admin. |
| **Sanitización** | Las trazas del servidor enmascaran campos sensibles (`password`, `token`, `authorization`, etc.). |

> Para más detalles, consulta [`SECURITY.md`](SECURITY.md).

---

## Despliegue en Heroku / Neon

El `Procfile` arranca el backend automáticamente:

```
web: cd backend && npm start
```

El script `heroku-postbuild` instala dependencias del backend y compila el frontend:

```bash
npm install --prefix backend && npm run build
```

Configura las variables de entorno en el dashboard de Heroku o con:

```bash
heroku config:set DATABASE_URL=<url_neon> CORS_ORIGIN=<url_frontend> AUTH_SECRET=<secreto> DNI_ENCRYPTION_KEY=<clave>
```

---

## Contribuir

Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) para la guía de configuración del entorno y las convenciones del proyecto.

## Changelog

Consulta [`CHANGELOG.md`](CHANGELOG.md) para el historial de cambios.

## Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

