# Changelog – Renta Form

Todos los cambios relevantes de este proyecto están documentados en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y el proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Añadido
- `backend/.env.example` con todas las variables de entorno documentadas.
- `CONTRIBUTING.md` con guía de configuración y convenciones.
- `SECURITY.md` con política de seguridad y prácticas implementadas.
- `CHANGELOG.md` (este fichero).
- `LICENSE` (MIT).
- Plantillas de GitHub: PR template, bug report e issue de feature request.

### Corregido
- Tabla de endpoints de la API en `backend/README.md`: eliminadas rutas obsoletas (`/verificar-codigo`, `/secciones`, `/preguntas` → `/preguntas-formulario`) y añadidas las nuevas (`/roles`, `/declaraciones/import`, `/configuracion`, `/v1/public/declaraciones`).
- `README.md` raíz: añadidas variables `AUTH_SECRET` y `DNI_ENCRYPTION_KEY`; sección de seguridad.

---

## [1.0.0] – 2024

### Añadido
- Formulario público de declaración IRPF con soporte multiidioma (es, fr, ca, en).
- Panel de administración en `/#/admin` con pestañas: Declaraciones, Usuarios, Preguntas, Idiomas/Traducciones.
- API REST Node.js/Express con prefijo `/v1`.
- Autenticación mediante tokens bearer HMAC-SHA256.
- Cifrado AES-256-CBC del DNI/NIE con hash HMAC para búsquedas.
- Catálogo de preguntas dinámico almacenado en PostgreSQL con soporte multiidioma (JSONB).
- Idiomas y traducciones 100% gestionables desde el panel de administración.
- Importación masiva de declaraciones desde CSV.
- Gestión de roles many-to-many para usuarios.
- Notificaciones por correo electrónico (SMTP opcional, asíncrono).
- Tests E2E con Cucumber + Playwright; cobertura de backend ≥ 90 %.
- Especificación OpenAPI disponible en `/#/api-docs`.
- Despliegue listo para Heroku + Neon PostgreSQL (`Procfile`, `heroku-postbuild`).
- Docker Compose para desarrollo local.
