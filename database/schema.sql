-- =============================================================
--  Renta Form – PostgreSQL Schema (declaraciones)
--  Campaña de la Renta 2025 · IRPF
--
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'respuesta_yn') THEN
    CREATE TYPE respuesta_yn AS ENUM ('si', 'no');
  END IF;
END $$;

-- Estado del expediente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_expediente') THEN
    CREATE TYPE estado_expediente AS ENUM (
      'recibido',
      'en_revision',
      'documentacion_pendiente',
      'completado',
      'archivado'
    );
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_declaraciones_email     ON declaraciones (email);
CREATE INDEX IF NOT EXISTS idx_declaraciones_estado    ON declaraciones (estado);
CREATE INDEX IF NOT EXISTS idx_declaraciones_creado_en ON declaraciones (creado_en DESC);

CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
BEFORE UPDATE ON declaraciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();
