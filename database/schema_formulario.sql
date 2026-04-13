-- =============================================================
--  Renta Form – Schema for editable main form questions
--  These tables replace the static CATALOGO_PREGUNTAS object
--  so that admins can modify the main form questions from the
--  admin panel.
-- =============================================================

-- Sections that group the main form yes/no questions
CREATE TABLE IF NOT EXISTS secciones_formulario (
    id              VARCHAR(50)     PRIMARY KEY,
    titulo          TEXT            NOT NULL,
    numero          INTEGER         NOT NULL DEFAULT 0,
    orden           INTEGER         NOT NULL DEFAULT 0,
    actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Main form questions (map to columns of the declaraciones table)
CREATE TABLE IF NOT EXISTS preguntas_formulario (
    campo           VARCHAR(100)    PRIMARY KEY,
    seccion_id      VARCHAR(50)     NOT NULL REFERENCES secciones_formulario(id) ON DELETE RESTRICT,
    texto           TEXT            NOT NULL,
    orden           INTEGER         NOT NULL DEFAULT 0,
    indentada       BOOLEAN         NOT NULL DEFAULT FALSE,
    condicion_campo VARCHAR(100),
    condicion_valor VARCHAR(20),
    actualizada_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_formulario_seccion
    ON preguntas_formulario (seccion_id);

CREATE OR REPLACE TRIGGER trg_preguntas_formulario_actualizado_en
BEFORE UPDATE ON preguntas_formulario
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

CREATE OR REPLACE TRIGGER trg_secciones_formulario_actualizado_en
BEFORE UPDATE ON secciones_formulario
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- ── Seed data (mirrors CATALOGO_PREGUNTAS from mockStore.js) ─────────────

INSERT INTO secciones_formulario (id, titulo, numero, orden) VALUES
    ('vivienda', 'Situación de Vivienda', 2, 1),
    ('familia',  'Cargas Familiares y Ayudas Públicas', 3, 2),
    ('ingresos', 'Ingresos Extraordinarios e Inversiones', 4, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO preguntas_formulario (campo, seccion_id, texto, orden, indentada, condicion_campo, condicion_valor) VALUES
    ('viviendaAlquiler',        'vivienda', '¿Vive actualmente en régimen de alquiler?',                                                            0, false, NULL,                   NULL),
    ('alquilerMenos35',         'vivienda', '¿El importe del alquiler es inferior al 35 % de sus ingresos brutos anuales?',                         1, true,  'viviendaAlquiler',     'si'),
    ('viviendaPropiedad',       'vivienda', '¿Es propietario/a de su vivienda habitual?',                                                           2, false, NULL,                   NULL),
    ('propiedadAntes2013',      'vivienda', '¿La adquirió antes del 1 de enero de 2013?',                                                           3, true,  'viviendaPropiedad',    'si'),
    ('pisosAlquiladosTerceros', 'vivienda', '¿Tiene inmuebles arrendados a terceros?',                                                              4, false, NULL,                   NULL),
    ('segundaResidencia',       'vivienda', '¿Dispone de una segunda residencia?',                                                                   5, false, NULL,                   NULL),
    ('familiaNumerosa',         'familia',  '¿Pertenece a una familia numerosa?',                                                                    0, false, NULL,                   NULL),
    ('ayudasGobierno',          'familia',  '¿Ha recibido ayudas o subvenciones públicas en 2025?',                                                  1, false, NULL,                   NULL),
    ('mayores65ACargo',         'familia',  '¿Tiene ascendientes mayores de 65 años económicamente a su cargo?',                                     2, false, NULL,                   NULL),
    ('mayoresConviven',         'familia',  '¿Conviven con usted en el mismo domicilio?',                                                            3, true,  'mayores65ACargo',      'si'),
    ('hijosMenores26',          'familia',  '¿Tiene hijos o descendientes menores de 26 años a su cargo?',                                          4, false, NULL,                   NULL),
    ('ingresosJuego',           'ingresos', '¿Ha obtenido ganancias por juego, loterías o apuestas en 2025?',                                       0, false, NULL,                   NULL),
    ('ingresosInversiones',     'ingresos', '¿Ha obtenido rendimientos de capital mobiliario (acciones, fondos de inversión, etc.) en 2025?',       1, false, NULL,                   NULL)
ON CONFLICT (campo) DO NOTHING;
