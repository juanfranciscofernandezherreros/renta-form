// Activa el modo demo: todos los datos se sirven en memoria, sin backend real.
// Cambiar a `false` para conectar con la API real.
export const DEMO_MODE = true

// API base URL used by the generated @hey-api client.
// In development the Vite proxy rewrites /v1 → http://localhost:3001/v1.
// In production, point this to the deployed backend base URL.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/v1'

export const API_DECLARACIONES_URL =
  `${API_BASE_URL}/irpf/declaraciones`

export const API_PREGUNTAS_URL =
  `${API_BASE_URL}/irpf/preguntas`

export const ERROR_USER_BLOCKED = 'USER_BLOCKED'
