// ---------------------------------------------------------------------------
// DEMO DATA – datos en memoria para la demo al cliente
// ---------------------------------------------------------------------------
// Cuatro usuarios con situaciones fiscales distintas.
// Credenciales de acceso (DNI/NIE + contraseña por defecto renta2025):
//   · 12345678A  /  renta2025
//   · 87654321B  /  renta2025
//   · 11223344C  /  renta2025
//   · 44332211D  /  renta2025
// Administrador (URL: /admin):
//   · admin  /  admin
// ---------------------------------------------------------------------------

/** @type {import('./api/types.gen').CatalogoPreguntas} */
export const CATALOGO_PREGUNTAS = {
  secciones: [
    {
      id: 'vivienda',
      numero: 2,
      titulo: 'Situación de Vivienda',
      titulos: {
        es: 'Situación de Vivienda',
        fr: 'Situation de Logement',
        en: 'Housing Situation',
        ca: "Situació d'Habitatge",
      },
      preguntas: [
        {
          id: 'viviendaAlquiler',
          texto: '¿Vive actualmente en régimen de alquiler?',
          textos: {
            es: '¿Vive actualmente en régimen de alquiler?',
            fr: 'Vivez-vous actuellement en location ?',
            en: 'Do you currently live in rented accommodation?',
            ca: 'Viu actualment en règim de lloguer?',
          },
          indentada: false,
        },
        {
          id: 'alquilerMenos35',
          texto: '¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',
          textos: {
            es: '¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',
            fr: 'Le montant du loyer est-il inférieur à 35 % de vos revenus bruts annuels ?',
            en: 'Is the rent amount less than 35% of your annual gross income?',
            ca: "L'import del lloguer és inferior al 35 % dels seus ingressos bruts anuals?",
          },
          indentada: true,
          condicion: { campo: 'viviendaAlquiler', valor: 'si' },
        },
        {
          id: 'viviendaPropiedad',
          texto: '¿Es propietario/a de su vivienda habitual?',
          textos: {
            es: '¿Es propietario/a de su vivienda habitual?',
            fr: 'Êtes-vous propriétaire de votre résidence principale ?',
            en: 'Do you own your primary residence?',
            ca: 'És propietari/ària del seu habitatge habitual?',
          },
          indentada: false,
        },
        {
          id: 'propiedadAntes2013',
          texto: '¿La adquirió antes del 1 de enero de 2013?',
          textos: {
            es: '¿La adquirió antes del 1 de enero de 2013?',
            fr: "L'avez-vous acquise avant le 1er janvier 2013 ?",
            en: 'Did you acquire it before 1 January 2013?',
            ca: 'La va adquirir abans del 1 de gener de 2013?',
          },
          indentada: true,
          condicion: { campo: 'viviendaPropiedad', valor: 'si' },
        },
        {
          id: 'pisosAlquiladosTerceros',
          texto: '¿Tiene inmuebles arrendados a terceros?',
          textos: {
            es: '¿Tiene inmuebles arrendados a terceros?',
            fr: 'Avez-vous des biens immobiliers loués à des tiers ?',
            en: 'Do you have properties rented out to third parties?',
            ca: 'Té immobles arrendats a tercers?',
          },
          indentada: false,
        },
        {
          id: 'segundaResidencia',
          texto: '¿Dispone de una segunda residencia?',
          textos: {
            es: '¿Dispone de una segunda residencia?',
            fr: "Disposez-vous d'une résidence secondaire ?",
            en: 'Do you have a second residence?',
            ca: "Disposa d'una segona residència?",
          },
          indentada: false,
        },
      ],
    },
    {
      id: 'familia',
      numero: 3,
      titulo: 'Cargas Familiares y Ayudas Públicas',
      titulos: {
        es: 'Cargas Familiares y Ayudas Públicas',
        fr: 'Charges Familiales et Aides Publiques',
        en: 'Family Obligations and Public Benefits',
        ca: 'Càrregues Familiars i Ajudes Públiques',
      },
      preguntas: [
        {
          id: 'familiaNumerosa',
          texto: '¿Pertenece a una familia numerosa?',
          textos: {
            es: '¿Pertenece a una familia numerosa?',
            fr: 'Appartenez-vous à une famille nombreuse ?',
            en: 'Do you belong to a large family?',
            ca: 'Pertany a una família nombrosa?',
          },
          indentada: false,
        },
        {
          id: 'ayudasGobierno',
          texto: '¿Ha recibido ayudas o subvenciones públicas en 2025?',
          textos: {
            es: '¿Ha recibido ayudas o subvenciones públicas en 2025?',
            fr: 'Avez-vous reçu des aides ou subventions publiques en 2025 ?',
            en: 'Have you received public grants or subsidies in 2025?',
            ca: 'Ha rebut ajudes o subvencions públiques el 2025?',
          },
          indentada: false,
        },
        {
          id: 'mayores65ACargo',
          texto: '¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',
          textos: {
            es: '¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',
            fr: 'Avez-vous des ascendants de plus de 65 ans économiquement à votre charge ?',
            en: 'Do you have financial dependants over 65 years old?',
            ca: 'Té ascendents majors de 65 anys econòmicament a càrrec seu?',
          },
          indentada: false,
        },
        {
          id: 'mayoresConviven',
          texto: '¿Conviven con usted en el mismo domicilio?',
          textos: {
            es: '¿Conviven con usted en el mismo domicilio?',
            fr: 'Cohabitent-ils avec vous au même domicile ?',
            en: 'Do they live with you at the same address?',
            ca: 'Conviuen amb vostè en el mateix domicili?',
          },
          indentada: true,
          condicion: { campo: 'mayores65ACargo', valor: 'si' },
        },
        {
          id: 'hijosMenores26',
          texto: '¿Tiene hijos o descendientes menores de 26 años a su cargo?',
          textos: {
            es: '¿Tiene hijos o descendientes menores de 26 años a su cargo?',
            fr: 'Avez-vous des enfants ou descendants de moins de 26 ans à votre charge ?',
            en: 'Do you have children or dependants under 26 years old?',
            ca: 'Té fills o descendents menors de 26 anys a càrrec seu?',
          },
          indentada: false,
        },
      ],
    },
    {
      id: 'ingresos',
      numero: 4,
      titulo: 'Ingresos Extraordinarios e Inversiones',
      titulos: {
        es: 'Ingresos Extraordinarios e Inversiones',
        fr: 'Revenus Extraordinaires et Investissements',
        en: 'Extraordinary Income and Investments',
        ca: 'Ingressos Extraordinaris i Inversions',
      },
      preguntas: [
        {
          id: 'ingresosJuego',
          texto: '¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',
          textos: {
            es: '¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',
            fr: 'Avez-vous obtenu des gains par jeux, loteries ou paris en 2025 ?',
            en: 'Have you obtained winnings from gambling, lotteries or betting in 2025?',
            ca: 'Ha obtingut guanys per joc, loteries o apostes el 2025?',
          },
          indentada: false,
        },
        {
          id: 'ingresosInversiones',
          texto: '¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',
          textos: {
            es: '¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',
            fr: "Avez-vous obtenu des rendements de capital mobilier (actions, fonds d'investissement, etc.) en 2025 ?",
            en: 'Have you obtained income from movable capital (shares, investment funds, etc.) in 2025?',
            ca: "Ha obtingut rendiments de capital mobiliari (accions, fons d'inversió, etc.) el 2025?",
          },
          indentada: false,
        },
      ],
    },
  ],
}

