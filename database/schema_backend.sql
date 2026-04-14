-- =============================================================
--  Renta Form – PostgreSQL Schema (usuarios)
--  Campaña de la Renta 2025 · IRPF
--
--  Compatible con PostgreSQL 14+.
--  Prerequisito: schema.sql debe haberse ejecutado primero.
-- =============================================================

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

-- Usuario administrador por defecto (contraseña: admin, bcrypt cost 12)
-- Cambiar en producción con POST /v1/auth/change-password
INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash) VALUES
    ('ADMIN', 'Administrador', '', 'admin@renta-form.local', '', 'admin',
     '$2b$12$a3QpSIVIiYpVQuwcWtYIbO.5/VbAKdDNClFrl0WTe4GVN7sjA0ruW')
ON CONFLICT (dni_nie) DO NOTHING;
