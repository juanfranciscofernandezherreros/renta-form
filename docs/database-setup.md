# Guía de ejecución: tablas y scripts de base de datos

Esta guía explica, paso a paso, cómo crear las **tablas nuevas** del proyecto y
cómo ejecutar los **scripts de seed** que las pueblan con datos iniciales
(idiomas, traducciones, preguntas, usuarios y declaraciones de ejemplo).

> ⚠️ **Importante** — Esta guía es para **crear las tablas nuevas reemplazando
> las que ya existan**. El flujo recomendado **borra el esquema previo** y lo
> vuelve a crear desde `database/init.sql`, garantizando que la estructura
> coincide exactamente con la versión actual del repo. Si tienes datos en
> producción que necesites conservar, **haz una copia de seguridad antes**
> (ver §8).
>
> Los scripts de seed sí son **idempotentes** (`ON CONFLICT DO UPDATE`), pero
> el paso de creación de tablas en esta guía es **destructivo por diseño**.

---

## 1. Requisitos previos

| Herramienta  | Versión mínima | Notas                                            |
|--------------|----------------|--------------------------------------------------|
| Node.js      | 20.x           | Ver `engines` de `backend/package.json`          |
| npm          | 11.x           |                                                  |
| PostgreSQL   | 14+            | Probado con PostgreSQL 16 (alpine en Docker)     |
| Docker (op.) | 24+            | Sólo si usas `docker-compose.yml`                |

Extensión necesaria: `pgcrypto` (se crea automáticamente por `init.sql`).

---

## 2. Levantar PostgreSQL

### Opción A — Docker Compose (recomendada para desarrollo)

```bash
# Desde la raíz del repo
docker compose up -d db
```

Esto arranca un contenedor `renta_form_db` con:

- Base de datos: `renta_form`
- Usuario: `postgres`
- Contraseña: `postgres`
- Puerto: `5432`

Además, el archivo `database/init.sql` se monta en
`/docker-entrypoint-initdb.d/01-init.sql`, por lo que **las tablas se crean
automáticamente la primera vez que arranca el contenedor**.

> Si quieres recrear la base desde cero:
> ```bash
> docker compose down -v   # ⚠️ borra el volumen postgres_data
> docker compose up -d db
> ```

### Opción B — PostgreSQL local

```bash
psql -U postgres -c "CREATE DATABASE renta_form;"
```

---

## 3. Configurar la conexión

Crea `backend/.env` (o exporta variables de entorno) con una de las dos formas
de conexión que admite `backend/config.js`:

```env
PROFILE=db
PORT=3001

# Opción A — URL completa (recomendada para Neon, Heroku, Render, Supabase, …)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/renta_form

# Opción B — Variables individuales (sólo si NO usas DATABASE_URL)
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=renta_form
# PGUSER=postgres
# PGPASSWORD=postgres

CORS_ORIGIN=http://localhost:5173
```

> Cuando se define `DATABASE_URL`, `pool.js` activa SSL con
> `rejectUnauthorized: false` para ser compatible con bases gestionadas en la
> nube. Puedes forzarlo con `PG_SSL_REJECT_UNAUTHORIZED=true|false`.

---

## 4. Tablas que se crean

Todas las tablas se definen en un único archivo: **`database/init.sql`**.

| #  | Tabla                    | Propósito                                                            |
|----|--------------------------|----------------------------------------------------------------------|
| 1  | `usuarios`               | Cuentas (admin/user), credenciales, asignaciones de preguntas.       |
| 2  | `preguntas`              | Catálogo dinámico de preguntas (campo + texto JSONB multi-idioma).   |
| 3  | `declaraciones`          | Datos personales de cada declaración (nombre, DNI/NIE, email, …).    |
| 4  | `respuestas_declaracion` | Respuestas dinámicas (sí/no) por `(declaracion_id, pregunta_id)`.    |
| 5  | `idiomas`                | Idiomas activos de la app (`code`, `label`).                         |
| 6  | `traducciones`           | Pares clave/valor i18n por idioma (FK a `idiomas`).                  |

