-- =============================================================
--  Renta Form – PostgreSQL Schema completo
--  Campaña de la Renta 2025 · IRPF
--
--  Ejecutar este fichero único para inicializar la base de datos.
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

-- Tipo de documento adjunto
CREATE TYPE tipo_documento AS ENUM (
    'dni_anverso',
    'dni_reverso',
    'adicional'
);

-- -------------------------------------------------------------
-- Función compartida: actualizar columna actualizado_en
-- (usada por varios triggers a continuación)
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
    -- Clave primaria
    id                      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auditoría
    creado_en               TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    estado                  estado_expediente NOT NULL DEFAULT 'recibido',

    -- 1. Datos de Identificación
    nombre                  VARCHAR(100)      NOT NULL,
    apellidos               VARCHAR(200)      NOT NULL,
    dni_nie                 VARCHAR(9)        NOT NULL,
    email                   VARCHAR(254)      NOT NULL,
    telefono                VARCHAR(20)       NOT NULL,

    -- 2. Situación de Vivienda
    vivienda_alquiler       respuesta_yn      NOT NULL,
    alquiler_menos_35       respuesta_yn,               -- solo si vivienda_alquiler = 'si'
    vivienda_propiedad      respuesta_yn      NOT NULL,
    propiedad_antes_2013    respuesta_yn,               -- solo si vivienda_propiedad = 'si'
    pisos_alquilados_terceros respuesta_yn    NOT NULL,
    segunda_residencia      respuesta_yn      NOT NULL,

    -- 3. Cargas Familiares y Ayudas Públicas
    familia_numerosa        respuesta_yn      NOT NULL,
    ayudas_gobierno         respuesta_yn      NOT NULL,
    mayores_65_a_cargo      respuesta_yn      NOT NULL,
    mayores_conviven        respuesta_yn,               -- solo si mayores_65_a_cargo = 'si'
    hijos_menores_26        respuesta_yn      NOT NULL,

    -- 4. Ingresos Extraordinarios e Inversiones
    ingresos_juego          respuesta_yn      NOT NULL,
    ingresos_inversiones    respuesta_yn      NOT NULL,

    -- Restricciones de integridad
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

CREATE INDEX IF NOT EXISTS idx_declaraciones_email
    ON declaraciones (email);

CREATE INDEX IF NOT EXISTS idx_declaraciones_estado
    ON declaraciones (estado);

CREATE INDEX IF NOT EXISTS idx_declaraciones_creado_en
    ON declaraciones (creado_en DESC);

CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
BEFORE UPDATE ON declaraciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: documentos
--  Metadatos de archivos adjuntos a una declaración.
--  El binario puede guardarse en la columna contenido (bytea)
--  o en almacenamiento externo (S3, GCS…) usando la columna url.
-- =============================================================
CREATE TABLE IF NOT EXISTS documentos (
    id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    declaracion_id      UUID           NOT NULL
                            REFERENCES declaraciones (id)
                            ON DELETE CASCADE,

    tipo                tipo_documento NOT NULL,
    nombre_original     VARCHAR(255)   NOT NULL,
    mime_type           VARCHAR(100)   NOT NULL,
    tamanyo_bytes       BIGINT         NOT NULL CHECK (tamanyo_bytes > 0),

    -- URL de almacenamiento externo (S3, GCS, etc.)
    url                 TEXT,

    -- Almacenamiento local (máx. 5 MB según el formulario)
    contenido           BYTEA,

    subido_en           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_doc_storage
        CHECK (url IS NOT NULL OR contenido IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_documentos_declaracion
    ON documentos (declaracion_id);

CREATE INDEX IF NOT EXISTS idx_documentos_tipo
    ON documentos (tipo);

-- =============================================================
--  TABLA: notas_expediente
--  Notas internas del gestor sobre el expediente
-- =============================================================
CREATE TABLE IF NOT EXISTS notas_expediente (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    declaracion_id  UUID        NOT NULL
                        REFERENCES declaraciones (id)
                        ON DELETE CASCADE,
    autor           VARCHAR(100),
    nota            TEXT        NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_declaracion
    ON notas_expediente (declaracion_id);

-- =============================================================
--  TABLA: historial_estado
--  Auditoría de cambios de estado del expediente
-- =============================================================
CREATE TABLE IF NOT EXISTS historial_estado (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    declaracion_id  UUID              NOT NULL
                        REFERENCES declaraciones (id)
                        ON DELETE CASCADE,
    estado_anterior estado_expediente,
    estado_nuevo    estado_expediente NOT NULL,
    cambiado_por    VARCHAR(100),
    cambiado_en     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_declaracion
    ON historial_estado (declaracion_id);

-- Trigger: registrar cambio de estado automáticamente
CREATE OR REPLACE FUNCTION fn_registrar_cambio_estado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO historial_estado (declaracion_id, estado_anterior, estado_nuevo)
        VALUES (NEW.id, OLD.estado, NEW.estado);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_declaraciones_estado
AFTER UPDATE ON declaraciones
FOR EACH ROW EXECUTE FUNCTION fn_registrar_cambio_estado();

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
    secciones_asignadas JSONB        NOT NULL DEFAULT '[]',
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_dni_nie ON usuarios (dni_nie);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios (email);

-- =============================================================
--  TABLA: secciones
--  Catálogo de secciones configurables por el administrador
-- =============================================================
CREATE TABLE IF NOT EXISTS secciones (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(200) NOT NULL UNIQUE,
    clave           VARCHAR(50)  NOT NULL DEFAULT '',
    orden           INTEGER      NOT NULL DEFAULT 0,
    titulos         JSONB        NOT NULL DEFAULT '{}',
    activa          BOOLEAN      NOT NULL DEFAULT TRUE,
    creada_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizada_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secciones_activa ON secciones (activa);

CREATE OR REPLACE TRIGGER trg_secciones_actualizado_en
BEFORE UPDATE ON secciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: idiomas
--  Idiomas disponibles en la interfaz
-- =============================================================
CREATE TABLE IF NOT EXISTS idiomas (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(10) NOT NULL UNIQUE,
    label          VARCHAR(100) NOT NULL,
    activo         BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idiomas_code ON idiomas (code);

CREATE OR REPLACE TRIGGER trg_idiomas_actualizado_en
BEFORE UPDATE ON idiomas
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: traducciones
--  Par clave → valor por idioma (código)
-- =============================================================
CREATE TABLE IF NOT EXISTS traducciones (
    id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code  VARCHAR(10) NOT NULL REFERENCES idiomas (code) ON DELETE CASCADE,
    clave TEXT        NOT NULL,
    valor TEXT        NOT NULL DEFAULT '',
    CONSTRAINT uq_traducciones_code_clave UNIQUE (code, clave)
);

CREATE INDEX IF NOT EXISTS idx_traducciones_code ON traducciones (code);

-- =============================================================
--  TABLA: preguntas
--  Preguntas Sí/No del formulario, gestionables desde el panel
-- =============================================================
CREATE TABLE IF NOT EXISTS preguntas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campo          VARCHAR(100) NOT NULL DEFAULT '',
    texto          TEXT         NOT NULL,
    textos         JSONB        NOT NULL DEFAULT '{}',
    seccion_id     UUID         REFERENCES secciones (id) ON DELETE SET NULL,
    orden          INTEGER      NOT NULL DEFAULT 0,
    actualizada_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_seccion ON preguntas (seccion_id);

CREATE OR REPLACE TRIGGER trg_preguntas_actualizado_en
BEFORE UPDATE ON preguntas
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  VISTAS
-- =============================================================

-- Resumen de expedientes con contador de documentos
CREATE OR REPLACE VIEW v_expedientes AS
SELECT
    d.id,
    d.dni_nie,
    d.nombre || ' ' || d.apellidos AS nombre_completo,
    d.email,
    d.telefono,
    d.estado,
    d.creado_en,
    d.actualizado_en,
    COUNT(doc.id)                  AS num_documentos
FROM declaraciones d
LEFT JOIN documentos doc ON doc.declaracion_id = d.id
GROUP BY d.id;

-- Expedientes con situaciones que merecen atención especial
CREATE OR REPLACE VIEW v_expedientes_complejos AS
SELECT
    id,
    dni_nie,
    nombre || ' ' || apellidos AS nombre_completo,
    vivienda_alquiler,
    vivienda_propiedad,
    propiedad_antes_2013,
    pisos_alquilados_terceros,
    segunda_residencia,
    familia_numerosa,
    ayudas_gobierno,
    mayores_65_a_cargo,
    hijos_menores_26,
    ingresos_juego,
    ingresos_inversiones,
    estado,
    creado_en
FROM declaraciones
WHERE
    propiedad_antes_2013      = 'si'
    OR pisos_alquilados_terceros = 'si'
    OR segunda_residencia      = 'si'
    OR familia_numerosa        = 'si'
    OR ayudas_gobierno         = 'si'
    OR mayores_65_a_cargo      = 'si'
    OR ingresos_juego          = 'si'
    OR ingresos_inversiones    = 'si';

-- =============================================================
--  DATOS DE SEED
-- =============================================================

-- Idiomas por defecto
INSERT INTO idiomas (code, label) VALUES
    ('es', 'Español'),
    ('ca', 'Català'),
    ('en', 'English'),
    ('fr', 'Français')
ON CONFLICT (code) DO NOTHING;

-- Secciones por defecto
INSERT INTO secciones (nombre, clave, orden, titulos) VALUES
    ('Situación de Vivienda', 'vivienda', 1,
     '{"es":"Situación de Vivienda","fr":"Situation de Logement","en":"Housing Situation","ca":"Situació d''Habitatge"}'),
    ('Cargas Familiares y Ayudas Públicas', 'familia', 2,
     '{"es":"Cargas Familiares y Ayudas Públicas","fr":"Charges Familiales et Aides Publiques","en":"Family Obligations and Public Benefits","ca":"Càrregues Familiars i Ajudes Públiques"}'),
    ('Ingresos Extraordinarios e Inversiones', 'ingresos', 3,
     '{"es":"Ingresos Extraordinarios e Inversiones","fr":"Revenus Extraordinaires et Investissements","en":"Extraordinary Income and Investments","ca":"Ingressos Extraordinaris i Inversions"}')
ON CONFLICT (nombre) DO NOTHING;

-- Preguntas del formulario
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
JOIN secciones s ON s.nombre = seed.seccion_nombre
ON CONFLICT DO NOTHING;

-- Usuario administrador por defecto (contraseña: admin, bcrypt cost 12)
-- Cambiar en producción con POST /v1/auth/change-password
INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash) VALUES
    ('ADMIN', 'Administrador', '', 'admin@renta-form.local', '', 'admin',
     '$2b$12$a3QpSIVIiYpVQuwcWtYIbO.5/VbAKdDNClFrl0WTe4GVN7sjA0ruW')
ON CONFLICT (dni_nie) DO NOTHING;
