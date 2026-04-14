-- =============================================================
--  Renta Form – PostgreSQL Schema
--  Campaña de la Renta 2025 · IRPF
--
--  Tablas: declaraciones, usuarios, preguntas
--  Compatible con PostgreSQL 14+.
-- =============================================================

-- -------------------------------------------------------------
-- Extensiones
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- -------------------------------------------------------------
-- Tipos enumerados
-- -------------------------------------------------------------

-- Respuesta a preguntas de tipo Sí / No
CREATE TYPE respuesta_yn AS ENUM ('si', 'no');

-- Estado del expediente
CREATE TYPE estado_expediente AS ENUM (
    'recibido',
    'en_revision',
    'documentacion_pendiente',
    'completado',
    'archivado'
);

-- -------------------------------------------------------------
-- Función compartida: actualizar columna actualizado_en
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

-- =============================================================
--  TABLA: declaraciones
--  Cada fila representa un cuestionario enviado
-- =============================================================
CREATE TABLE IF NOT EXISTS declaraciones (
    id                        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en                 TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    estado                    estado_expediente NOT NULL DEFAULT 'recibido',

    -- Datos de Identificación
    nombre                    VARCHAR(100)      NOT NULL,
    apellidos                 VARCHAR(200)      NOT NULL,
    dni_nie                   VARCHAR(9)        NOT NULL,
    email                     VARCHAR(254)      NOT NULL,
    telefono                  VARCHAR(20)       NOT NULL,

    -- Situación de Vivienda
    vivienda_alquiler         respuesta_yn      NOT NULL,
    alquiler_menos_35         respuesta_yn,
    vivienda_propiedad        respuesta_yn      NOT NULL,
    propiedad_antes_2013      respuesta_yn,
    pisos_alquilados_terceros respuesta_yn      NOT NULL,
    segunda_residencia        respuesta_yn      NOT NULL,

    -- Cargas Familiares y Ayudas Públicas
    familia_numerosa          respuesta_yn      NOT NULL,
    ayudas_gobierno           respuesta_yn      NOT NULL,
    mayores_65_a_cargo        respuesta_yn      NOT NULL,
    mayores_conviven          respuesta_yn,
    hijos_menores_26          respuesta_yn      NOT NULL,

    -- Ingresos Extraordinarios e Inversiones
    ingresos_juego            respuesta_yn      NOT NULL,
    ingresos_inversiones      respuesta_yn      NOT NULL,

    CONSTRAINT chk_alquiler_menos_35
        CHECK (vivienda_alquiler = 'si' OR alquiler_menos_35 IS NULL),
    CONSTRAINT chk_propiedad_antes_2013
        CHECK (vivienda_propiedad = 'si' OR propiedad_antes_2013 IS NULL),
    CONSTRAINT chk_mayores_conviven
        CHECK (mayores_65_a_cargo = 'si' OR mayores_conviven IS NULL),
    CONSTRAINT chk_dni_nie_formato
        CHECK (dni_nie ~ '^[0-9XYZ][0-9]{7}[A-Z]$'),
    CONSTRAINT chk_email_formato
        CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT uq_declaraciones_dni_nie UNIQUE (dni_nie)
);

CREATE INDEX IF NOT EXISTS idx_declaraciones_email    ON declaraciones (email);
CREATE INDEX IF NOT EXISTS idx_declaraciones_estado   ON declaraciones (estado);
CREATE INDEX IF NOT EXISTS idx_declaraciones_creado_en ON declaraciones (creado_en DESC);

CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
BEFORE UPDATE ON declaraciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: usuarios
--  Credenciales y metadatos de los usuarios registrados
-- =============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_nie             VARCHAR(9)   NOT NULL UNIQUE,
    nombre              VARCHAR(100) NOT NULL,
    apellidos           VARCHAR(200) NOT NULL DEFAULT '',
    email               VARCHAR(254) NOT NULL,
    telefono            VARCHAR(20)  NOT NULL DEFAULT '',
    role                VARCHAR(20)  NOT NULL DEFAULT 'user',
    password_hash       TEXT         NOT NULL,
    bloqueado           BOOLEAN      NOT NULL DEFAULT FALSE,
    denunciado          BOOLEAN      NOT NULL DEFAULT FALSE,
    preguntas_asignadas JSONB        NOT NULL DEFAULT '[]',
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_dni_nie ON usuarios (dni_nie);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios (email);

