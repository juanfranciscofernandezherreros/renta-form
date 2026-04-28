# Guía de contribución – Renta Form

¡Gracias por tu interés en contribuir! Este documento describe cómo configurar el entorno de desarrollo, las convenciones del proyecto y el proceso para enviar cambios.

---

## Tabla de contenidos

1. [Requisitos previos](#requisitos-previos)
2. [Configuración del entorno de desarrollo](#configuración-del-entorno-de-desarrollo)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
5. [Convenciones de código](#convenciones-de-código)
6. [Tests](#tests)
7. [Enviar un Pull Request](#enviar-un-pull-request)
8. [Reportar bugs y proponer mejoras](#reportar-bugs-y-proponer-mejoras)

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js | 20.x |
| npm | 11.x |
| PostgreSQL | 14+ |
| Docker (opcional) | 24+ |

---

## Configuración del entorno de desarrollo

```bash
# 1. Clona el repositorio
git clone https://github.com/juanfranciscofernandezherreros/renta-form.git
cd renta-form

# 2. Instala las dependencias (frontend + raíz)
npm install

# 3. Instala las dependencias del backend
cd backend && npm install && cd ..

# 4. Configura las variables de entorno del backend
cp backend/.env.example backend/.env
# Edita backend/.env con tus credenciales locales

# 5. Levanta PostgreSQL (con Docker)
docker compose up -d db

# 6. Inicializa la base de datos
npm run db:setup-all

# 7. Arranca los servidores en terminales separadas
npm run start:backend   # Terminal 1 → http://localhost:3001
npm run dev             # Terminal 2 → http://localhost:5173
```

---

## Estructura del proyecto

```
renta-form/
├── src/              # Frontend React (Vite)
├── backend/          # API REST Node.js / Express
│   ├── config.js     # Configuración centralizada
│   ├── server.js     # Punto de entrada del servidor
│   ├── db/           # Migraciones y seeds
│   ├── data/         # Datos estáticos (traducciones fallback)
│   ├── middleware/   # Autenticación
│   ├── routes/       # Rutas Express
│   ├── services/     # Lógica de negocio (dbService.js)
│   └── utils/        # Utilidades (cifrado DNI, CSV)
├── database/         # Esquema SQL (init.sql, drop.sql)
├── openapi/          # Especificación OpenAPI
├── features/         # Tests E2E (Cucumber + Playwright)
├── scripts/          # Scripts de CI/coverage
└── docs/             # Documentación adicional
```

---

## Flujo de trabajo con Git

1. Crea una rama desde `main` con un nombre descriptivo:
   ```bash
   git checkout -b feat/nombre-de-la-funcionalidad
   # o
   git checkout -b fix/descripcion-del-bug
   ```

2. Realiza commits pequeños y descriptivos (convención [Conventional Commits](https://www.conventionalcommits.org/)):
   ```
   feat: añadir exportación de declaraciones a PDF
   fix: corregir paginación en listado de usuarios
   docs: actualizar README con nuevas variables de entorno
   chore: actualizar dependencias del backend
   ```

3. Asegúrate de que los tests pasan antes de abrir el PR:
   ```bash
   npm run lint
   npm run test:backend
   ```

4. Abre un Pull Request contra la rama `main` usando la plantilla incluida.

---

## Convenciones de código

### Frontend (React / JSX)
- Archivos en `src/` con nombres en `PascalCase` para componentes y `camelCase` para utilidades.
- Hooks personalizados en `src/` con prefijo `use`.
- ESLint se configura en `eslint.config.js`. Ejecuta `npm run lint` antes de hacer commit.

### Backend (Node.js / CommonJS)
- `'use strict'` al inicio de cada fichero.
- Archivos en `backend/` con nombres en `camelCase`.
- Las rutas delegan la lógica al servicio `dbService.js`; las rutas no deben contener lógica de negocio.
- Todas las funciones del servicio devuelven `{ data, error, status }`.

### Base de datos
- El esquema canónico es `database/init.sql`. No modifiques las tablas directamente.
- Los seeds son idempotentes (`ON CONFLICT DO UPDATE`).
- Los nombres de columna y tabla son en `snake_case`.

---

## Tests

```bash
# Linter (raíz)
npm run lint

# Tests E2E del backend (requiere PostgreSQL y backend arrancado)
npm run test:backend

# Tests E2E con cobertura (≥ 90 % de líneas)
npm run test:backend:coverage

# Tests E2E del frontend (requiere vite dev arrancado)
npm run test:frontend
```

Los tests están escritos con **Cucumber** + **Playwright** y se encuentran en `features/`.

---

## Enviar un Pull Request

1. Asegúrate de que tu rama está actualizada respecto a `main`.
2. Completa la plantilla de PR (`.github/PULL_REQUEST_TEMPLATE.md`).
3. Indica en el PR si los cambios afectan al esquema de BD (migración necesaria).
4. Espera la revisión de código. Los comentarios se resuelven antes del merge.

---

## Reportar bugs y proponer mejoras

Usa las plantillas de issues en `.github/ISSUE_TEMPLATE/`:

- **Bug report** – para reportar errores con pasos de reproducción.
- **Feature request** – para proponer nuevas funcionalidades.

Para vulnerabilidades de seguridad, consulta [`SECURITY.md`](SECURITY.md).
