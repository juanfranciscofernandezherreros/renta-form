'use strict'

// ---------------------------------------------------------------------------
// seedPreguntas.js – Demo seed for the dynamic question catalogue.
//
// The DB is the canonical source for questions; this script just populates
// 14 sensible defaults so the form is not empty after a fresh deploy.
// Admins can freely add/edit/delete questions afterwards via the API.
// Idempotent: ON CONFLICT (campo) DO UPDATE.
// ---------------------------------------------------------------------------

const pool = require('./pool')
const migrate = require('./migrate')

const DEMO_PREGUNTAS = [
  // ── Vivienda ─────────────────────────────────────────────────────────────
  { campo: 'viviendaAlquiler',         orden: 1,  texto: { es: '¿Vives de alquiler?',                                                                                                    fr: 'Vivez-vous en location?',                                                                                         ca: 'Vius de lloguer?',                                                                                              en: 'Do you live in a rented home?' } },
  { campo: 'alquilerMenos35',          orden: 2,  texto: { es: 'En caso afirmativo, ¿tienes menos de 35 años?',                                                                          fr: 'Si oui, avez-vous moins de 35 ans?',                                                                              ca: 'En cas afirmatiu, tens menys de 35 anys?',                                                                      en: 'If yes, are you under 35 years old?' } },
  { campo: 'viviendaPropiedad',        orden: 3,  texto: { es: '¿Tu vivienda habitual es de propiedad?',                                                                                 fr: 'Votre résidence habituelle est-elle en propriété?',                                                               ca: 'El teu habitatge habitual és de propietat?',                                                                    en: 'Is your main home owner-occupied?' } },
  { campo: 'propiedadAntes2013',       orden: 4,  texto: { es: 'En caso afirmativo, ¿La compraste antes del año 2013?',                                                                  fr: "Si oui, l'avez-vous achetée avant l'année 2013?",                                                                 ca: "En cas afirmatiu, la vas comprar abans de l'any 2013?",                                                         en: 'If yes, did you buy it before 2013?' } },
  { campo: 'pisosAlquiladosTerceros',  orden: 5,  texto: { es: '¿Tienes pisos de propiedad alquilados?',                                                                                 fr: 'Avez-vous des appartements en propriété loués?',                                                                  ca: 'Tens pisos de propietat llogats?',                                                                              en: 'Do you have owned apartments that you rent out?' } },
  { campo: 'segundaResidencia',        orden: 6,  texto: { es: '¿Tienes una segunda vivienda para tu propio uso y disfrute?',                                                            fr: 'Avez-vous une deuxième résidence pour votre usage personnel?',                                                    ca: 'Tens un segon habitatge per al teu ús i gaudi?',                                                                en: 'Do you have a second home for your own use and enjoyment?' } },
  // ── Ayudas y Familia ─────────────────────────────────────────────────────
  { campo: 'ayudasGobierno',           orden: 7,  texto: { es: '¿Has recibido alguna ayuda del gobierno durante el año 2025?',                                                           fr: 'Avez-vous reçu des aides du gouvernement en 2025?',                                                               ca: "Has rebut alguna ajuda del govern durant l'any 2025?",                                                          en: 'Have you received any government aid during 2025?' } },
  { campo: 'familiaNumerosa',          orden: 8,  texto: { es: '¿Eres una familia numerosa?',                                                                                            fr: 'Êtes-vous une famille nombreuse?',                                                                                ca: 'Ets una família nombrosa?',                                                                                     en: 'Are you a large family?' } },
  { campo: 'mayores65ACargo',          orden: 9,  texto: { es: '¿Tienes personas mayores de 65 años a tu cargo?',                                                                        fr: 'Avez-vous des personnes de plus de 65 ans à votre charge?',                                                       ca: 'Tens persones majors de 65 anys a càrrec teu?',                                                                 en: 'Do you have dependents over 65 years old?' } },
  { campo: 'mayoresConviven',          orden: 10, texto: { es: 'En caso afirmativo ¿Viven contigo en el mismo domicilio?',                                                               fr: 'Si oui, vivent-ils avec vous au même domicile?',                                                                  ca: 'En cas afirmatiu, viuen amb tu al mateix domicili?',                                                            en: 'If yes, do they live with you at the same address?' } },
  { campo: 'hijosMenores26',           orden: 11, texto: { es: '¿Tienes hijos menores de 26 años a tu cargo?',                                                                           fr: 'Avez-vous des enfants de moins de 26 ans à votre charge?',                                                        ca: 'Tens fills menors de 26 anys a càrrec teu?',                                                                    en: 'Do you have children under 26 years old in your care?' } },
  { campo: 'hijosConviven',            orden: 12, texto: { es: 'En caso afirmativo, ¿Viven contigo en el mismo domicilio?',                                                              fr: 'Si oui, vivent-ils avec vous au même domicile?',                                                                  ca: 'En cas afirmatiu, viuen amb tu al mateix domicili?',                                                            en: 'If yes, do they live with you at the same address?' } },
  // ── Ingresos ─────────────────────────────────────────────────────────────
  { campo: 'ingresosJuego',            orden: 13, texto: { es: '¿Has recibido ingresos durante el año 2025 procedentes del juego o apuestas?',                                           fr: 'Avez-vous reçu des revenus de jeux ou de paris en 2025?',                                                         ca: "Has rebut ingressos durant l'any 2025 procedents del joc o apostes?",                                           en: 'Have you received income from gambling or betting during 2025?' } },
  { campo: 'ingresosInversiones',      orden: 14, texto: { es: '¿Has recibido ingresos durante el año 2025 procedentes de depósitos bancarios, fondos de inversión, bolsa o similares?', fr: "Avez-vous reçu des revenus de dépôts bancaires, fonds d'investissement, bourse ou similaires en 2025?",         ca: "Has rebut ingressos durant l'any 2025 procedents de dipòsits bancaris, fons d'inversió, borsa o similars?",    en: 'Have you received income from bank deposits, investment funds, stock market or similar during 2025?' } },
]

async function seedPreguntas(client) {
  const useLocalClient = !client
  if (useLocalClient) {
    client = await pool.connect()
  }

  try {
    console.log('[seedPreguntas] Seeding demo preguntas...')
    for (const p of DEMO_PREGUNTAS) {
      await client.query(
        `INSERT INTO preguntas (campo, orden, texto)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (campo) DO UPDATE
           SET orden = EXCLUDED.orden,
               texto = EXCLUDED.texto`,
        [p.campo, p.orden, JSON.stringify(p.texto)]
      )
    }
    console.log(`[seedPreguntas] ${DEMO_PREGUNTAS.length} preguntas seeded.`)
  } finally {
    if (useLocalClient) {
      client.release()
    }
  }
}

module.exports = seedPreguntas
module.exports.DEMO_PREGUNTAS = DEMO_PREGUNTAS

// Allow running directly: node db/seedPreguntas.js
if (require.main === module) {
  migrate()
    .then(() => seedPreguntas())
    .then(() => {
      console.log('[seedPreguntas] Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seedPreguntas] Failed:', err)
      process.exit(1)
    })
}