-- =============================================================
--  TABLA: preguntas
--  Preguntas Sí/No del formulario, gestionables desde el panel
-- =============================================================
CREATE TABLE IF NOT EXISTS preguntas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campo          VARCHAR(100) NOT NULL DEFAULT '',
    texto          TEXT         NOT NULL,
    textos         JSONB        NOT NULL DEFAULT '{}',
    seccion        TEXT         NOT NULL DEFAULT '',
    seccion_orden  INTEGER      NOT NULL DEFAULT 0,
    seccion_titulos JSONB       NOT NULL DEFAULT '{}',
    orden          INTEGER      NOT NULL DEFAULT 0,
    actualizada_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_seccion ON preguntas (seccion);

CREATE OR REPLACE TRIGGER trg_preguntas_actualizado_en
BEFORE UPDATE ON preguntas
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  DATOS DE SEED
-- =============================================================

-- Preguntas del formulario
INSERT INTO preguntas (campo, texto, textos, seccion, seccion_orden, seccion_titulos, orden) VALUES
    ('viviendaAlquiler',
     '¿Vive actualmente en régimen de alquiler?',
     '{"es":"¿Vive actualmente en régimen de alquiler?","fr":"Vivez-vous actuellement en location ?","en":"Do you currently live in rented accommodation?","ca":"Viu actualment en règim de lloguer?"}',
     'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}',
     1),
    ('alquilerMenos35',
     '¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',
     '{"es":"¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?","fr":"Le montant du loyer est-il inférieur à 35 % de vos revenus bruts annuels ?","en":"Is the rent amount less than 35% of your annual gross income?","ca":"L''import del lloguer és inferior al 35 % dels seus ingressos bruts anuals?"}',
     'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}',
     2),
    ('viviendaPropiedad',
     '¿Es propietario/a de su vivienda habitual?',
     '{"es":"¿Es propietario/a de su vivienda habitual?","fr":"Êtes-vous propriétaire de votre résidence principale ?","en":"Do you own your primary residence?","ca":"És propietari/ària del seu habitatge habitual?"}',
     'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}',
     3),
    ('propiedadAntes2013',
     '¿La adquirió antes del 1 de enero de 2013?',
     '{"es":"¿La adquirió antes del 1 de enero de 2013?","fr":"L''avez-vous acquise avant le 1er janvier 2013 ?","en":"Did you acquire it before 1 January 2013?","ca":"La va adquirir abans del 1 de gener de 2013?"}',
     'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}',
     4),
    ('pisosAlquiladosTerceros',
     '¿Tiene inmuebles arrendados a terceros?',
     '{"es":"¿Tiene inmuebles arrendados a terceros?","fr":"Avez-vous des biens immobiliers loués à des tiers ?","en":"Do you have properties rented out to third parties?","ca":"Té immobles arrendats a tercers?"}',
     'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}',
     5),
    ('segundaResidencia',
     '¿Dispone de una segunda residencia?',
     '{"es":"¿Dispone de una segunda residencia?","fr":"Disposez-vous d''une résidence secondaire ?","en":"Do you have a second residence?","ca":"Disposa d''una segona residència?"}',
     'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}',
     6),
    ('familiaNumerosa',
     '¿Pertenece a una familia numerosa?',
     '{"es":"¿Pertenece a una familia numerosa?","fr":"Appartenez-vous à une famille nombreuse ?","en":"Do you belong to a large family?","ca":"Pertany a una família nombrosa?"}',
     'familia', 2,
     '{"es":"Cargas Familiares y Ayudas Públicas","fr":"Charges Familiales et Aides Publiques","en":"Family Obligations and Public Benefits","ca":"Càrregues Familiars i Ajudes Públiques"}',
     1),
    ('ayudasGobierno',
     '¿Ha recibido ayudas o subvenciones públicas en 2025?',
     '{"es":"¿Ha recibido ayudas o subvenciones públicas en 2025?","fr":"Avez-vous reçu des aides ou subventions publiques en 2025 ?","en":"Have you received public grants or subsidies in 2025?","ca":"Ha rebut ajudes o subvencions públiques el 2025?"}',
     'familia', 2,
     '{"es":"Cargas Familiares y Ayudas Públicas","fr":"Charges Familiales et Aides Publiques","en":"Family Obligations and Public Benefits","ca":"Càrregues Familiars i Ajudes Públiques"}',
     2),
    ('mayores65ACargo',
     '¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',
     '{"es":"¿Tiene ascendientes mayores de 65 años económicamente a su cargo?","fr":"Avez-vous des ascendants de plus de 65 ans économiquement à votre charge ?","en":"Do you have financial dependants over 65 years old?","ca":"Té ascendents majors de 65 anys econòmicament a càrrec seu?"}',
     'familia', 2,
     '{"es":"Cargas Familiares y Ayudas Públicas","fr":"Charges Familiales et Aides Publiques","en":"Family Obligations and Public Benefits","ca":"Càrregues Familiars i Ajudes Públiques"}',
     3),
    ('mayoresConviven',
     '¿Conviven con usted en el mismo domicilio?',
     '{"es":"¿Conviven con usted en el mismo domicilio?","fr":"Cohabitent-ils avec vous au même domicile ?","en":"Do they live with you at the same address?","ca":"Conviuen amb vostè en el mateix domicili?"}',
     'familia', 2,
     '{"es":"Cargas Familiares y Ayudas Públicas","fr":"Charges Familiales et Aides Publiques","en":"Family Obligations and Public Benefits","ca":"Càrregues Familiars i Ajudes Públiques"}',
     4),
    ('hijosMenores26',
     '¿Tiene hijos o descendientes menores de 26 años a su cargo?',
     '{"es":"¿Tiene hijos o descendientes menores de 26 años a su cargo?","fr":"Avez-vous des enfants ou descendants de moins de 26 ans à votre charge ?","en":"Do you have children or dependants under 26 years old?","ca":"Té fills o descendents menors de 26 anys a càrrec seu?"}',
     'familia', 2,
     '{"es":"Cargas Familiares y Ayudas Públicas","fr":"Charges Familiales et Aides Publiques","en":"Family Obligations and Public Benefits","ca":"Càrregues Familiars i Ajudes Públiques"}',
     5),
    ('ingresosJuego',
     '¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',
     '{"es":"¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?","fr":"Avez-vous obtenu des gains par jeux, loteries ou paris en 2025 ?","en":"Have you obtained winnings from gambling, lotteries or betting in 2025?","ca":"Ha obtingut guanys per joc, loteries o apostes el 2025?"}',
     'ingresos', 3,
     '{"es":"Ingresos Extraordinarios e Inversiones","fr":"Revenus Extraordinaires et Investissements","en":"Extraordinary Income and Investments","ca":"Ingressos Extraordinaris i Inversions"}',
     1),
    ('ingresosInversiones',
     '¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',
     '{"es":"¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?","fr":"Avez-vous obtenu des rendements de capital mobilier (actions, fonds d''investissement, etc.) en 2025 ?","en":"Have you obtained income from movable capital (shares, investment funds, etc.) in 2025?","ca":"Ha obtingut rendiments de capital mobiliari (accions, fons d''inversió, etc.) el 2025?"}',
     'ingresos', 3,
     '{"es":"Ingresos Extraordinarios e Inversiones","fr":"Revenus Extraordinaires et Investissements","en":"Extraordinary Income and Investments","ca":"Ingressos Extraordinaris i Inversions"}',
     2)
ON CONFLICT DO NOTHING;

-- Usuario administrador por defecto (contraseña: admin, bcrypt cost 12)
-- Cambiar en producción con POST /v1/auth/change-password
INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash) VALUES
    ('ADMIN', 'Administrador', '', 'admin@renta-form.local', '', 'admin',
     '$2b$12$a3QpSIVIiYpVQuwcWtYIbO.5/VbAKdDNClFrl0WTe4GVN7sjA0ruW')
ON CONFLICT (dni_nie) DO NOTHING;
