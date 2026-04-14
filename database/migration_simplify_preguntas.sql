-- =============================================================
--  Migración: Simplificación de preguntas_formulario
--  Elimina las columnas de sección y orden del catálogo de
--  preguntas administrables. La tabla conserva únicamente:
--  id, campo (clave interna), texto, textos, actualizada_en.
--
--  IMPORTANTE: Ejecutar SOLO cuando el formulario público
--  (getPreguntas / App.jsx) ya no use seccion_id ni orden.
-- =============================================================

ALTER TABLE preguntas_formulario
  DROP COLUMN IF EXISTS seccion_id,
  DROP COLUMN IF EXISTS orden;
