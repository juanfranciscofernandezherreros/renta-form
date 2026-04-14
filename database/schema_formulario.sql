-- =============================================================
--  Renta Form – Schema for editable main form yes/no questions
--  Run AFTER schema_backend.sql (needs secciones table)
-- =============================================================

-- Yes/no questions that admins can manage from the admin panel
CREATE TABLE IF NOT EXISTS preguntas (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    campo           VARCHAR(100)    NOT NULL DEFAULT '',
    texto           TEXT            NOT NULL,
    textos          JSONB           NOT NULL DEFAULT '{}',
    seccion_id      UUID            REFERENCES secciones (id) ON DELETE SET NULL,
    orden           INTEGER         NOT NULL DEFAULT 0,
    actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_preguntas_actualizado_en
BEFORE UPDATE ON preguntas
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- ── Seed data ─────────────────────────────────────────────────────────────

INSERT INTO preguntas (campo, texto, textos, seccion_id, orden)
SELECT seed.campo, seed.texto, seed.textos::jsonb, s.id, seed.orden
FROM (VALUES
    ('viviendaAlquiler',
     '¿Vive actualmente en régimen de alquiler?',
     '{"es":"¿Vive actualmente en régimen de alquiler?","fr":"Vivez-vous actuellement en location ?","en":"Do you currently live in rented accommodation?","ca":"Viu actualment en règim de lloguer?"}',
     'Situación de Vivienda', 1),
    ('alquilerMenos35',
     '¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',
     '{"es":"¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?","fr":"Le montant du loyer est-il inférieur à 35 % de vos revenus bruts annuels ?","en":"Is the rent amount less than 35% of your annual gross income?","ca":"L''import del lloguer és inferior al 35 % dels seus ingressos bruts anuals?"}',
     'Situación de Vivienda', 2),
    ('viviendaPropiedad',
     '¿Es propietario/a de su vivienda habitual?',
     '{"es":"¿Es propietario/a de su vivienda habitual?","fr":"Êtes-vous propriétaire de votre résidence principale ?","en":"Do you own your primary residence?","ca":"És propietari/ària del seu habitatge habitual?"}',
     'Situación de Vivienda', 3),
    ('propiedadAntes2013',
     '¿La adquirió antes del 1 de enero de 2013?',
     '{"es":"¿La adquirió antes del 1 de enero de 2013?","fr":"L''avez-vous acquise avant le 1er janvier 2013 ?","en":"Did you acquire it before 1 January 2013?","ca":"La va adquirir abans del 1 de gener de 2013?"}',
     'Situación de Vivienda', 4),
    ('pisosAlquiladosTerceros',
     '¿Tiene inmuebles arrendados a terceros?',
     '{"es":"¿Tiene inmuebles arrendados a terceros?","fr":"Avez-vous des biens immobiliers loués à des tiers ?","en":"Do you have properties rented out to third parties?","ca":"Té immobles arrendats a tercers?"}',
     'Situación de Vivienda', 5),
    ('segundaResidencia',
     '¿Dispone de una segunda residencia?',
     '{"es":"¿Dispone de una segunda residencia?","fr":"Disposez-vous d''une résidence secondaire ?","en":"Do you have a second residence?","ca":"Disposa d''una segona residència?"}',
     'Situación de Vivienda', 6),
    ('familiaNumerosa',
     '¿Pertenece a una familia numerosa?',
     '{"es":"¿Pertenece a una familia numerosa?","fr":"Appartenez-vous à une famille nombreuse ?","en":"Do you belong to a large family?","ca":"Pertany a una família nombrosa?"}',
     'Cargas Familiares y Ayudas Públicas', 1),
    ('ayudasGobierno',
     '¿Ha recibido ayudas o subvenciones públicas en 2025?',
     '{"es":"¿Ha recibido ayudas o subvenciones públicas en 2025?","fr":"Avez-vous reçu des aides ou subventions publiques en 2025 ?","en":"Have you received public grants or subsidies in 2025?","ca":"Ha rebut ajudes o subvencions públiques el 2025?"}',
     'Cargas Familiares y Ayudas Públicas', 2),
    ('mayores65ACargo',
     '¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',
     '{"es":"¿Tiene ascendientes mayores de 65 años económicamente a su cargo?","fr":"Avez-vous des ascendants de plus de 65 ans économiquement à votre charge ?","en":"Do you have financial dependants over 65 years old?","ca":"Té ascendents majors de 65 anys econòmicament a càrrec seu?"}',
     'Cargas Familiares y Ayudas Públicas', 3),
    ('mayoresConviven',
     '¿Conviven con usted en el mismo domicilio?',
     '{"es":"¿Conviven con usted en el mismo domicilio?","fr":"Cohabitent-ils avec vous au même domicile ?","en":"Do they live with you at the same address?","ca":"Conviuen amb vostè en el mateix domicili?"}',
     'Cargas Familiares y Ayudas Públicas', 4),
    ('hijosMenores26',
     '¿Tiene hijos o descendientes menores de 26 años a su cargo?',
     '{"es":"¿Tiene hijos o descendientes menores de 26 años a su cargo?","fr":"Avez-vous des enfants ou descendants de moins de 26 ans à votre charge ?","en":"Do you have children or dependants under 26 years old?","ca":"Té fills o descendents menors de 26 anys a càrrec seu?"}',
     'Cargas Familiares y Ayudas Públicas', 5),
    ('ingresosJuego',
     '¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',
     '{"es":"¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?","fr":"Avez-vous obtenu des gains par jeux, loteries ou paris en 2025 ?","en":"Have you obtained winnings from gambling, lotteries or betting in 2025?","ca":"Ha obtingut guanys per joc, loteries o apostes el 2025?"}',
     'Ingresos Extraordinarios e Inversiones', 1),
    ('ingresosInversiones',
     '¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',
     '{"es":"¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?","fr":"Avez-vous obtenu des rendements de capital mobilier (actions, fonds d''investissement, etc.) en 2025 ?","en":"Have you obtained income from movable capital (shares, investment funds, etc.) in 2025?","ca":"Ha obtingut rendiments de capital mobiliari (accions, fons d''inversió, etc.) el 2025?"}',
     'Ingresos Extraordinarios e Inversiones', 2)
) AS seed(campo, texto, textos, seccion_nombre, orden)
JOIN secciones s ON s.nombre = seed.seccion_nombre;
