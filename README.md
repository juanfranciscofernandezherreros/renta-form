# Declaración de la Renta 2025 – IRPF

Formulario de la Declaración de la Renta construido con **React + Vite**.

## Características

- Formulario completo de IRPF con todos los apartados (datos personales, rendimientos, deducciones, situación familiar, pagos fraccionados).
- Cálculo estimado en tiempo real (base imponible, cuota íntegra, cuota líquida y resultado).
- Las preguntas Sí/No se cargan dinámicamente desde el endpoint de preguntas al iniciar la aplicación.
- Al pulsar **Enviar declaración** se hace un `POST` con todos los datos al endpoint de declaraciones.
- Notificación visual (toast) con el resultado del envío.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
npm run preview
```

---

## Ejecución en local

### Requisitos previos

- **Node.js ≥ 20** (`node -v` para comprobarlo)
- **npm** (incluido con Node.js)

### 1. Instalar dependencias

```bash
# Dependencias del frontend (raíz del proyecto)
npm install

# Dependencias del backend
cd backend && npm install && cd ..
```

### 2. Configurar la conexión a la base de datos

Crea el fichero `backend/.env` a partir del ejemplo:

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` con los valores de tu base de datos:

```env
PROFILE=db
PORT=3001

# Opción A – URL completa (recomendado para Neon / Heroku)
DATABASE_URL=postgresql://<usuario>:<contraseña>@<host>/<bbdd>?sslmode=require

# Opción B – variables individuales (solo si no se usa DATABASE_URL)
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=renta_form
# PGUSER=postgres
# PGPASSWORD=postgres

CORS_ORIGIN=http://localhost:5173
```

> **Neon:** usa la connection string que aparece en el panel de Neon como valor de `DATABASE_URL`.

### 3. Arrancar el backend

```bash
cd backend
npm run start:db
```

Al arrancar, el servidor aplica las migraciones automáticamente (`database/schema.sql` y `database/schema_backend.sql`) si las tablas todavía no existen:

```
[server] Starting with profile: db
[migrate] Running schema.sql ...
[migrate] schema.sql applied.
[migrate] Running schema_backend.sql ...
[migrate] schema_backend.sql applied.
[server] Listening on http://localhost:3001  (profile: db)
```

### 4. Arrancar el frontend

En otra terminal, desde la raíz del proyecto:

```bash
npm run dev
```

Vite arranca en **http://localhost:5173** y redirige automáticamente todas las peticiones `/v1/*` al backend (`localhost:3001`).

### 5. Verificar que todo funciona

```bash
curl http://localhost:3001/health
# {"status":"ok","profile":"db","time":"..."}
```

### Resumen de comandos

| Terminal | Directorio | Comando | Descripción |
|----------|-----------|---------|-------------|
| 1 | `backend/` | `npm install` | Instala dependencias del backend |
| 1 | `backend/` | `npm run start:db` | Arranca el backend con PostgreSQL |
| 2 | raíz | `npm install` | Instala dependencias del frontend |
| 2 | raíz | `npm run dev` | Arranca el frontend (Vite dev server) |

### Alternativa: modo mock (sin base de datos)

Si solo quieres probar la interfaz sin necesidad de una base de datos real:

```bash
cd backend
npm run start:mock
```

Todos los datos se guardan en memoria y se pierden al reiniciar el servidor.

---

## API — Endpoint de preguntas

### Request

```
GET https://api.renta-form.example/v1/irpf/preguntas
Accept: application/json
```

No requiere cuerpo ni parámetros. La respuesta contiene las secciones y preguntas que se muestran en el formulario.

