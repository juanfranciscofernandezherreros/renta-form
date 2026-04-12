// Activa el modo demo: todos los datos se sirven en memoria, sin backend real.
// Cambiar a `false` para conectar con la API real.
export const DEMO_MODE = true

export const API_BASE_URL =
  'https://api.renta-form.example/v1'

export const API_DECLARACIONES_URL =
  `${API_BASE_URL}/irpf/declaraciones`

export const API_PREGUNTAS_URL =
  `${API_BASE_URL}/irpf/preguntas`

export const ERROR_USER_BLOCKED = 'USER_BLOCKED'
