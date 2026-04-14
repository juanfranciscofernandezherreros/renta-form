-- =============================================================
--  Renta Form – Schema for editable main form yes/no questions
-- =============================================================

-- Yes/no questions that admins can manage from the admin panel
CREATE TABLE IF NOT EXISTS preguntas_formulario (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    texto           TEXT            NOT NULL,
    actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_preguntas_formulario_actualizado_en
BEFORE UPDATE ON preguntas_formulario
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- ── Seed data ─────────────────────────────────────────────────────────────

INSERT INTO preguntas_formulario (texto) VALUES
    ('¿Vive actualmente en régimen de alquiler?'),
    ('¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?'),
    ('¿Es propietario/a de su vivienda habitual?'),
    ('¿La adquirió antes del 1 de enero de 2013?'),
    ('¿Tiene inmuebles arrendados a terceros?'),
    ('¿Dispone de una segunda residencia?'),
    ('¿Pertenece a una familia numerosa?'),
    ('¿Ha recibido ayudas o subvenciones públicas en 2025?'),
    ('¿Tiene ascendientes mayores de 65 años económicamente a su cargo?'),
    ('¿Conviven con usted en el mismo domicilio?'),
    ('¿Tiene hijos o descendientes menores de 26 años a su cargo?'),
    ('¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?'),
    ('¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?');
