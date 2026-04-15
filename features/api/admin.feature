@api
Feature: Admin – endpoints de preguntas-formulario, usuarios e idiomas

  # ── GET /v1/admin/preguntas-formulario ────────────────────────────────────

  Scenario: GET preguntas-formulario devuelve listado paginado
    When hago GET a "/v1/admin/preguntas-formulario"
    Then la respuesta tiene status 200
    And la respuesta contiene las claves "data, total, page, limit"

  Scenario: GET preguntas-formulario tiene preguntas con campos id y campo
    When hago GET a "/v1/admin/preguntas-formulario"
    Then la respuesta tiene status 200
    And la respuesta tiene al menos 1 elementos

  Scenario: GET preguntas-formulario respeta el parámetro limit
    When hago GET a "/v1/admin/preguntas-formulario?page=1&limit=2"
    Then la respuesta tiene status 200
    And el campo "limit" de la respuesta es 2

  # ── POST /v1/admin/preguntas-formulario ───────────────────────────────────

  Scenario: POST preguntas-formulario crea una nueva pregunta y devuelve 201
    When hago POST a "/v1/admin/preguntas-formulario" con body:
      """
      { "texto": "¿Tiene vehículo eléctrico?" }
      """
    Then la respuesta tiene status 201
    And la respuesta contiene el campo "id"
    And el campo "texto" de la respuesta es "¿Tiene vehículo eléctrico?"

  Scenario: POST preguntas-formulario sin texto devuelve 404
    When hago POST a "/v1/admin/preguntas-formulario" con body:
      """
      {}
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: POST preguntas-formulario con texto vacío devuelve 404
    When hago POST a "/v1/admin/preguntas-formulario" con body:
      """
      { "texto": "" }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── PUT /v1/admin/preguntas-formulario/:id ────────────────────────────────

  Scenario: PUT preguntas-formulario actualiza el texto de una pregunta
    Given existe una pregunta de formulario de prueba
    When hago PUT a "/v1/admin/preguntas-formulario/{preguntaId}" con body:
      """
      { "texto": "Texto actualizado por el test" }
      """
    Then la respuesta tiene status 200
    And el campo "texto" de la respuesta es "Texto actualizado por el test"

  Scenario: PUT preguntas-formulario con id inexistente devuelve 404
    When hago PUT a "/v1/admin/preguntas-formulario/id-no-existe" con body:
      """
      { "texto": "Nuevo texto" }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: PUT preguntas-formulario con texto vacío devuelve 404
    Given existe una pregunta de formulario de prueba
    When hago PUT a "/v1/admin/preguntas-formulario/{preguntaId}" con body:
      """
      { "texto": "   " }
      """
    Then la respuesta tiene status 404

  # ── DELETE /v1/admin/preguntas-formulario/:id ─────────────────────────────

  Scenario: DELETE preguntas-formulario elimina la pregunta y devuelve deleted true
    Given existe una pregunta de formulario de prueba
    When hago DELETE a "/v1/admin/preguntas-formulario/{preguntaId}"
    Then la respuesta tiene status 200
    And el campo "deleted" de la respuesta es verdadero

  Scenario: DELETE preguntas-formulario con id inexistente devuelve 404
    When hago DELETE a "/v1/admin/preguntas-formulario/id-que-no-existe"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── GET /v1/admin/users ───────────────────────────────────────────────────

  Scenario: GET users devuelve listado paginado de usuarios
    When hago GET a "/v1/admin/users"
    Then la respuesta tiene status 200
    And la respuesta contiene las claves "data, total, page, limit"
    And la respuesta tiene al menos 1 elementos

  Scenario: GET users con filtro bloqueado=true devuelve sólo bloqueados
    When hago GET a "/v1/admin/users?bloqueado=true"
    Then la respuesta tiene status 200
    And el campo "total" de la respuesta es 1

  Scenario: GET users con búsqueda por nombre encuentra coincidencias
    When hago GET a "/v1/admin/users?search=Test"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "data"

  # ── GET /v1/admin/users/:dniNie ──────────────────────────────────────────

  Scenario: GET user por dniNie devuelve el usuario con sus campos
    When hago GET a "/v1/admin/users/TEST1234A"
    Then la respuesta tiene status 200
    And el campo "dniNie" de la respuesta es "TEST1234A"
    And el campo "role" de la respuesta es "user"

  Scenario: GET user por dniNie inexistente devuelve null en data
    When hago GET a "/v1/admin/users/NOEXISTE00"
    Then la respuesta tiene status 200

  # ── PATCH /v1/admin/users/:dniNie/block ───────────────────────────────────

  Scenario: PATCH block usuario bloquea al usuario y devuelve success
    When hago PATCH a "/v1/admin/users/TEST1234A/block" con body:
      """
      { "bloqueado": true }
      """
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero

  Scenario: PATCH block usuario desbloquea al usuario
    When hago PATCH a "/v1/admin/users/BLOQUEADO1/block" con body:
      """
      { "bloqueado": false }
      """
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero

  Scenario: PATCH block con dniNie inexistente devuelve 404
    When hago PATCH a "/v1/admin/users/NOEXISTE00/block" con body:
      """
      { "bloqueado": true }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── PATCH /v1/admin/users/:dniNie/report ──────────────────────────────────

  Scenario: PATCH report marca al usuario como denunciado y devuelve success
    When hago PATCH a "/v1/admin/users/TEST1234A/report" con body:
      """
      { "denunciado": true }
      """
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero

  Scenario: PATCH report con dniNie inexistente devuelve 404
    When hago PATCH a "/v1/admin/users/NOEXISTE00/report" con body:
      """
      { "denunciado": true }
      """
    Then la respuesta tiene status 404

  # ── DELETE /v1/admin/users/:dniNie ───────────────────────────────────────

  Scenario: DELETE user elimina al usuario y devuelve success
    When hago DELETE a "/v1/admin/users/TEST1234A"
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero

  Scenario: DELETE user con dniNie inexistente devuelve 404
    When hago DELETE a "/v1/admin/users/NOEXISTE00"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── POST /v1/admin/users/:dniNie/email ───────────────────────────────────

  Scenario: POST email a usuario devuelve success y to
    When hago POST a "/v1/admin/users/TEST1234A/email" con body:
      """
      { "email": "notificacion@ejemplo.es", "mensaje": "Mensaje de prueba" }
      """
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero
    And el campo "to" de la respuesta es "notificacion@ejemplo.es"

  # ── POST /v1/admin/users/assign ──────────────────────────────────────────

  Scenario: POST assign crea un usuario a partir de una declaración existente
    Given existe una declaración de prueba
    When hago POST a "/v1/admin/users/assign" con body:
      """
      { "dniNie": "{declaracionDniNie}", "password": "pass1234", "declaracionId": "{declaracionId}" }
      """
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "dniNie"

  Scenario: POST assign sin dniNie ni password devuelve 404
    When hago POST a "/v1/admin/users/assign" con body:
      """
      {}
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: POST assign con declaración inexistente devuelve 404
    When hago POST a "/v1/admin/users/assign" con body:
      """
      { "dniNie": "NEWUSER01", "password": "pass1234", "declaracionId": "00000000-0000-0000-0000-000000000099" }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── GET /v1/admin/idiomas ─────────────────────────────────────────────────

  Scenario: GET admin idiomas devuelve listado paginado con los idiomas
    When hago GET a "/v1/admin/idiomas"
    Then la respuesta tiene status 200
    And la respuesta contiene las claves "data, total, page, limit"
    And la respuesta tiene al menos 1 elementos

  Scenario: GET admin idiomas con filtro activo=true devuelve sólo activos
    When hago GET a "/v1/admin/idiomas?activo=true"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "data"

  # ── POST /v1/admin/idiomas ────────────────────────────────────────────────

  Scenario: POST admin idiomas crea un nuevo idioma y devuelve 201
    When hago POST a "/v1/admin/idiomas" con body:
      """
      { "code": "de", "label": "Deutsch" }
      """
    Then la respuesta tiene status 201
    And el campo "code" de la respuesta es "de"
    And el campo "label" de la respuesta es "Deutsch"

  Scenario: POST admin idiomas sin code devuelve 404
    When hago POST a "/v1/admin/idiomas" con body:
      """
      { "label": "Sin código" }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: POST admin idiomas sin label devuelve 404
    When hago POST a "/v1/admin/idiomas" con body:
      """
      { "code": "xx" }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: POST admin idiomas con código duplicado devuelve 409
    When hago POST a "/v1/admin/idiomas" con body:
      """
      { "code": "es", "label": "Español duplicado" }
      """
    Then la respuesta tiene status 409
    And la respuesta contiene el campo "error"

  # ── PUT /v1/admin/idiomas/:idiomaId ──────────────────────────────────────

  Scenario: PUT admin idiomas actualiza la etiqueta de un idioma
    Given existe un idioma de prueba con código "it" y etiqueta "Italiano"
    When hago PUT a "/v1/admin/idiomas/{idiomaId}" con body:
      """
      { "label": "Italiano aggiornato" }
      """
    Then la respuesta tiene status 200
    And el campo "label" de la respuesta es "Italiano aggiornato"

  Scenario: PUT admin idiomas desactiva un idioma
    Given existe un idioma de prueba con código "pt" y etiqueta "Português"
    When hago PUT a "/v1/admin/idiomas/{idiomaId}" con body:
      """
      { "activo": false }
      """
    Then la respuesta tiene status 200
    And el campo "activo" de la respuesta es falso

  Scenario: PUT admin idiomas con id inexistente devuelve 404
    When hago PUT a "/v1/admin/idiomas/id-que-no-existe" con body:
      """
      { "label": "Nuevo nombre" }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── DELETE /v1/admin/idiomas/:idiomaId ───────────────────────────────────

  Scenario: DELETE admin idiomas elimina un idioma creado previamente
    Given existe un idioma de prueba con código "nl" y etiqueta "Nederlands"
    When hago DELETE a "/v1/admin/idiomas/{idiomaId}"
    Then la respuesta tiene status 204

  Scenario: DELETE admin idiomas con id inexistente devuelve 404
    When hago DELETE a "/v1/admin/idiomas/id-que-no-existe"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: DELETE admin idiomas del idioma por defecto español devuelve 400
    When hago DELETE a "/v1/admin/idiomas/id-es"
    Then la respuesta tiene status 400
    And el campo "error" de la respuesta contiene "por defecto"

  # ── GET /v1/admin/idiomas/:idiomaId/content ───────────────────────────────

  Scenario: GET content de idioma devuelve code y content con traducciones
    When hago GET a "/v1/admin/idiomas/id-es/content"
    Then la respuesta tiene status 200
    And el campo "code" de la respuesta es "es"
    And la respuesta contiene el campo "content"

  Scenario: GET content de idioma inexistente devuelve 404
    When hago GET a "/v1/admin/idiomas/id-que-no-existe/content"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── PUT /v1/admin/idiomas/:idiomaId/content ───────────────────────────────

  Scenario: PUT content reemplaza las traducciones de un idioma
    Given existe un idioma de prueba con código "ru" y etiqueta "Русский"
    When hago PUT a "/v1/admin/idiomas/{idiomaId}/content" con body:
      """
      { "content": { "btnContinue": "Продолжить", "btnSubmit": "Отправить" } }
      """
    Then la respuesta tiene status 200
    And el campo "content.btnContinue" de la respuesta es "Продолжить"

  Scenario: PUT content con contenido no objeto devuelve 404
    Given existe un idioma de prueba con código "ar" y etiqueta "العربية"
    When hago PUT a "/v1/admin/idiomas/{idiomaId}/content" con body:
      """
      { "content": null }
      """
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  Scenario: PUT content de idioma inexistente devuelve 404
    When hago PUT a "/v1/admin/idiomas/id-que-no-existe/content" con body:
      """
      { "content": { "key": "value" } }
      """
    Then la respuesta tiene status 404
