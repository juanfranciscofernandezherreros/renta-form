-- =============================================================
--  Renta Form – Esquema completo (ES, FR, CA, EN)
-- =============================================================

BEGIN;

-- 1. Extensiones y Tipos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'respuesta_yn') THEN
        CREATE TYPE respuesta_yn AS ENUM ('si', 'no');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_expediente') THEN
        CREATE TYPE estado_expediente AS ENUM ('recibido', 'en_revision', 'documentacion_pendiente', 'completado', 'archivado');
    END IF;
END $$;

-- 2. Funciones de Auditoría
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_set_actualizada_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizada_en = NOW();
    RETURN NEW;
END;
$$;

-- 3. Tabla: Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_nie              VARCHAR(9)   NOT NULL UNIQUE,
    nombre               VARCHAR(100) NOT NULL,
    apellidos            VARCHAR(200) NOT NULL DEFAULT '',
    email                VARCHAR(254) NOT NULL,
    telefono             VARCHAR(20)  NOT NULL DEFAULT '',
    role                 VARCHAR(20)  NOT NULL DEFAULT 'user',
    password_hash        TEXT         NOT NULL,
    bloqueado            BOOLEAN      NOT NULL DEFAULT false,
    denunciado           BOOLEAN      NOT NULL DEFAULT false,
    preguntas_asignadas  JSONB        NOT NULL DEFAULT '[]',
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Tabla: Preguntas (catálogo dinámico, totalmente autodescriptivo)
-- El identificador público es el `campo` camelCase (e.g. 'viviendaAlquiler').
-- El UUID es la clave primaria interna usada por las foreign keys.
-- `orden` controla la posición en el wizard; `texto` JSONB contiene las
-- traducciones por idioma ({"es": "...", "fr": "...", ...}).
CREATE TABLE IF NOT EXISTS preguntas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campo          VARCHAR(100) NOT NULL UNIQUE,
    orden          INTEGER      NOT NULL DEFAULT 0,
    texto          JSONB        NOT NULL DEFAULT '{}',
    actualizada_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Backfill columns for legacy databases where `preguntas` was created
-- without `campo` / `orden` (pre-multi-section schema). The CREATE TABLE
-- above is a no-op in that case, so we must explicitly add them here
-- before any index that references them.
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS campo VARCHAR(100);
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_preguntas_orden ON preguntas (orden);

-- 5. Tabla: Declaraciones (sólo datos personales — las respuestas viven
--    en la tabla `respuestas_declaracion` y son completamente dinámicas).
CREATE TABLE IF NOT EXISTS declaraciones (
    id                        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en                 TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    estado                    estado_expediente NOT NULL DEFAULT 'recibido',
    nombre                    VARCHAR(100)      NOT NULL,
    apellidos                 VARCHAR(200)      NOT NULL,
    dni_nie                   VARCHAR(9)        NOT NULL,
    email                     VARCHAR(254)      NOT NULL,
    telefono                  VARCHAR(20)       NOT NULL,

    CONSTRAINT chk_dni_nie_formato       CHECK (dni_nie ~ '^[0-9XYZ][0-9]{7}[A-Z]$'),
    CONSTRAINT uq_declaraciones_dni_nie  UNIQUE (dni_nie)
);

-- 5b. Tabla: Respuestas de cada declaración (clave/valor dinámico).
--     Una fila por (declaración, pregunta). Las respuestas son siempre
--     'si' o 'no'. La FK a `preguntas` con ON DELETE CASCADE garantiza
--     que al borrar una pregunta se eliminan también sus respuestas.
CREATE TABLE IF NOT EXISTS respuestas_declaracion (
    declaracion_id UUID         NOT NULL REFERENCES declaraciones(id) ON DELETE CASCADE,
    pregunta_id    UUID         NOT NULL REFERENCES preguntas(id)    ON DELETE CASCADE,
    respuesta      respuesta_yn NOT NULL,
    PRIMARY KEY (declaracion_id, pregunta_id)
);
CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas_declaracion (pregunta_id);

-- 6. Tabla: Idiomas
CREATE TABLE IF NOT EXISTS idiomas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(10)  NOT NULL UNIQUE,
    label          VARCHAR(100) NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 7. Tabla: Traducciones
CREATE TABLE IF NOT EXISTS traducciones (
    id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    idioma_id UUID         NOT NULL REFERENCES idiomas(id) ON DELETE CASCADE,
    clave     VARCHAR(200) NOT NULL,
    valor     TEXT         NOT NULL DEFAULT '',
    UNIQUE (idioma_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_traducciones_idioma ON traducciones (idioma_id);

-- 8. Tabla: Ajustes (configuración general de la aplicación)
CREATE TABLE IF NOT EXISTS ajustes (
    clave  VARCHAR(100) PRIMARY KEY,
    valor  TEXT         NOT NULL DEFAULT ''
);

-- Valor por defecto: envío de emails activado
INSERT INTO ajustes (clave, valor) VALUES ('email_enabled', 'true') ON CONFLICT (clave) DO NOTHING;

-- 9. Triggers
CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
    BEFORE UPDATE ON declaraciones FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

CREATE OR REPLACE TRIGGER trg_idiomas_actualizado_en
    BEFORE UPDATE ON idiomas FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

CREATE OR REPLACE TRIGGER trg_preguntas_actualizada_en
    BEFORE UPDATE ON preguntas FOR EACH ROW EXECUTE FUNCTION fn_set_actualizada_en();

COMMIT;
