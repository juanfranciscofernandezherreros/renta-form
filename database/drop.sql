-- =============================================================
--  Renta Form – Drop de todas las tablas, tipos y funciones
--  creadas por database/init.sql.
--
--  Uso (reemplaza lo que haya antes de recrear el esquema):
--    psql "$DATABASE_URL" -f database/drop.sql
--    # o:
--    docker compose exec -T db psql -U postgres -d renta_form \
--      < database/drop.sql
--
--  Después ejecuta:
--    cd backend && npm run db:setup-all
-- =============================================================

BEGIN;

-- Tablas (CASCADE elimina FKs e índices dependientes)
DROP TABLE IF EXISTS respuestas_declaracion CASCADE;
DROP TABLE IF EXISTS traducciones           CASCADE;
DROP TABLE IF EXISTS idiomas                CASCADE;
DROP TABLE IF EXISTS declaraciones          CASCADE;
DROP TABLE IF EXISTS preguntas              CASCADE;
DROP TABLE IF EXISTS usuarios_roles         CASCADE;
DROP TABLE IF EXISTS roles                  CASCADE;
DROP TABLE IF EXISTS usuarios               CASCADE;

-- Tipos ENUM
DROP TYPE IF EXISTS respuesta_yn;
DROP TYPE IF EXISTS estado_expediente;

-- Funciones de auditoría usadas por los triggers
DROP FUNCTION IF EXISTS fn_set_actualizado_en() CASCADE;
DROP FUNCTION IF EXISTS fn_set_actualizada_en() CASCADE;

COMMIT;
