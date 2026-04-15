@api
Feature: Auth – POST /v1/auth/login y POST /v1/auth/change-password

  # ── POST /v1/auth/login ───────────────────────────────────────────────────

  Scenario: Login exitoso devuelve dniNie y role del usuario
    When hago POST a "/v1/auth/login" con body:
      """
      { "dniNie": "TEST1234A", "password": "password123" }
      """
    Then la respuesta tiene status 200
    And el campo "dniNie" de la respuesta es "TEST1234A"
    And el campo "role" de la respuesta es "user"

  Scenario: Login de administrador devuelve role admin
    When hago POST a "/v1/auth/login" con body:
      """
      { "dniNie": "ADMIN001A", "password": "admin123" }
      """
    Then la respuesta tiene status 200
    And el campo "role" de la respuesta es "admin"

  Scenario: Login sin dniNie devuelve 400 con mensaje de error
    When hago POST a "/v1/auth/login" con body:
      """
      { "password": "password123" }
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  Scenario: Login sin password devuelve 400 con mensaje de error
    When hago POST a "/v1/auth/login" con body:
      """
      { "dniNie": "TEST1234A" }
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  Scenario: Login con body vacío devuelve 400
    When hago POST a "/v1/auth/login" con body:
      """
      {}
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  Scenario: Login con DNI/NIE no registrado devuelve 400
    When hago POST a "/v1/auth/login" con body:
      """
      { "dniNie": "NOEXISTE99", "password": "password123" }
      """
    Then la respuesta tiene status 400
    And el campo "error" de la respuesta contiene "DNI/NIE"

  Scenario: Login con contraseña incorrecta devuelve 400
    When hago POST a "/v1/auth/login" con body:
      """
      { "dniNie": "TEST1234A", "password": "incorrecta" }
      """
    Then la respuesta tiene status 400
    And el campo "error" de la respuesta contiene "Contraseña"

  Scenario: Login con usuario bloqueado devuelve 400 y USER_BLOCKED
    When hago POST a "/v1/auth/login" con body:
      """
      { "dniNie": "BLOQUEADO1", "password": "pass123" }
      """
    Then la respuesta tiene status 400
    And el campo "error" de la respuesta contiene "USER_BLOCKED"

  # ── POST /v1/auth/change-password ─────────────────────────────────────────

  Scenario: Cambio de contraseña exitoso devuelve success true
    When hago POST a "/v1/auth/change-password" con body:
      """
      { "dniNie": "TEST1234A", "oldPassword": "password123", "newPassword": "nueva456" }
      """
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero

  Scenario: Cambio de contraseña con campo faltante devuelve 400
    When hago POST a "/v1/auth/change-password" con body:
      """
      { "dniNie": "TEST1234A", "oldPassword": "password123" }
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  Scenario: Cambio de contraseña con contraseña actual incorrecta devuelve 400
    When hago POST a "/v1/auth/change-password" con body:
      """
      { "dniNie": "TEST1234A", "oldPassword": "erronea", "newPassword": "nueva456" }
      """
    Then la respuesta tiene status 400
    And el campo "error" de la respuesta contiene "contraseña actual"

  Scenario: Cambio de contraseña con DNI/NIE inexistente devuelve 400
    When hago POST a "/v1/auth/change-password" con body:
      """
      { "dniNie": "NOEXISTE00", "oldPassword": "password123", "newPassword": "nueva456" }
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"
