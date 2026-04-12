// ---------------------------------------------------------------------------
// DEMO DATA – datos en memoria para la demo al cliente
// ---------------------------------------------------------------------------
// Cuatro usuarios con situaciones fiscales distintas.
// Credenciales de acceso (en LoginPage sólo se valida formato, cualquier
// combinación DNI/NIE + email válidos funciona):
//   · 12345678A  /  maria.garcia@ejemplo.es
//   · 87654321B  /  carlos.martinez@ejemplo.es
//   · 11223344C  /  ana.lopez@ejemplo.es
//   · 44332211D  /  pedro.fernandez@ejemplo.es
// ---------------------------------------------------------------------------

/** @type {import('./api/types.gen').CatalogoPreguntas} */
export const CATALOGO_PREGUNTAS = {
  secciones: [
    {
      id: 'vivienda',
      numero: 2,
      titulo: 'Situación de Vivienda',
      preguntas: [
        {
          id: 'viviendaAlquiler',
          texto: '¿Vive actualmente en régimen de alquiler?',
          indentada: false,
        },
        {
          id: 'alquilerMenos35',
          texto: '¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',
          indentada: true,
          condicion: { campo: 'viviendaAlquiler', valor: 'si' },
        },
        {
          id: 'viviendaPropiedad',
          texto: '¿Es propietario/a de su vivienda habitual?',
          indentada: false,
        },
        {
          id: 'propiedadAntes2013',
          texto: '¿La adquirió antes del 1 de enero de 2013?',
          indentada: true,
          condicion: { campo: 'viviendaPropiedad', valor: 'si' },
        },
        {
          id: 'pisosAlquiladosTerceros',
          texto: '¿Tiene inmuebles arrendados a terceros?',
          indentada: false,
        },
        {
          id: 'segundaResidencia',
          texto: '¿Dispone de una segunda residencia?',
          indentada: false,
        },
      ],
    },
    {
      id: 'familia',
      numero: 3,
      titulo: 'Cargas Familiares y Ayudas Públicas',
      preguntas: [
        {
          id: 'familiaNumerosa',
          texto: '¿Pertenece a una familia numerosa?',
          indentada: false,
        },
        {
          id: 'ayudasGobierno',
          texto: '¿Ha recibido ayudas o subvenciones públicas en 2025?',
          indentada: false,
        },
        {
          id: 'mayores65ACargo',
          texto: '¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',
          indentada: false,
        },
        {
          id: 'mayoresConviven',
          texto: '¿Conviven con usted en el mismo domicilio?',
          indentada: true,
          condicion: { campo: 'mayores65ACargo', valor: 'si' },
        },
        {
          id: 'hijosMenores26',
          texto: '¿Tiene hijos o descendientes menores de 26 años a su cargo?',
          indentada: false,
        },
      ],
    },
    {
      id: 'ingresos',
      numero: 4,
      titulo: 'Ingresos Extraordinarios e Inversiones',
      preguntas: [
        {
          id: 'ingresosJuego',
          texto: '¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',
          indentada: false,
        },
        {
          id: 'ingresosInversiones',
          texto: '¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',
          indentada: false,
        },
      ],
    },
  ],
}

