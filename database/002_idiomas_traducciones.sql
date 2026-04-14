-- =============================================================
--  Renta Form – Tablas: idiomas y traducciones
-- =============================================================

BEGIN;

-- 1. Tabla: Idiomas
CREATE TABLE IF NOT EXISTS idiomas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(10)  NOT NULL UNIQUE,
    label          VARCHAR(100) NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_idiomas_actualizado_en
    BEFORE UPDATE ON idiomas FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- 2. Tabla: Traducciones
CREATE TABLE IF NOT EXISTS traducciones (
    id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    idioma_id UUID         NOT NULL REFERENCES idiomas(id) ON DELETE CASCADE,
    clave     VARCHAR(200) NOT NULL,
    valor     TEXT         NOT NULL DEFAULT '',
    UNIQUE (idioma_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_traducciones_idioma ON traducciones (idioma_id);

-- 3. Datos de inicio: idiomas
INSERT INTO idiomas (code, label, activo) VALUES
    ('es', 'Español',   TRUE),
    ('fr', 'Français',  TRUE),
    ('en', 'English',   TRUE),
    ('ca', 'Català',    TRUE)
ON CONFLICT (code) DO NOTHING;

COMMIT;
