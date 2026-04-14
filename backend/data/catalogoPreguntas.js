'use strict'

// ---------------------------------------------------------------------------
//  Static catalogue of form questions used by the DB service.
// ---------------------------------------------------------------------------

const CATALOGO_PREGUNTAS = {
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
        },
      ],
    },
  ],
}

module.exports = { CATALOGO_PREGUNTAS }
