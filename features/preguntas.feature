Feature: Preguntas del formulario de declaración de la Renta

  # ── Lista plana de preguntas (sin preguntas condicionales) ────────────────

  Scenario: El formulario se envia correctamente respondiendo No a todas las preguntas
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Given el usuario avanza al siguiente paso
    Given el usuario responde No a todas las preguntas de vivienda
    Given el usuario responde No a todas las preguntas de familia
    Given el usuario responde No a todas las preguntas de ingresos
    When el usuario envia el formulario
    Then el formulario se ha enviado correctamente

  Scenario: El formulario muestra la barra de progreso correctamente
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Then la barra de progreso es visible
    When el usuario avanza al siguiente paso
    Then el contador de pasos avanza

  Scenario: El formulario requiere que todas las preguntas visibles esten respondidas
    Given el usuario abre la pagina principal
    Given el usuario rellena los datos de identificacion
    Given el usuario avanza al siguiente paso
    When el usuario intenta avanzar sin responder la pregunta actual
    Then se muestra un error de pregunta sin responder

  # ── Tabla de administración de preguntas ──────────────────────────────────

  Scenario: La tabla de admin muestra las preguntas del formulario con el campo
    Given el administrador accede al panel de administracion
    When el administrador navega a la pestaña de preguntas del formulario
    Then la tabla muestra las preguntas con columna Campo

  Scenario: El administrador puede editar el texto de una pregunta
    Given el administrador accede al panel de administracion
    When el administrador navega a la pestaña de preguntas del formulario
    And el administrador edita la primera pregunta con texto "Texto de prueba editado"
    Then la pregunta muestra el texto actualizado