/** @type {import('./api/types.gen').Declaracion[]} */
const declaracionesIniciales = [
  // ── Usuario 1: María García López ──────────────────────────────────────
  // Inquilina, sin vivienda en propiedad, familia numerosa, ingresos por inversiones.
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

// ---------------------------------------------------------------------------
// Contraseñas – contraseña inicial: renta2025
// Admin: admin / admin
// ---------------------------------------------------------------------------
/** @type {Map<string, string>} */
export const passwordsStore = new Map([
  ...declaracionesIniciales.map(d => [d.dniNie, 'renta2025']),
  ['ADMIN', 'admin'],
])

// ---------------------------------------------------------------------------
// Roles – 'admin' | 'user'
// ---------------------------------------------------------------------------
/** @type {Map<string, string>} */
export const rolesStore = new Map([
  ...declaracionesIniciales.map(d => [d.dniNie, 'user']),
  ['ADMIN', 'admin'],
])

// ---------------------------------------------------------------------------
// Usuarios – store enriquecido para la gestión de admin
// ---------------------------------------------------------------------------

/**
 * @typedef {{ dniNie: string, nombre: string, apellidos: string, email: string, telefono: string, role: string, creadoEn: string }} Usuario
 */

/** @type {Usuario[]} */
export const usersStore = declaracionesIniciales.map(d => ({
  dniNie: d.dniNie,
  nombre: d.nombre,
  apellidos: d.apellidos,
  email: d.email,
  telefono: d.telefono ?? '',
  role: 'user',
  creadoEn: d.creadoEn,
}))

/** @type {Map<string, boolean>} Mapa DNI/NIE → bloqueado */
export const blockedStore = new Map(declaracionesIniciales.map(d => [d.dniNie, false]))

/** @type {Map<string, boolean>} Mapa DNI/NIE → denunciado */
export const reportedStore = new Map(declaracionesIniciales.map(d => [d.dniNie, false]))

/** @type {Map<string, string[]>} Mapa DNI/NIE → IDs de preguntas asignadas */
export const userPreguntasStore = new Map(declaracionesIniciales.map(d => [d.dniNie, []]))

/** @type {Map<string, string[]>} Mapa DNI/NIE → IDs de secciones asignadas */
export const userSeccionesStore = new Map(declaracionesIniciales.map(d => [d.dniNie, []]))

let nextIdCounter = 5

/** Genera un UUID fake basado en un contador incremental. */
export function generarId() {
  const n = String(nextIdCounter++).padStart(8, '0')
  return `f5e6d7c8-${n.slice(0, 4)}-${n.slice(4, 8)}-0000-${n}${n}`
}

// ---------------------------------------------------------------------------
// Preguntas adicionales (CRUD admin) – datos iniciales
// ---------------------------------------------------------------------------

/**
 * @typedef {{ id: string, texto: string, seccion: string, tipoRespuesta: 'yn'|'texto'|'numero', orden: number, activa: boolean, creadaEn: string, actualizadaEn: string }} PreguntaAdicional
 */

/** @type {PreguntaAdicional[]} */
const preguntasAdicionalesIniciales = [
  {
    id: 'pa000001-0001-0001-0001-000000000001',
    texto: '¿Ha declarado bienes en el extranjero (modelo 720)?',
    seccion: 'Ingresos Extraordinarios e Inversiones',
    tipoRespuesta: 'yn',
    orden: 0,
    activa: true,
    creadaEn: '2025-03-01T10:00:00.000Z',
    actualizadaEn: '2025-03-01T10:00:00.000Z',
  },
  {
    id: 'pa000002-0002-0002-0002-000000000002',
    texto: '¿Ha recibido herencias o donaciones en 2025?',
    seccion: 'Ingresos Extraordinarios e Inversiones',
    tipoRespuesta: 'yn',
    orden: 1,
    activa: true,
    creadaEn: '2025-03-01T10:00:00.000Z',
    actualizadaEn: '2025-03-01T10:00:00.000Z',
  },
  {
    id: 'pa000003-0003-0003-0003-000000000003',
    texto: '¿Cuál es el importe total de ingresos por alquiler en 2025?',
    seccion: 'Situación de Vivienda',
    tipoRespuesta: 'numero',
    orden: 0,
    activa: true,
    creadaEn: '2025-03-15T09:00:00.000Z',
    actualizadaEn: '2025-03-15T09:00:00.000Z',
  },
  {
    id: 'pa000004-0004-0004-0004-000000000004',
    texto: 'Indique el país donde se encuentran los bienes en el extranjero',
    seccion: 'Información Adicional',
    tipoRespuesta: 'texto',
    orden: 0,
    activa: false,
    creadaEn: '2025-04-01T11:00:00.000Z',
    actualizadaEn: '2025-04-01T11:00:00.000Z',
  },
]

/** @type {PreguntaAdicional[]} */
export const preguntasAdicionalesStore = [...preguntasAdicionalesIniciales]

// ---------------------------------------------------------------------------
// Asignaciones declaración ↔ pregunta (many-to-many) – datos iniciales
// ---------------------------------------------------------------------------

/**
 * @typedef {{ id: string, declaracionId: string, preguntaId: string, respuesta: string|null, asignadaEn: string, respondidaEn: string|null }} DeclaracionPregunta
 */

/** @type {DeclaracionPregunta[]} */
const declaracionPreguntaIniciales = [
  // María García López → ¿Ha declarado bienes en el extranjero?
  {
    id: 'dp000001-0001-0001-0001-000000000001',
    declaracionId: 'a1b2c3d4-0001-0001-0001-000000000001',
    preguntaId: 'pa000001-0001-0001-0001-000000000001',
    respuesta: 'si',
    asignadaEn: '2025-04-05T12:00:00.000Z',
    respondidaEn: '2025-04-05T12:00:00.000Z',
  },
  // María García López → ¿Cuál es el importe total de ingresos por alquiler?
  {
    id: 'dp000002-0002-0002-0002-000000000002',
    declaracionId: 'a1b2c3d4-0001-0001-0001-000000000001',
    preguntaId: 'pa000003-0003-0003-0003-000000000003',
    respuesta: null,
    asignadaEn: '2025-04-06T09:00:00.000Z',
    respondidaEn: null,
  },
  // Carlos Martínez Ruiz → ¿Cuál es el importe total de ingresos por alquiler?
  {
    id: 'dp000003-0003-0003-0003-000000000003',
    declaracionId: 'b2c3d4e5-0002-0002-0002-000000000002',
    preguntaId: 'pa000003-0003-0003-0003-000000000003',
    respuesta: '12500',
    asignadaEn: '2025-04-08T10:00:00.000Z',
    respondidaEn: '2025-04-08T10:30:00.000Z',
  },
  // Pedro Fernández González → ¿Ha declarado bienes en el extranjero?
  {
    id: 'dp000004-0004-0004-0004-000000000004',
    declaracionId: 'd4e5f6a7-0004-0004-0004-000000000004',
    preguntaId: 'pa000001-0001-0001-0001-000000000001',
    respuesta: 'no',
    asignadaEn: '2025-04-01T11:00:00.000Z',
    respondidaEn: '2025-04-01T11:00:00.000Z',
  },
  // Pedro Fernández González → ¿Ha recibido herencias o donaciones en 2025?
  {
    id: 'dp000005-0005-0005-0005-000000000005',
    declaracionId: 'd4e5f6a7-0004-0004-0004-000000000004',
    preguntaId: 'pa000002-0002-0002-0002-000000000002',
    respuesta: 'no',
    asignadaEn: '2025-04-01T11:00:00.000Z',
    respondidaEn: '2025-04-01T11:00:00.000Z',
  },
]

/** @type {DeclaracionPregunta[]} */
export const declaracionPreguntaStore = [...declaracionPreguntaIniciales]

let nextPreguntaIdCounter = 5
let nextDpIdCounter = 6

/** Genera un UUID fake para preguntas adicionales. */
export function generarPreguntaId() {
  const n = String(nextPreguntaIdCounter++).padStart(8, '0')
  return `pa${n.slice(0, 6)}-${n.slice(0, 4)}-${n.slice(0, 4)}-${n.slice(0, 4)}-${n}${n}${n}`
}

/** Genera un UUID fake para asignaciones declaración-pregunta. */
export function generarDpId() {
  const n = String(nextDpIdCounter++).padStart(8, '0')
  return `dp${n.slice(0, 6)}-${n.slice(0, 4)}-${n.slice(0, 4)}-${n.slice(0, 4)}-${n}${n}${n}`
}

// ---------------------------------------------------------------------------
// Secciones (CRUD admin) – datos iniciales
// ---------------------------------------------------------------------------

/**
 * @typedef {{ id: string, nombre: string, orden: number, activa: boolean, creadaEn: string, actualizadaEn: string }} Seccion
 */

/** @type {Seccion[]} */
const seccionesIniciales = [
  {
    id: 'sec000001-0001-0001-0001-000000000001',
    nombre: 'Situación de Vivienda',
    orden: 1,
    activa: true,
    creadaEn: '2025-01-01T00:00:00.000Z',
    actualizadaEn: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sec000002-0002-0002-0002-000000000002',
    nombre: 'Cargas Familiares y Ayudas Públicas',
    orden: 2,
    activa: true,
    creadaEn: '2025-01-01T00:00:00.000Z',
    actualizadaEn: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sec000003-0003-0003-0003-000000000003',
    nombre: 'Ingresos Extraordinarios e Inversiones',
    orden: 3,
    activa: true,
    creadaEn: '2025-01-01T00:00:00.000Z',
    actualizadaEn: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sec000004-0004-0004-0004-000000000004',
    nombre: 'Información Adicional',
    orden: 4,
    activa: true,
    creadaEn: '2025-01-01T00:00:00.000Z',
    actualizadaEn: '2025-01-01T00:00:00.000Z',
  },
]

/** @type {Seccion[]} */
export const seccionesStore = [...seccionesIniciales]

let nextSeccionIdCounter = 5

/** Genera un UUID fake para secciones. */
export function generarSeccionId() {
  const n = String(nextSeccionIdCounter++).padStart(8, '0')
  return `sec${n.slice(0, 5)}-${n.slice(0, 4)}-${n.slice(0, 4)}-${n.slice(0, 4)}-${n}${n}${n}`
}