Tipos ENUM creados:

- `respuesta_yn` → `'si' | 'no'`
- `estado_expediente` → `'recibido' | 'en_revision' | 'documentacion_pendiente' | 'completado' | 'archivado'`

Triggers:

- `trg_declaraciones_actualizado_en` → mantiene `declaraciones.actualizado_en`.
- `trg_idiomas_actualizado_en` → mantiene `idiomas.actualizado_en`.
- `trg_preguntas_actualizada_en` → mantiene `preguntas.actualizada_en`.

---

## 5. Scripts disponibles (en `backend/package.json`)

| Comando                         | Qué hace                                                                                  |
|---------------------------------|-------------------------------------------------------------------------------------------|
| `npm run migrate`               | Aplica `database/init.sql`. Crea tablas, tipos, triggers e índices si no existen.         |
| `npm run tablas`                | Alias de `npm run migrate` (crear tablas).                                                |
| `npm run db:drop`               | Ejecuta `database/drop.sql` (borra tablas, tipos y funciones). Destructivo.               |
| `npm run db:reset`              | `db:drop` + `migrate` + `seed-translations` + `seed-questions` + `seed-users`. Destructivo. |
| `npm run db:seed-translations`  | Migra + siembra `idiomas` y `traducciones` desde el catálogo demo inline en `backend/db/seedTraducciones.js`. |
| `npm run db:seed-questions`     | Migra + siembra las 14 `preguntas` demo (`backend/db/seedPreguntas.js`).                  |
| `npm run db:seed-users`         | Migra + siembra `usuarios` (incluye un admin).                                            |
| `npm run seed:admin`            | Inserta/actualiza el usuario admin (`backend/db/seedAdmin.js`).                           |
| `npm run db:setup`              | `migrate` + `seed-translations` + `seed-questions`.                                       |
| `npm run db:setup-all`          | `migrate` + `seed-translations` + `seed-questions` + `seed-users`.                        |
| `npm run db:setup-100`          | `migrate` + `seed-translations` + `seed100` (14 preguntas + 100 usuarios + 100 declar.).  |
| `npm run seed`                  | Alias compatible: ejecuta `seedTraducciones`.                                             |

> ⚠️ `npm run migrate` usa `CREATE … IF NOT EXISTS`, por lo que **no recrea
> tablas existentes**. Para garantizar que las tablas reflejan la versión
> actual del esquema, **primero borra el esquema** (ver §6.1) y luego ejecuta
> el setup.

---

## 6. Crear las tablas reemplazando las existentes (flujo recomendado)

### 6.1. Borrar el esquema actual

El repo incluye el script **`database/drop.sql`** y un wrapper Node
(`backend/db/drop.js`) que lo ejecuta. Son seguros incluso si la base está
vacía (usan `IF EXISTS`).

```bash
# Recomendado — usa la conexión configurada en backend/.env
cd backend
npm run db:drop

# Alternativas con psql
psql "$DATABASE_URL" -f database/drop.sql
docker compose exec -T db psql -U postgres -d renta_form < database/drop.sql
```

> Alternativa más radical (sólo dev): borrar la base entera —
> `DROP DATABASE renta_form;` y volver a crearla, o `docker compose down -v`.

### 6.2. Crear las tablas + sembrar datos

Una vez vacía la base, ejecuta el setup completo. **Atajo recomendado**: un
único comando que hace drop + create + seed:

```bash
cd backend
npm install
npm run db:reset       # ⚠️ destructivo — borra y recrea todo
```

O por pasos, si prefieres separar drop y setup:

```bash
npm run db:drop        # 1) borra tablas existentes
npm run db:setup-all   # 2) migrate + traducciones + preguntas + usuarios
```

Otras variantes según los datos demo que quieras:

