# Renta Form – Backend

Node.js/Express REST API that backs the Renta Form frontend.

## Quick start

1. Create the PostgreSQL database and apply the schema:

   ```bash
   psql -U postgres -c "CREATE DATABASE renta_form;"
   psql -U postgres -d renta_form -f ../database/schema.sql
   psql -U postgres -d renta_form -f ../database/schema_backend.sql
   ```

2. (Optional) Load 200 test users for load testing:

   ```bash
   psql -U postgres -d renta_form -f ../database/test_data_200_usuarios.sql
   ```

3. Copy `.env.example` to `.env` and set the Postgres credentials:

   ```
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=renta_form
   PGUSER=postgres
   PGPASSWORD=yourpassword
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
| GET | `/v1/irpf/preguntas` | Static questionnaire catalogue |
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
| GET | `/v1/admin/idiomas` | List languages |
| POST | `/v1/admin/idiomas` | Create language |
| PUT | `/v1/admin/idiomas/:id` | Update language |
| DELETE | `/v1/admin/idiomas/:id` | Delete language |
| GET | `/v1/admin/idiomas/:id/content` | Get translations |
| PUT | `/v1/admin/idiomas/:id/content` | Update translations |

## Development proxy

In development the Vite frontend proxies `/v1` → `http://localhost:3001/v1`.  
Set `VITE_DEMO_MODE=false` (or `DEMO_MODE=false` in `src/constants.js`) and run
both servers at the same time:

```bash
# Terminal 1 – backend
cd backend && npm start

# Terminal 2 – frontend
cd .. && npm run dev
```