### Response `200 OK`

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
          "texto": "¿Vives actualmente de alquiler?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "alquilerMenos35",
          "texto": "En caso de vivir de alquiler, ¿tienes menos de 35 años?",
          "tipo": "si_no",
          "indentada": true,
          "condicion": { "campo": "viviendaAlquiler", "valor": "si" }
        },
        {
          "id": "viviendaPropiedad",
          "texto": "¿Tu vivienda habitual es de propiedad?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "propiedadAntes2013",
          "texto": "En caso de ser de propiedad, ¿la compraste antes del 1 de enero de 2013?",
          "tipo": "si_no",
          "indentada": true,
          "condicion": { "campo": "viviendaPropiedad", "valor": "si" }
        },
        {
          "id": "pisosAlquiladosTerceros",
          "texto": "¿Tienes otros pisos de tu propiedad que estén alquilados a terceros?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "segundaResidencia",
          "texto": "¿Tienes una segunda residencia para tu propio uso y disfrute?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        }
      ]
    },
    {
      "id": "familia",
      "numero": 3,
      "titulo": "Cargas Familiares y Ayudas Públicas",
      "preguntas": [
        {
          "id": "familiaNumerosa",
          "texto": "¿Tienes el título de familia numerosa?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "ayudasGobierno",
          "texto": "¿Has recibido alguna ayuda o subvención del gobierno durante el año 2025?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "mayores65ACargo",
          "texto": "¿Tienes personas mayores de 65 años a tu cargo?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "mayoresConviven",
          "texto": "En caso de tener mayores a cargo, ¿viven contigo en el mismo domicilio?",
          "tipo": "si_no",
          "indentada": true,
          "condicion": { "campo": "mayores65ACargo", "valor": "si" }
        },
        {
          "id": "hijosMenores26",
          "texto": "¿Tienes hijos menores de 26 años a tu cargo?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        }
      ]
    },
    {
      "id": "ingresos",
      "numero": 4,
      "titulo": "Ingresos Extraordinarios e Inversiones",
      "preguntas": [
        {
          "id": "ingresosJuego",
          "texto": "¿Has recibido ingresos procedentes del juego o apuestas (online o presenciales) durante el año 2025?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        },
        {
          "id": "ingresosInversiones",
          "texto": "¿Has recibido ingresos procedentes de depósitos bancarios, fondos de inversión, venta de acciones en bolsa o similares?",
          "tipo": "si_no",
          "indentada": false,
          "condicion": null
        }
      ]
    }
  ]
}
```

### Descripción de campos

| Campo | Tipo | Descripción |
|---|---|---|
| `secciones` | `array` | Lista de secciones de preguntas |
| `secciones[].id` | `string` | Identificador único de la sección |
| `secciones[].numero` | `number` | Número de sección que se muestra en el encabezado |
| `secciones[].titulo` | `string` | Título visible de la sección |
| `secciones[].preguntas` | `array` | Lista de preguntas de la sección |
| `preguntas[].id` | `string` | Identificador único del campo (se usa como clave en el payload de envío) |
| `preguntas[].texto` | `string` | Texto de la pregunta que se muestra al usuario |
| `preguntas[].tipo` | `string` | Tipo de pregunta. Por ahora solo `"si_no"` |
| `preguntas[].indentada` | `boolean` | Si es `true`, la pregunta aparece con sangría (pregunta dependiente) |
| `preguntas[].condicion` | `object\|null` | Si no es `null`, la pregunta solo se muestra cuando `form[campo] === valor` |

### Respuestas de error

| Código | Descripción |
|---|---|
| `500 Internal Server Error` | Error en el servidor al recuperar las preguntas |
| `503 Service Unavailable` | Servicio no disponible temporalmente |

En caso de error el formulario muestra un aviso inline y el usuario no puede continuar hasta que las preguntas carguen correctamente.

---

## API — Endpoint de declaraciones

### Request

```
POST https://api.renta-form.example/v1/irpf/declaraciones
Content-Type: multipart/form-data
```

Envía todos los campos del formulario como `multipart/form-data`. Los campos de las preguntas dinámicas se incluyen usando el `id` de cada pregunta como nombre de campo con valor `"si"` o `"no"`.
