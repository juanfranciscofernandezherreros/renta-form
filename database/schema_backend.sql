-- =============================================================
--  Renta Form – Additional tables for the backend DB profile
--  Run AFTER database/schema.sql
-- =============================================================

-- =============================================================
--  TABLA: usuarios
--  Almacena credenciales y metadatos de los usuarios registrados.
-- =============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_nie         VARCHAR(9)      NOT NULL UNIQUE,
    nombre          VARCHAR(100)    NOT NULL,
    apellidos       VARCHAR(200)    NOT NULL DEFAULT '',
    email           VARCHAR(254)    NOT NULL,
    telefono        VARCHAR(20)     NOT NULL DEFAULT '',
    role            VARCHAR(20)     NOT NULL DEFAULT 'user',
    password_hash   TEXT            NOT NULL,
    bloqueado       BOOLEAN         NOT NULL DEFAULT FALSE,
    denunciado      BOOLEAN         NOT NULL DEFAULT FALSE,
    preguntas_asignadas JSONB       NOT NULL DEFAULT '[]',
    secciones_asignadas JSONB       NOT NULL DEFAULT '[]',
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_dni_nie ON usuarios (dni_nie);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios (email);

-- =============================================================
--  TABLA: secciones
--  Catálogo de secciones configurables por el administrador.
-- =============================================================
CREATE TABLE IF NOT EXISTS secciones (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(200)    NOT NULL UNIQUE,
    clave           VARCHAR(50)     NOT NULL DEFAULT '',
    orden           INTEGER         NOT NULL DEFAULT 0,
    titulos         JSONB           NOT NULL DEFAULT '{}',
    activa          BOOLEAN         NOT NULL DEFAULT TRUE,
    creada_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secciones_activa ON secciones (activa);

CREATE OR REPLACE TRIGGER trg_secciones_actualizado_en
BEFORE UPDATE ON secciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: idiomas
--  Idiomas disponibles en la interfaz.
-- =============================================================
CREATE TABLE IF NOT EXISTS idiomas (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10)     NOT NULL UNIQUE,
    label           VARCHAR(100)    NOT NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idiomas_code ON idiomas (code);

CREATE OR REPLACE TRIGGER trg_idiomas_actualizado_en
BEFORE UPDATE ON idiomas
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- =============================================================
--  TABLA: traducciones
--  Par clave → valor por idioma (código).
-- =============================================================
CREATE TABLE IF NOT EXISTS traducciones (
    id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    code    VARCHAR(10)  NOT NULL REFERENCES idiomas (code) ON DELETE CASCADE,
    clave   TEXT    NOT NULL,
    valor   TEXT    NOT NULL DEFAULT '',
    CONSTRAINT uq_traducciones_code_clave UNIQUE (code, clave)
);

CREATE INDEX IF NOT EXISTS idx_traducciones_code ON traducciones (code);

-- =============================================================
--  Datos de seed para el perfil DB
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

-- Usuario administrador por defecto (password: admin, bcrypt cost 12)
-- Generated with: bcrypt.hash('admin', 12)
-- Replace this hash in production by calling POST /v1/auth/change-password
INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash) VALUES
    ('ADMIN', 'Administrador', '', 'admin@renta-form.local', '', 'admin',
     '$2b$12$a3QpSIVIiYpVQuwcWtYIbO.5/VbAKdDNClFrl0WTe4GVN7sjA0ruW')
ON CONFLICT (dni_nie) DO NOTHING;