```bash
npm run db:setup       # migrate + traducciones + preguntas
npm run db:setup-100   # migrate + traducciones + 14 preguntas + 100 usuarios + 100 declaraciones
```

### 6.3. Re-ejecutar sólo una parte (sin borrar)

Si únicamente has cambiado un seed (p. ej. traducciones o preguntas) y **no
quieres recrear tablas**:

```bash
npm run db:seed-translations   # refresca idiomas + traducciones
npm run db:seed-questions      # refresca catálogo de preguntas demo
npm run db:seed-users          # refresca usuarios
```

Estos scripts hacen `ON CONFLICT DO UPDATE`, así que actualizan filas
existentes sin duplicarlas.

---

## 7. Verificación

Tras correr los scripts, comprueba que todo está en su sitio:

```bash
psql "$DATABASE_URL" -c "\dt"
```

Deberías ver exactamente las 6 tablas: `usuarios`, `preguntas`,
`declaraciones`, `respuestas_declaracion`, `idiomas`, `traducciones`.

Conteos rápidos:

```sql
SELECT 'idiomas'        AS tabla, COUNT(*) FROM idiomas
UNION ALL SELECT 'traducciones',  COUNT(*) FROM traducciones
UNION ALL SELECT 'preguntas',     COUNT(*) FROM preguntas
UNION ALL SELECT 'usuarios',      COUNT(*) FROM usuarios
UNION ALL SELECT 'declaraciones', COUNT(*) FROM declaraciones;
```

Endpoints públicos para validar desde el backend en marcha:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/v1/irpf/idiomas
curl http://localhost:3001/v1/irpf/traducciones
curl http://localhost:3001/v1/irpf/preguntas
```

---

## 8. Backup antes de recrear (producción)

Antes de ejecutar §6.1 contra una base con datos reales, exporta una copia:

```bash
# Backup completo (estructura + datos)
pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restaurar si algo va mal
pg_restore -d "$DATABASE_URL" --clean --if-exists backup_YYYYMMDD_HHMMSS.dump
```

---

## 9. Resetear la base de datos completa

### Con Docker

```bash
docker compose down -v
docker compose up -d db
cd backend && npm run db:setup-all
```

### Sin Docker

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS renta_form;"
psql -U postgres -c "CREATE DATABASE renta_form;"
cd backend && npm run db:setup-all
```

---

## 10. Resolución de problemas

| Síntoma                                                   | Causa probable / solución                                                                  |
|-----------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `error: relation "preguntas" does not exist`              | No se ha ejecutado `npm run migrate`. Lánzalo o usa `npm run db:setup`.                    |
| `error: extension "pgcrypto" is not available`            | Falta el paquete `postgresql-contrib`. Instálalo o usa la imagen oficial `postgres:16`.    |
| `password authentication failed for user "postgres"`      | Revisa `PGPASSWORD` o `DATABASE_URL` en `backend/.env`.                                    |
| `self signed certificate` al conectar a Neon/Heroku       | Ya gestionado por defecto. Si lo sobreescribiste, borra `PG_SSL_REJECT_UNAUTHORIZED`.      |
| `duplicate key value violates unique constraint`          | Inocuo en seeds: usan `ON CONFLICT DO UPDATE`. Si aparece, comprueba la versión del seed.  |
| `relation "respuestas_declaracion" does not exist` tras un upgrade | Re-ejecuta `npm run migrate`; las migraciones añaden esta tabla y migran columnas YN antiguas. |

---

## 11. Referencias rápidas

- Esquema canónico: `database/init.sql`
- Migraciones (incluye limpieza de columnas legacy): `backend/db/migrate.js`
- Seeds:
  - `backend/db/seedTraducciones.js`
  - `backend/db/seedPreguntas.js`
  - `backend/db/seedUsuarios.js`
  - `backend/db/seedAdmin.js`
  - `backend/db/seed100.js`
- Pool de conexión: `backend/db/pool.js`
- Configuración: `backend/config.js`
