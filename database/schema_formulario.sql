-- =============================================================
--  Renta Form – Schema for editable main form yes/no questions
-- =============================================================

-- Yes/no questions that admins can manage from the admin panel
CREATE TABLE IF NOT EXISTS preguntas_formulario (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    texto           TEXT            NOT NULL,
    orden           INTEGER         NOT NULL DEFAULT 0,
    indentada       BOOLEAN         NOT NULL DEFAULT FALSE,
    condicion_campo VARCHAR(100),
    condicion_valor VARCHAR(20),
    actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_preguntas_formulario_actualizado_en
BEFORE UPDATE ON preguntas_formulario
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- ── Seed data ─────────────────────────────────────────────────────────────

INSERT INTO preguntas_formulario (texto, orden, indentada, condicion_campo, condicion_valor) VALUES
    ('¿Vive actualmente en régimen de alquiler?',                                                            0, false, NULL,                   NULL),
    ('¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',                         1, true,  'viviendaAlquiler',     'si'),
    ('¿Es propietario/a de su vivienda habitual?',                                                           2, false, NULL,                   NULL),
    ('¿La adquirió antes del 1 de enero de 2013?',                                                           3, true,  'viviendaPropiedad',    'si'),
    ('¿Tiene inmuebles arrendados a terceros?',                                                              4, false, NULL,                   NULL),
    ('¿Dispone de una segunda residencia?',                                                                   5, false, NULL,                   NULL),
    ('¿Pertenece a una familia numerosa?',                                                                    6, false, NULL,                   NULL),
    ('¿Ha recibido ayudas o subvenciones públicas en 2025?',                                                  7, false, NULL,                   NULL),
    ('¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',                                     8, false, NULL,                   NULL),
    ('¿Conviven con usted en el mismo domicilio?',                                                            9, true,  'mayores65ACargo',      'si'),
    ('¿Tiene hijos o descendientes menores de 26 años a su cargo?',                                         10, false, NULL,                   NULL),
    ('¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',                                      11, false, NULL,                   NULL),
    ('¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',      12, false, NULL,                   NULL);
