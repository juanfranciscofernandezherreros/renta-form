# Política de seguridad – Renta Form

## Versiones soportadas

Solo se proporcionan correcciones de seguridad para la rama `main` activa del repositorio.

## Informar una vulnerabilidad

**Por favor, no uses el sistema de Issues público para reportar vulnerabilidades de seguridad.**

Envía un correo descriptivo al responsable del repositorio indicando:

1. **Descripción** del problema y su impacto potencial.
2. **Pasos para reproducirlo** (entorno, peticiones HTTP, etc.).
3. **Versión afectada** (commit SHA o fecha).
4. **Posible mitigación** si la conoces.

El mantenedor se compromete a responder en un plazo razonable, coordinar la corrección y publicar un aviso cuando el parche esté disponible.

---

## Prácticas de seguridad implementadas

### Autenticación

- Los tokens bearer son compactos y firmados con **HMAC-SHA256** usando el secreto `AUTH_SECRET`.
- TTL de 8 horas por defecto; todos los tokens se invalidan al reiniciar el servidor si `AUTH_SECRET` no está configurado (se genera uno aleatorio por proceso).
- El middleware usa `crypto.timingSafeEqual` para evitar ataques de temporización en la verificación de firma.

### Cifrado de datos personales

- El DNI/NIE se almacena **cifrado con AES-256-CBC** (IV aleatorio por registro) en la columna `dni_nie`.
- Se guarda un hash HMAC-SHA256 en `dni_nie_hash` para permitir búsquedas sin descifrar.
- La clave de cifrado proviene de la variable de entorno `DNI_ENCRYPTION_KEY` (64 caracteres hex = 32 bytes).

### Contraseñas

- Las contraseñas se almacenan como **hash bcrypt** con coste 10.

### Rate limiting

| Contexto | Límite |
|----------|--------|
| Endpoints de autenticación (`/v1/auth/*`) | 20 req / 15 min / IP |
| Endpoints de administración (`/v1/admin/*`) | 600 req / 15 min / IP |
| Endpoint público de declaraciones | 60 req / 15 min / IP |

### Sanitización de logs

El middleware de logging enmascara los valores de campos sensibles (`password`, `token`, `authorization`, `secret`, `apikey`) sustituyéndolos por `***`.

### Proxy de confianza

El servidor establece `trust proxy: 1` para que el rate limiting funcione correctamente detrás del load balancer de Heroku.

---

## Recomendaciones para producción

- Establece `AUTH_SECRET` con un valor aleatorio de al menos 32 caracteres.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Establece `DNI_ENCRYPTION_KEY` con 64 caracteres hex (32 bytes).
- Cambia las credenciales del administrador por defecto (`admin`/`admin`).
- Usa HTTPS siempre (Heroku, Render, Neon lo proporcionan automáticamente).
- Configura `CORS_ORIGIN` con la URL exacta del frontend en producción.
- Rota `AUTH_SECRET` periódicamente (todos los tokens activos se invalidan al hacerlo).
- **No almacenes secretos en el repositorio.** Usa variables de entorno o un gestor de secretos.
