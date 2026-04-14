Feature: Rellenar el formulario de declaración de la Renta

  Scenario: Captura de la página de inicio
    Given el usuario abre la pagina principal
    Then se toma un screenshot "01_pagina_inicio"

  Scenario: Validación campos obligatorios vacíos
    Given el usuario abre la pagina principal
    When el usuario hace clic en Siguiente sin rellenar nada
    Then se toma un screenshot "02_validacion_campos_vacios"

  Scenario: Rellenar datos de identificacion
    Given el usuario abre la pagina principal
    When el usuario rellena los datos de identificacion
    Then se toma un screenshot "03_datos_identificacion_rellenos"

  Scenario: Paso 2 - Situacion de vivienda
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Given el usuario avanza al siguiente paso
    Then se toma un screenshot "04_paso_vivienda"
    When el usuario responde Si a todas las preguntas de vivienda
    Then se toma un screenshot "05_vivienda_respondida"

  Scenario: Paso 3 - Cargas familiares
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de vivienda
    Given el usuario avanza al siguiente paso
    Then se toma un screenshot "06_paso_familia"
    When el usuario responde No a todas las preguntas de familia
    Then se toma un screenshot "07_familia_respondida"

  Scenario: Paso 4 - Ingresos extraordinarios
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de vivienda
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de familia
    Given el usuario avanza al siguiente paso
    Then se toma un screenshot "08_paso_ingresos"
    When el usuario responde No a todas las preguntas de ingresos
    Then se toma un screenshot "09_ingresos_respondidos"

  Scenario: Paso final - Envio del formulario
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de vivienda
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de familia
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de ingresos
    When el usuario envia el formulario
    Then se toma un screenshot "10_formulario_enviado_exito"

  Scenario: Envio duplicado - mismo DNI/NIE muestra error
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion con DNI "99999999R"
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de vivienda
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de familia
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de ingresos
    When el usuario envia el formulario
    Then se toma un screenshot "11_primer_envio_exito"
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion con DNI "99999999R"
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de vivienda
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de familia
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de ingresos
    When el usuario intenta enviar el formulario duplicado
    Then se muestra un error de declaracion duplicada
    Then se toma un screenshot "12_envio_duplicado_error"

  Scenario: Pantalla de login de usuario
    Given el usuario navega a la pantalla de login
    Then se toma un screenshot "13_pantalla_login"

  Scenario: Pantalla de consulta por token
    Given el usuario navega a la pantalla de consulta
    Then se toma un screenshot "14_pantalla_consulta"
