@frontend
Feature: Pruebas del frontal con Playwright (API mockeada)
  Como equipo de QA del proyecto renta-form
  Quiero verificar el comportamiento visual y funcional del frontal
  Sin depender de una base de datos ni del backend real

  Background:
    Given la API está mockeada con datos de prueba
    And el usuario abre la aplicación

  Scenario: Renderizado de la página principal
    Then se muestra el formulario de identificación
    Then se toma screenshot "frontend_01_pagina_principal"

  Scenario: Los campos de identificación son visibles y accesibles
    Then el campo "nombre" está presente y es editable
    And el campo "apellidos" está presente y es editable
    And el campo "dniNie" está presente y es editable
    And el campo "email" está presente y es editable
    And el campo "telefono" está presente y es editable
    Then se toma screenshot "frontend_02_campos_identificacion"

  Scenario: Validación de campos obligatorios vacíos
    When el usuario pulsa el botón Continuar sin rellenar nada
    Then se muestran errores de validación en los campos requeridos
    Then se toma screenshot "frontend_03_validacion_vacios"

  Scenario: Rellenar los datos de identificación habilita el avance
    When el usuario completa los datos de identificación
    Then el botón Continuar está habilitado
    Then se toma screenshot "frontend_04_identificacion_completada"

  Scenario: Avanzar al paso de preguntas
    When el usuario completa los datos de identificación
    And el usuario pulsa Continuar para avanzar
    Then se muestra el primer bloque de preguntas
    Then se toma screenshot "frontend_05_primer_bloque_preguntas"

  Scenario: Responder una pregunta con Sí avanza al siguiente paso
    When el usuario completa los datos de identificación
    And el usuario pulsa Continuar para avanzar
    When el usuario responde Sí a la primera pregunta visible
    Then se toma screenshot "frontend_06_primera_pregunta_si"

  Scenario: Responder una pregunta con No avanza al siguiente paso
    When el usuario completa los datos de identificación
    And el usuario pulsa Continuar para avanzar
    When el usuario responde No a la primera pregunta visible
    Then se toma screenshot "frontend_07_primera_pregunta_no"

  Scenario: El botón Volver regresa a la pantalla de identificación
    When el usuario completa los datos de identificación
    And el usuario pulsa Continuar para avanzar
    When el usuario pulsa el botón Volver
    Then se muestra el formulario de identificación
    Then se toma screenshot "frontend_08_volver_identificacion"

  Scenario: Envío del formulario completo muestra pantalla de éxito
    When el usuario completa los datos de identificación
    And el usuario pulsa Continuar para avanzar
    And el usuario responde todas las preguntas con No
    Then se muestra la pantalla de éxito
    Then se toma screenshot "frontend_09_envio_exitoso"

  Scenario: Selector de idioma es visible
    Then el selector de idioma está visible en la página
    Then se toma screenshot "frontend_10_selector_idioma"