/** @type {import('./api/types.gen').Declaracion[]} */
const declaracionesIniciales = [
  // ── Usuario 1: María García López ──────────────────────────────────────
  // Inquilina, sin propiedad en propiedad, familia numerosa, ingresos por inversiones.
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000001',
    estado: 'en_revision',
    creadoEn: '2025-04-01T09:15:00.000Z',
    actualizadoEn: '2025-04-05T11:30:00.000Z',
    nombre: 'María',
    apellidos: 'García López',
    dniNie: '12345678A',
    email: 'maria.garcia@ejemplo.es',
    telefono: '600111222',
    viviendaAlquiler: 'si',
    alquilerMenos35: 'no',
    viviendaPropiedad: 'no',
    pisosAlquiladosTerceros: 'no',
    segundaResidencia: 'no',
    familiaNumerosa: 'si',
    ayudasGobierno: 'no',
    mayores65ACargo: 'no',
    hijosMenores26: 'si',
    ingresosJuego: 'no',
    ingresosInversiones: 'si',
    comentarios: 'Tengo fondos de inversión en una entidad bancaria extranjera.',
    documentos: [],
  },

  // ── Usuario 2: Carlos Martínez Ruiz ────────────────────────────────────
  // Propietario desde antes de 2013, segunda residencia, padres a cargo conviviendo.
  {
    id: 'b2c3d4e5-0002-0002-0002-000000000002',
    estado: 'documentacion_pendiente',
    creadoEn: '2025-04-02T10:00:00.000Z',
    actualizadoEn: '2025-04-08T16:45:00.000Z',
    nombre: 'Carlos',
    apellidos: 'Martínez Ruiz',
    dniNie: '87654321B',
    email: 'carlos.martinez@ejemplo.es',
    telefono: '611333444',
    viviendaAlquiler: 'no',
    viviendaPropiedad: 'si',
    propiedadAntes2013: 'si',
    pisosAlquiladosTerceros: 'no',
    segundaResidencia: 'si',
    familiaNumerosa: 'no',
    ayudasGobierno: 'no',
    mayores65ACargo: 'si',
    mayoresConviven: 'si',
    hijosMenores26: 'no',
    ingresosJuego: 'no',
    ingresosInversiones: 'no',
    comentarios: 'La segunda residencia está en la costa; la utilizo sólo en verano.',
    documentos: [],
  },

  // ── Usuario 3: Ana López Sánchez ───────────────────────────────────────
  // Perfil sencillo: alquiler bajo, sin cargas familiares, sin ingresos extra.
  {
    id: 'c3d4e5f6-0003-0003-0003-000000000003',
    estado: 'recibido',
    creadoEn: '2025-04-10T08:00:00.000Z',
    actualizadoEn: '2025-04-10T08:00:00.000Z',
    nombre: 'Ana',
    apellidos: 'López Sánchez',
    dniNie: '11223344C',
    email: 'ana.lopez@ejemplo.es',
    telefono: '622555666',
    viviendaAlquiler: 'si',
    alquilerMenos35: 'si',
    viviendaPropiedad: 'no',
    pisosAlquiladosTerceros: 'no',
    segundaResidencia: 'no',
    familiaNumerosa: 'no',
    ayudasGobierno: 'si',
    mayores65ACargo: 'no',
    hijosMenores26: 'no',
    ingresosJuego: 'no',
    ingresosInversiones: 'no',
    comentarios: 'Recibí una ayuda al alquiler del ayuntamiento en marzo de 2025.',
    documentos: [],
  },

  // ── Usuario 4: Pedro Fernández González ────────────────────────────────
  // Propietario con pisos alquilados, ingresos por juego e inversiones, sin cargas.
  {
    id: 'd4e5f6a7-0004-0004-0004-000000000004',
    estado: 'completado',
    creadoEn: '2025-03-20T14:30:00.000Z',
    actualizadoEn: '2025-04-01T10:00:00.000Z',
    nombre: 'Pedro',
    apellidos: 'Fernández González',
    dniNie: '44332211D',
    email: 'pedro.fernandez@ejemplo.es',
    telefono: '633777888',
    viviendaAlquiler: 'no',
    viviendaPropiedad: 'si',
    propiedadAntes2013: 'no',
    pisosAlquiladosTerceros: 'si',
    segundaResidencia: 'no',
    familiaNumerosa: 'no',
    ayudasGobierno: 'no',
    mayores65ACargo: 'no',
    hijosMenores26: 'no',
    ingresosJuego: 'si',
    ingresosInversiones: 'si',
    comentarios: 'Tengo dos pisos en alquiler y participé en un torneo de póker online.',
    documentos: [],
  },
]

// ---------------------------------------------------------------------------
// Almacén en memoria (mutable para soportar nuevos envíos durante la demo)
// ---------------------------------------------------------------------------
/** @type {import('./api/types.gen').Declaracion[]} */
export const declaracionesStore = [...declaracionesIniciales]

let nextIdCounter = 5

/** Genera un UUID fake basado en un contador incremental. */
export function generarId() {
  const n = String(nextIdCounter++).padStart(2, '0')
  return `f5e6d7c8-00${n}-00${n}-00${n}-0000000000${n}`
}
