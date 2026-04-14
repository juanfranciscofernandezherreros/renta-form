-- =============================================================
--  Renta Form – PostgreSQL Schema
--  Campaña de la Renta 2025 · IRPF
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

-- =============================================================
--  TABLA PRINCIPAL: declaraciones
--  Cada fila representa un cuestionario enviado
-- =============================================================
CREATE TABLE IF NOT EXISTS declaraciones (
    -- Clave primaria
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auditoría
    creado_en               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    estado                  estado_expediente NOT NULL DEFAULT 'recibido',

    -- =========================================================
    -- 1. Datos de Identificación
    -- =========================================================
    nombre                  VARCHAR(100)    NOT NULL,
    apellidos               VARCHAR(200)    NOT NULL,
    dni_nie                 VARCHAR(9)      NOT NULL,
    email                   VARCHAR(254)    NOT NULL,
    telefono                VARCHAR(20)     NOT NULL,

    -- =========================================================
    -- 2. Situación de Vivienda
    -- =========================================================
    vivienda_alquiler       respuesta_yn    NOT NULL,
    alquiler_menos_35       respuesta_yn,               -- sólo si vivienda_alquiler = 'si'
    vivienda_propiedad      respuesta_yn    NOT NULL,
    propiedad_antes_2013    respuesta_yn,               -- sólo si vivienda_propiedad = 'si'
    pisos_alquilados_terceros respuesta_yn  NOT NULL,
    segunda_residencia      respuesta_yn    NOT NULL,

    -- =========================================================
    -- 3. Cargas Familiares y Ayudas Públicas
    -- =========================================================
    familia_numerosa        respuesta_yn    NOT NULL,
    ayudas_gobierno         respuesta_yn    NOT NULL,
    mayores_65_a_cargo      respuesta_yn    NOT NULL,
    mayores_conviven        respuesta_yn,               -- sólo si mayores_65_a_cargo = 'si'
    hijos_menores_26        respuesta_yn    NOT NULL,

    -- =========================================================
    -- 4. Ingresos Extraordinarios e Inversiones
    -- =========================================================
    ingresos_juego          respuesta_yn    NOT NULL,
    ingresos_inversiones    respuesta_yn    NOT NULL,

    -- =========================================================
    -- Restricciones de integridad
    -- =========================================================
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

-- Índices de búsqueda frecuente
CREATE INDEX IF NOT EXISTS idx_declaraciones_email
    ON declaraciones (email);

CREATE INDEX IF NOT EXISTS idx_declaraciones_estado
    ON declaraciones (estado);

CREATE INDEX IF NOT EXISTS idx_declaraciones_creado_en
    ON declaraciones (creado_en DESC);

-- Trigger: actualizar automáticamente "actualizado_en"
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
BEFORE UPDATE ON declaraciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: documentos
--  Almacena los metadatos de cada archivo adjunto.
--  El binario puede guardarse aquí (bytea) o en almacenamiento
--  externo (S3, etc.); en ese caso usar sólo la columna url.
-- =============================================================
CREATE TABLE IF NOT EXISTS documentos (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    declaracion_id      UUID            NOT NULL
                            REFERENCES declaraciones (id)
                            ON DELETE CASCADE,

    tipo                tipo_documento  NOT NULL,
    nombre_original     VARCHAR(255)    NOT NULL,
    mime_type           VARCHAR(100)    NOT NULL,
    tamanyo_bytes       BIGINT          NOT NULL CHECK (tamanyo_bytes > 0),

    -- URL de almacenamiento externo (S3, GCS, etc.)
    url                 TEXT,

    -- Almacenamiento local opcional (máx. 5 MB según el formulario)
    contenido           BYTEA,

    subido_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_doc_storage
        CHECK (url IS NOT NULL OR contenido IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_documentos_declaracion
    ON documentos (declaracion_id);

CREATE INDEX IF NOT EXISTS idx_documentos_tipo
    ON documentos (tipo);

-- =============================================================
--  TABLA: notas_expediente
--  Registro de notas internas del gestor sobre el expediente
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
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    declaracion_id  UUID                NOT NULL
                        REFERENCES declaraciones (id)
                        ON DELETE CASCADE,
    estado_anterior estado_expediente,
    estado_nuevo    estado_expediente   NOT NULL,
    cambiado_por    VARCHAR(100),
    cambiado_en     TIMESTAMPTZ         NOT NULL DEFAULT NOW()
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
--  VISTAS ÚTILES
-- =============================================================

-- Vista resumen de expedientes con contador de documentos
CREATE OR REPLACE VIEW v_expedientes AS
SELECT
    d.id,
    d.dni_nie,
    d.nombre || ' ' || d.apellidos  AS nombre_completo,
    d.email,
    d.telefono,
    d.estado,
    d.creado_en,
    d.actualizado_en,
    COUNT(doc.id)                   AS num_documentos
FROM declaraciones d
LEFT JOIN documentos doc ON doc.declaracion_id = d.id
GROUP BY d.id;

-- Vista de expedientes con situaciones que merecen atención
CREATE OR REPLACE VIEW v_expedientes_complejos AS
SELECT
    id,
    dni_nie,
    nombre || ' ' || apellidos  AS nombre_completo,
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
    propiedad_antes_2013    = 'si'
    OR pisos_alquilados_terceros = 'si'
    OR segunda_residencia   = 'si'
    OR familia_numerosa     = 'si'
    OR ayudas_gobierno      = 'si'
    OR mayores_65_a_cargo   = 'si'
    OR ingresos_juego       = 'si'
    OR ingresos_inversiones = 'si';

-- =============================================================
--  DATOS DE EJEMPLO (comentar en producción)
-- =============================================================
/*
INSERT INTO declaraciones (
    nombre, apellidos, dni_nie, email, telefono,
    vivienda_alquiler, alquiler_menos_35,
    vivienda_propiedad, propiedad_antes_2013,
    pisos_alquilados_terceros, segunda_residencia,
    familia_numerosa, ayudas_gobierno,
    mayores_65_a_cargo, mayores_conviven,
    hijos_menores_26,
    ingresos_juego, ingresos_inversiones
) VALUES (
    'María', 'García López', '12345678A',
    'maria.garcia@ejemplo.es', '600123456',
    'si', 'no',
    'no', NULL,
    'no', 'no',
    'no', 'no',
    'si', 'si',
    'si',
    'no', 'si'
);
*/
