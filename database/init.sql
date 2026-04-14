-- =============================================================
--  Renta Form – Esquema con Soporte Multi-idioma (i18n)
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

-- 2. Función de Auditoría
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

-- 3. Tabla: Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_nie       VARCHAR(9)   NOT NULL UNIQUE,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(254) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user',
    password_hash TEXT         NOT NULL,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Tabla: Preguntas (Ahora con JSONB para traducciones)
CREATE TABLE IF NOT EXISTS preguntas (
    id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campo   VARCHAR(100) NOT NULL UNIQUE,
    -- 'texto' guarda un objeto: {"es": "...", "en": "...", "ca": "..."}
    texto   JSONB        NOT NULL DEFAULT '{}',
    orden   INTEGER      NOT NULL DEFAULT 0
);

-- 5. Tabla: Declaraciones (Resultados)
CREATE TABLE IF NOT EXISTS declaraciones (
    id                        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en                 TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    estado                    estado_expediente NOT NULL DEFAULT 'recibido',
    nombre                    VARCHAR(100)      NOT NULL,
    apellidos                 VARCHAR(200)      NOT NULL,
    dni_nie                   VARCHAR(9)        NOT NULL UNIQUE,
    email                     VARCHAR(254)      NOT NULL,
    telefono                  VARCHAR(20)       NOT NULL,

    -- Campos del formulario
    vivienda_alquiler         respuesta_yn      NOT NULL,
    alquiler_menos_35         respuesta_yn,
    vivienda_propiedad        respuesta_yn      NOT NULL,
    propiedad_antes_2013      respuesta_yn,
    pisos_alquilados_terceros respuesta_yn      NOT NULL,
    segunda_residencia        respuesta_yn      NOT NULL,
    familia_numerosa          respuesta_yn      NOT NULL,
    ayudas_gobierno           respuesta_yn      NOT NULL,
    mayores_65_a_cargo        respuesta_yn      NOT NULL,
    mayores_conviven          respuesta_yn,
    hijos_menores_26          respuesta_yn      NOT NULL,
    ingresos_juego            respuesta_yn      NOT NULL,
    ingresos_inversiones      respuesta_yn      NOT NULL,

    CONSTRAINT chk_dni_nie_formato CHECK (dni_nie ~ '^[0-9XYZ][0-9]{7}[A-Z]$')
);

-- 6. Trigger
CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
    BEFORE UPDATE ON declaraciones FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- 7. Datos de Inicio (Con traducciones)
INSERT INTO usuarios (dni_nie, nombre, email, role, password_hash)
VALUES ('ADMIN', 'Admin', 'admin@renta-form.local', 'admin', '$2b$12$a3QpSIVIiYpVQuwcWtYIbO.5/VbAKdDNClFrl0WTe4GVN7sjA0ruW')
ON CONFLICT DO NOTHING;

INSERT INTO preguntas (campo, texto, orden) VALUES
    ('vivienda_alquiler',
     '{"es": "¿Vive de alquiler?", "en": "Do you live in a rental?", "ca": "Viu de lloguer?"}', 1),
    ('vivienda_propiedad',
     '{"es": "¿Es propietario?", "en": "Do you own your home?", "ca": "És propietari?"}', 2),
    ('familia_numerosa',
     '{"es": "¿Familia numerosa?", "en": "Large family?", "ca": "Família nombrosa?"}', 3),
    ('hijos_menores_26',
     '{"es": "¿Hijos < 26 años?", "en": "Children under 26?", "ca": "Fills < 26 anys?"}', 4),
    ('ingresos_juego',
     '{"es": "¿Ganancias de juego?", "en": "Gambling winnings?", "ca": "Guanys de joc?"}', 5)
ON CONFLICT DO NOTHING;

COMMIT;
