# backend/db

Scripts y módulos de base de datos PostgreSQL para **renta-form**.

## Archivos

| Archivo | Descripción |
|---|---|
| `pool.js` | Módulo que exporta el pool de conexiones PostgreSQL. Configura la conexión mediante `DATABASE_URL` (Heroku/Neon) o variables de entorno individuales (`PG_HOST`, `PG_PORT`, etc.). No se ejecuta directamente. |
| `migrate.js` | Ejecuta las migraciones DDL: crea las tablas (`usuarios`, `preguntas`, `declaraciones`, `idiomas`, `traducciones`) si no existen. Idempotente. |
| `seedTraducciones.js` | Siembra los datos de traducciones para todos los idiomas soportados en la tabla `traducciones`. Idempotente (usa `ON CONFLICT`). |
| `seedLanguages.js` | Siembra los idiomas disponibles en la tabla `idiomas`. Idempotente. |
| `seed100.js` | Siembra datos de prueba: 60 preguntas, 100 usuarios y 100 declaraciones. Idempotente (usa `ON CONFLICT`). |

## Comandos npm disponibles

Ejecutar desde la **raíz del proyecto**:

```bash
# Ejecutar migraciones DDL
npm run migrate

# Sembrar traducciones
npm run db:seed-translations

# Sembrar idiomas
npm run db:seed-languages

# Sembrar datos de prueba (60 preguntas, 100 usuarios, 100 declaraciones)
npm run db:seed-100

# Setup completo (migrar + traducciones)
npm run db:setup

# Setup completo con datos de prueba (migrar + traducciones + seed100)
npm run db:setup-100
```

O desde el directorio `backend/`:

```bash
npm run migrate
npm run db:seed-translations
npm run db:seed-languages
npm run db:seed-100
npm run db:setup
npm run db:setup-100
```

## Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `DATABASE_URL` | URL de conexión completa (Heroku, Neon) | — |
| `PG_HOST` | Host de PostgreSQL | `localhost` |
| `PG_PORT` | Puerto de PostgreSQL | `5432` |
| `PG_DB` | Nombre de la base de datos | `rentaform` |
| `PG_USER` | Usuario de PostgreSQL | `postgres` |
| `PG_PASSWORD` | Contraseña de PostgreSQL | — |
| `PG_SSL_REJECT_UNAUTHORIZED` | Validar certificado SSL (`false` para dev local) | `true` |
