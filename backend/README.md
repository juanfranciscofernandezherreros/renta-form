# Renta Form – Backend

Node.js/Express REST API that backs the Renta Form frontend.

## Quick start

1. Create the PostgreSQL database:

   ```bash
   psql -U postgres -c "CREATE DATABASE renta_form;"
   ```

2. Copy `.env.example` to `.env` and set the Postgres credentials:

   ```
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=renta_form
   PGUSER=postgres
   PGPASSWORD=yourpassword
   ```

3. Apply the schema and seed data:

   ```bash
   cd backend

   # Apply schema migrations (creates all tables from database/init.sql)
   npm run migrate

   # Seed translations into the DB
   npm run seed

   # Or run both in one command
   npm run db:setup
   ```

4. Start the server:

   ```bash
   npm start
   ```

The server listens on `http://localhost:3001`.

## API base URL

All endpoints are prefixed with `/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/auth/login` | Login (dniNie + password) |
| POST | `/v1/auth/verificar-codigo` | Verify intranet access code |
| POST | `/v1/auth/change-password` | Change user password |
| GET | `/v1/irpf/preguntas` | Questionnaire catalogue |
| GET | `/v1/irpf/idiomas` | List active languages |
| GET | `/v1/irpf/traducciones` | All translations grouped by language code |
| GET | `/v1/irpf/declaraciones` | List declarations (paginated) |
| POST | `/v1/irpf/declaraciones` | Submit a new declaration (multipart) |
| GET | `/v1/irpf/declaraciones/all` | List all declarations (admin) |
| GET | `/v1/irpf/declaraciones/:id` | Get declaration detail |
| PATCH | `/v1/irpf/declaraciones/:id` | Update estado |
| PUT | `/v1/irpf/declaraciones/:id` | Update all editable fields |
| DELETE | `/v1/irpf/declaraciones/:id` | Delete declaration |
| GET | `/v1/irpf/declaraciones/:id/preguntas` | Get assigned questions |
| PUT | `/v1/irpf/declaraciones/:id/preguntas` | Upsert question assignments |
| DELETE | `/v1/irpf/declaraciones/:id/preguntas/:preguntaId` | Remove assignment |
| POST | `/v1/irpf/declaraciones/:id/email` | Send email for declaration |
| GET | `/v1/irpf/consulta/:token` | Public token lookup |
| GET | `/v1/admin/preguntas` | List additional questions |
| POST | `/v1/admin/preguntas` | Create question |
| GET | `/v1/admin/preguntas/:id` | Get question |
| PUT | `/v1/admin/preguntas/:id` | Update question |
| DELETE | `/v1/admin/preguntas/:id` | Delete question |
| GET | `/v1/admin/secciones` | List sections |
| POST | `/v1/admin/secciones` | Create section |
| PUT | `/v1/admin/secciones/:id` | Update section |
| DELETE | `/v1/admin/secciones/:id` | Delete section |
| GET | `/v1/admin/secciones/:id/declaraciones` | Declarations in section |
| GET | `/v1/admin/secciones/:id/preguntas` | Questions in section |
| GET | `/v1/admin/users` | List users |
| POST | `/v1/admin/users/assign` | Assign user account |
| GET | `/v1/admin/users/:dniNie` | Get user |
| PATCH | `/v1/admin/users/:dniNie/block` | Block/unblock user |
| PATCH | `/v1/admin/users/:dniNie/report` | Report/unreport user |
| DELETE | `/v1/admin/users/:dniNie` | Delete user |
| POST | `/v1/admin/users/:dniNie/email` | Send email to user |
| PUT | `/v1/admin/users/:dniNie/preguntas` | Assign questions to user |
| PUT | `/v1/admin/users/:dniNie/secciones` | Assign sections to user |
| GET | `/v1/admin/idiomas` | List languages (paginated) |
| POST | `/v1/admin/idiomas` | Create language |
| PUT | `/v1/admin/idiomas/:id` | Update language |
| DELETE | `/v1/admin/idiomas/:id` | Delete language |
| GET | `/v1/admin/idiomas/:id/content` | Get translations for a language |
| PUT | `/v1/admin/idiomas/:id/content` | Update translations for a language |
| GET | `/v1/admin/traducciones/faltantes` | Missing translation keys per language |

## npm scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start server (PostgreSQL, port 3001) |
| `npm run dev` | Start server with `--watch` (auto-restart on file changes) |
| `npm run migrate` | Apply schema migrations only (no server start) |
| `npm run seed` | Seed translations into the DB (no server start) |
| `npm run db:setup` | Run `migrate` + `seed` in sequence |

## Development proxy

In development the Vite frontend proxies `/v1` → `http://localhost:3001/v1`.  
Run both servers at the same time:

```bash
# Terminal 1 – backend (PostgreSQL)
cd backend && npm start

# Terminal 2 – frontend
cd .. && npm run dev
```

## Internacionalisation (i18n)

Languages and translations are stored in the `idiomas` and `traducciones` DB tables.

| Public endpoint | Description |
|---|---|
| `GET /v1/irpf/idiomas` | Returns the list of active languages (`[{ code, label }]`) |
| `GET /v1/irpf/traducciones` | Returns all translations grouped by language code |

The frontend `LanguageContext` fetches both endpoints on startup. If the DB has no data it falls back to the static JSON files in `translations/`.

Use `GET /v1/admin/traducciones/faltantes` to audit which translation keys are missing for each language relative to the reference language (`es`).
