-- =============================================================
--  Renta Form – Migración 003: columnas de sección en preguntas
-- =============================================================
-- Añade las columnas seccion, seccion_orden y seccion_titulos a la
-- tabla preguntas si no existen, y rellena los datos iniciales.

BEGIN;

-- 1. Añadir columnas faltantes (idempotente)
ALTER TABLE preguntas
    ADD COLUMN IF NOT EXISTS campo           VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS seccion         VARCHAR(50)  NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS seccion_orden   INTEGER      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seccion_titulos JSONB        NOT NULL DEFAULT '{}';

-- Garantizar unicidad en campo (por si la restricción no existía)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'preguntas'::regclass AND conname = 'preguntas_campo_key'
    ) THEN
        ALTER TABLE preguntas ADD CONSTRAINT preguntas_campo_key UNIQUE (campo);
    END IF;
END $$;

-- 2. Insertar / actualizar preguntas con datos de sección
INSERT INTO preguntas (campo, texto, orden, seccion, seccion_orden, seccion_titulos) VALUES
    -- Sección 1: Situación de Vivienda (seccion_orden = 0)
    ('viviendaAlquiler',
     '{"es": "¿Vive de alquiler?", "fr": "Vivez-vous en location ?", "ca": "Viu de lloguer?", "en": "Do you live in a rental?"}',
     1, 'seccion-vivienda', 0,
     '{"es": "Situación de Vivienda", "fr": "Situation de logement", "ca": "Situació d''habitatge", "en": "Housing Situation"}'),
    ('alquilerMenos35',
     '{"es": "¿El importe del alquiler es inferior al 35 % de los ingresos?", "fr": "Le montant du loyer est-il inférieur à 35 % des revenus ?", "ca": "L''import del lloguer és inferior al 35 % dels ingressos?", "en": "Is the rent amount less than 35% of your income?"}',
     2, 'seccion-vivienda', 0,
     '{"es": "Situación de Vivienda", "fr": "Situation de logement", "ca": "Situació d''habitatge", "en": "Housing Situation"}'),
    ('viviendaPropiedad',
     '{"es": "¿Es propietario de su vivienda habitual?", "fr": "Êtes-vous propriétaire de votre résidence principale ?", "ca": "És propietari del seu habitatge habitual?", "en": "Do you own your primary residence?"}',
     3, 'seccion-vivienda', 0,
     '{"es": "Situación de Vivienda", "fr": "Situation de logement", "ca": "Situació d''habitatge", "en": "Housing Situation"}'),
    ('propiedadAntes2013',
     '{"es": "¿Adquirió la vivienda antes de 2013?", "fr": "Avez-vous acquis le logement avant 2013 ?", "ca": "Va adquirir l''habitatge abans de 2013?", "en": "Did you purchase the property before 2013?"}',
     4, 'seccion-vivienda', 0,
     '{"es": "Situación de Vivienda", "fr": "Situation de logement", "ca": "Situació d''habitatge", "en": "Housing Situation"}'),
    ('pisosAlquiladosTerceros',
     '{"es": "¿Tiene pisos alquilados a terceros?", "fr": "Avez-vous des appartements loués à des tiers ?", "ca": "Té pisos llogats a tercers?", "en": "Do you have properties rented to third parties?"}',
     5, 'seccion-vivienda', 0,
     '{"es": "Situación de Vivienda", "fr": "Situation de logement", "ca": "Situació d''habitatge", "en": "Housing Situation"}'),
    ('segundaResidencia',
     '{"es": "¿Posee una segunda residencia?", "fr": "Possédez-vous une résidence secondaire ?", "ca": "Posseeix una segona residència?", "en": "Do you own a second residence?"}',
     6, 'seccion-vivienda', 0,
     '{"es": "Situación de Vivienda", "fr": "Situation de logement", "ca": "Situació d''habitatge", "en": "Housing Situation"}'),

    -- Sección 2: Cargas familiares y ayudas públicas (seccion_orden = 1)
    ('familiaNumerosa',
     '{"es": "¿Es familia numerosa?", "fr": "Êtes-vous une famille nombreuse ?", "ca": "És família nombrosa?", "en": "Are you a large family?"}',
     1, 'seccion-familia', 1,
     '{"es": "Cargas familiares y ayudas públicas", "fr": "Charges familiales et aides publiques", "ca": "Càrregues familiars i ajudes públiques", "en": "Family Charges and Public Aid"}'),
    ('ayudasGobierno',
     '{"es": "¿Ha recibido ayudas del Gobierno?", "fr": "Avez-vous reçu des aides du gouvernement ?", "ca": "Ha rebut ajudes del Govern?", "en": "Have you received government grants?"}',
     2, 'seccion-familia', 1,
     '{"es": "Cargas familiares y ayudas públicas", "fr": "Charges familiales et aides publiques", "ca": "Càrregues familiars i ajudes públiques", "en": "Family Charges and Public Aid"}'),
    ('mayores65ACargo',
     '{"es": "¿Tiene mayores de 65 años a su cargo?", "fr": "Avez-vous des personnes de plus de 65 ans à votre charge ?", "ca": "Té majors de 65 anys al seu càrrec?", "en": "Do you have dependants over 65?"}',
     3, 'seccion-familia', 1,
     '{"es": "Cargas familiares y ayudas públicas", "fr": "Charges familiales et aides publiques", "ca": "Càrregues familiars i ajudes públiques", "en": "Family Charges and Public Aid"}'),
    ('mayoresConviven',
     '{"es": "¿Conviven con usted?", "fr": "Vivent-ils avec vous ?", "ca": "Conviuen amb vostè?", "en": "Do they live with you?"}',
     4, 'seccion-familia', 1,
     '{"es": "Cargas familiares y ayudas públicas", "fr": "Charges familiales et aides publiques", "ca": "Càrregues familiars i ajudes públiques", "en": "Family Charges and Public Aid"}'),
    ('hijosMenores26',
     '{"es": "¿Tiene hijos menores de 26 años?", "fr": "Avez-vous des enfants de moins de 26 ans ?", "ca": "Té fills menors de 26 anys?", "en": "Do you have children under 26?"}',
     5, 'seccion-familia', 1,
     '{"es": "Cargas familiares y ayudas públicas", "fr": "Charges familiales et aides publiques", "ca": "Càrregues familiars i ajudes públiques", "en": "Family Charges and Public Aid"}'),

    -- Sección 3: Ingresos extraordinarios e inversiones (seccion_orden = 2)
    ('ingresosJuego',
     '{"es": "¿Ha tenido ganancias procedentes del juego?", "fr": "Avez-vous eu des gains provenant de jeux ?", "ca": "Ha tingut guanys procedents del joc?", "en": "Have you had gambling winnings?"}',
     1, 'seccion-ingresos', 2,
     '{"es": "Ingresos extraordinarios e inversiones", "fr": "Revenus extraordinaires et investissements", "ca": "Ingressos extraordinaris i inversions", "en": "Extraordinary Income and Investments"}'),
    ('ingresosInversiones',
     '{"es": "¿Ha obtenido rendimientos de capital mobiliario o inversiones?", "fr": "Avez-vous obtenu des revenus de capitaux mobiliers ou investissements ?", "ca": "Ha obtingut rendiments de capital mobiliari o inversions?", "en": "Have you earned income from investments or securities?"}',
     2, 'seccion-ingresos', 2,
     '{"es": "Ingresos extraordinarios e inversiones", "fr": "Revenus extraordinaires et investissements", "ca": "Ingressos extraordinaris i inversions", "en": "Extraordinary Income and Investments"}')
ON CONFLICT (campo) DO UPDATE SET
    texto           = EXCLUDED.texto,
    orden           = EXCLUDED.orden,
    seccion         = EXCLUDED.seccion,
    seccion_orden   = EXCLUDED.seccion_orden,
    seccion_titulos = EXCLUDED.seccion_titulos;

COMMIT;
