@api
Feature: IRPF – endpoints públicos y de declaraciones

  # ── GET /v1/irpf/preguntas ────────────────────────────────────────────────

  Scenario: GET preguntas devuelve objeto con secciones
    When hago GET a "/v1/irpf/preguntas"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "secciones"

  Scenario: Las secciones de preguntas contienen al menos una pregunta
    When hago GET a "/v1/irpf/preguntas"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "secciones"

  Scenario: GET preguntas con tabla vacía devuelve estructura válida sin errores
    Given no hay preguntas en el sistema
    When hago GET a "/v1/irpf/preguntas"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "secciones"

  # ── GET /v1/irpf/idiomas ──────────────────────────────────────────────────

  Scenario: GET idiomas devuelve un array con los idiomas activos
    When hago GET a "/v1/irpf/idiomas"
    Then la respuesta tiene status 200
    And la respuesta es un array

  Scenario: Cada idioma tiene los campos code y label
    When hago GET a "/v1/irpf/idiomas"
    Then la respuesta tiene status 200
    And la respuesta tiene al menos 1 elementos

  # ── GET /v1/irpf/traducciones ─────────────────────────────────────────────

  Scenario: GET traducciones devuelve un objeto agrupado por código de idioma
    When hago GET a "/v1/irpf/traducciones"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "es"

  Scenario: Las traducciones del español incluyen la clave btnContinue
    When hago GET a "/v1/irpf/traducciones"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "es.btnContinue"

  # ── GET /v1/irpf/declaraciones ────────────────────────────────────────────

  Scenario: GET declaraciones devuelve paginación con data, total, page y limit
    When hago GET a "/v1/irpf/declaraciones"
    Then la respuesta tiene status 200
    And la respuesta contiene las claves "data, total, page, limit"

  Scenario: GET declaraciones con filtro dniNie devuelve sólo las coincidentes
    Given existe una declaración de prueba
    When hago GET a "/v1/irpf/declaraciones?dniNie={declaracionDniNie}"
    Then la respuesta tiene status 200
    And el campo "total" de la respuesta es 1

  Scenario: GET declaraciones con filtro estado pendiente devuelve la creada
    Given existe una declaración de prueba
    When hago GET a "/v1/irpf/declaraciones?estado=pendiente"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "data"

  # ── GET /v1/irpf/declaraciones/all ───────────────────────────────────────

  Scenario: GET declaraciones all devuelve listado completo paginado
    When hago GET a "/v1/irpf/declaraciones/all"
    Then la respuesta tiene status 200
    And la respuesta contiene las claves "data, total, page, limit"

  Scenario: GET declaraciones all con búsqueda por dniNie parcial
    Given existe una declaración de prueba
    When hago GET a "/v1/irpf/declaraciones/all?dniNie=TST"
    Then la respuesta tiene status 200
    And la respuesta contiene el campo "data"

  # ── POST /v1/irpf/declaraciones ───────────────────────────────────────────

  Scenario: POST declaraciones crea una declaración y devuelve 201 con id
    When hago POST a "/v1/irpf/declaraciones" con body:
      """
      {
        "nombre": "María", "apellidos": "González Ruiz", "dniNie": "87654321B",
        "email": "maria@ejemplo.es", "telefono": "611222333",
        "viviendaAlquiler": "no", "viviendaPropiedad": "no",
        "pisosAlquiladosTerceros": "no", "segundaResidencia": "no",
        "familiaNumerosa": "no", "ayudasGobierno": "no", "mayores65ACargo": "no",
        "hijosMenores26": "no", "ingresosJuego": "no", "ingresosInversiones": "no"
      }
      """
    Then la respuesta tiene status 201
    And la respuesta contiene el campo "id"

  Scenario: POST declaraciones con dniNie duplicado devuelve 409
    Given existe una declaración de prueba
    When hago POST a "/v1/irpf/declaraciones" con body:
      """
      {
        "nombre": "Dup", "apellidos": "Duplicado", "dniNie": "{declaracionDniNie}",
        "email": "dup@test.com", "telefono": "600000001",
        "viviendaAlquiler": "no", "viviendaPropiedad": "no",
        "pisosAlquiladosTerceros": "no", "segundaResidencia": "no",
        "familiaNumerosa": "no", "ayudasGobierno": "no", "mayores65ACargo": "no",
        "hijosMenores26": "no", "ingresosJuego": "no", "ingresosInversiones": "no"
      }
      """
    Then la respuesta tiene status 409
    And el campo "error" de la respuesta contiene "declaración"

  Scenario: POST declaraciones con campos si/no vacíos devuelve 400
    When hago POST a "/v1/irpf/declaraciones" con body:
      """
      {
        "nombre": "Juan Francisco", "apellidos": "Fernández Herreros",
        "dniNie": "56985470A", "email": "juan@ejemplo.es", "telefono": "669198862",
        "viviendaAlquiler": "", "viviendaPropiedad": "",
        "pisosAlquiladosTerceros": "", "segundaResidencia": "",
        "familiaNumerosa": "", "ayudasGobierno": "", "mayores65ACargo": "",
        "hijosMenores26": "", "ingresosJuego": "", "ingresosInversiones": ""
      }
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  Scenario: POST declaraciones sin campos de identificación obligatorios devuelve 400
    When hago POST a "/v1/irpf/declaraciones" con body:
      """
      {
        "nombre": "", "apellidos": "", "dniNie": "",
        "email": "", "telefono": "",
        "viviendaAlquiler": "no", "viviendaPropiedad": "no",
        "pisosAlquiladosTerceros": "no", "segundaResidencia": "no",
        "familiaNumerosa": "no", "ayudasGobierno": "no", "mayores65ACargo": "no",
        "hijosMenores26": "no", "ingresosJuego": "no", "ingresosInversiones": "no"
      }
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  # ── GET /v1/irpf/declaraciones/:id ───────────────────────────────────────

  Scenario: GET declaraciones por id devuelve la declaración correcta
    Given existe una declaración de prueba
    When hago GET a "/v1/irpf/declaraciones/{declaracionId}"
    Then la respuesta tiene status 200
    And el campo "id" de la respuesta es "{declaracionId}"
    And el campo "dniNie" de la respuesta es "{declaracionDniNie}"

  Scenario: GET declaraciones con id inexistente devuelve 404
    When hago GET a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000000"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── PATCH /v1/irpf/declaraciones/:id ─────────────────────────────────────

  Scenario: PATCH declaraciones actualiza el estado a revisada
    Given existe una declaración de prueba
    When hago PATCH a "/v1/irpf/declaraciones/{declaracionId}" con body:
      """
      { "estado": "revisada" }
      """
    Then la respuesta tiene status 200
    And el campo "estado" de la respuesta es "revisada"

  Scenario: PATCH declaraciones sin estado devuelve 400
    Given existe una declaración de prueba
    When hago PATCH a "/v1/irpf/declaraciones/{declaracionId}" con body:
      """
      {}
      """
    Then la respuesta tiene status 400
    And la respuesta contiene el campo "error"

  Scenario: PATCH declaraciones con id inexistente devuelve 404
    When hago PATCH a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000001" con body:
      """
      { "estado": "revisada" }
      """
    Then la respuesta tiene status 404

  # ── PUT /v1/irpf/declaraciones/:id ───────────────────────────────────────

  Scenario: PUT declaraciones actualiza campos del formulario
    Given existe una declaración de prueba
    When hago PUT a "/v1/irpf/declaraciones/{declaracionId}" con body:
      """
      { "nombre": "NombreActualizado", "viviendaAlquiler": "si" }
      """
    Then la respuesta tiene status 200
    And el campo "nombre" de la respuesta es "NombreActualizado"

  Scenario: PUT declaraciones con id inexistente devuelve 404
    When hago PUT a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000002" con body:
      """
      { "nombre": "Test" }
      """
    Then la respuesta tiene status 404

  # ── DELETE /v1/irpf/declaraciones/:id ────────────────────────────────────

  Scenario: DELETE declaraciones elimina la declaración y devuelve success
    Given existe una declaración de prueba
    When hago DELETE a "/v1/irpf/declaraciones/{declaracionId}"
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero

  Scenario: DELETE declaraciones con id inexistente devuelve 404
    When hago DELETE a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000003"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"

  # ── POST /v1/irpf/declaraciones/:id/email ────────────────────────────────

  Scenario: POST email de declaración devuelve success y to
    Given existe una declaración de prueba
    When hago POST a "/v1/irpf/declaraciones/{declaracionId}/email" con body:
      """
      { "email": "notificacion@ejemplo.es", "mensaje": "Su declaración ha sido revisada." }
      """
    Then la respuesta tiene status 200
    And el campo "success" de la respuesta es verdadero
    And el campo "to" de la respuesta es "notificacion@ejemplo.es"

  # ── GET /v1/irpf/consulta/:token ─────────────────────────────────────────

  Scenario: GET consulta por token devuelve la declaración cuando existe
    Given existe una declaración de prueba
    When hago GET a "/v1/irpf/consulta/{declaracionId}"
    Then la respuesta tiene status 200
    And el campo "id" de la respuesta es "{declaracionId}"

  Scenario: GET consulta con token inexistente devuelve 404
    When hago GET a "/v1/irpf/consulta/token-que-no-existe"
    Then la respuesta tiene status 404
    And la respuesta contiene el campo "error"
