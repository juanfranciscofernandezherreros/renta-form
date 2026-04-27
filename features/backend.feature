@api @backend
Feature: Backend API – cobertura completa de endpoints
  Como ingeniero de QA del proyecto renta-form
  Quiero ejecutar un escenario por cada endpoint expuesto por el backend
  Para garantizar al menos un 90% de cobertura de las rutas y la lógica de negocio

  # ── Salud del servicio ────────────────────────────────────────────────────

  Scenario: GET /health responde con estado ok
    When envío "GET" a "/health"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "status"
    And la propiedad "status" de la respuesta JSON vale "ok"

  Scenario: Una ruta /v1/ inexistente devuelve 404
    When envío "GET" a "/v1/no-existe"
    Then la respuesta tiene status 404
    And la respuesta JSON tiene la propiedad "error"

  # ── Autenticación admin ───────────────────────────────────────────────────

  Scenario: POST /v1/auth/admin-login sin credenciales devuelve 400
    When envío "POST" a "/v1/auth/admin-login" con el JSON
      """
      {}
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/auth/admin-login con contraseña incorrecta es rechazado
    When envío "POST" a "/v1/auth/admin-login" con el JSON
      """
      {"username": "admin", "password": "no-es-la-buena"}
      """
    Then la respuesta tiene status 400
    And la respuesta JSON tiene la propiedad "error"

  Scenario: POST /v1/auth/admin-login con credenciales correctas devuelve token
    When envío "POST" a "/v1/auth/admin-login" con el JSON
      """
      {"username": "admin", "password": "admin"}
      """
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "token"

  Scenario: POST /v1/auth/change-password sin campos obligatorios devuelve 400
    When envío "POST" a "/v1/auth/change-password" con el JSON
      """
      {}
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/auth/change-password con datos inválidos devuelve error
    When envío "POST" a "/v1/auth/change-password" con el JSON
      """
      {"username": "admin", "oldPassword": "incorrecta", "newPassword": "nueva-segura-123"}
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/auth/change-email sin campos obligatorios devuelve 400
    When envío "POST" a "/v1/auth/change-email" con el JSON
      """
      {}
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/auth/change-password permite al admin cambiar y restaurar su contraseña
    When envío "POST" a "/v1/auth/change-password" con el JSON
      """
      {"username": "admin", "oldPassword": "admin", "newPassword": "admin-temp-1"}
      """
    Then la respuesta tiene status 200
    And la propiedad "success" de la respuesta JSON vale "true"
    When envío "POST" a "/v1/auth/change-password" con el JSON
      """
      {"username": "admin", "oldPassword": "admin-temp-1", "newPassword": "admin"}
      """
    Then la respuesta tiene status 200

  Scenario: POST /v1/auth/change-email valida el formato del nuevo email
    When envío "POST" a "/v1/auth/change-email" con el JSON
      """
      {"username": "admin", "newEmail": "no-es-email"}
      """
    Then la respuesta tiene un status de error de cliente

  Scenario: POST /v1/auth/change-email permite al admin actualizar y restaurar su email
    When envío "POST" a "/v1/auth/change-email" con el JSON
      """
      {"username": "admin", "newEmail": "admin-temp@example.com"}
      """
    Then la respuesta tiene status 200
    And la propiedad "success" de la respuesta JSON vale "true"
    When envío "POST" a "/v1/auth/change-email" con el JSON
      """
      {"username": "admin", "newEmail": "admin@example.com"}
      """
    Then la respuesta tiene status 200

  Scenario: POST /v1/auth/change-email rechaza usuarios sin permisos de admin
    When envío "POST" a "/v1/auth/change-email" con el JSON
      """
      {"username": "no-existe", "newEmail": "nuevo@example.com"}
      """
    Then la respuesta tiene un status de error de cliente

  # ── Catálogo público (preguntas, idiomas, traducciones) ──────────────────

  Scenario: GET /v1/irpf/preguntas devuelve un catálogo agrupado por secciones
    When envío "GET" a "/v1/irpf/preguntas"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "secciones"
    And la propiedad "secciones" de la respuesta JSON es un array no vacío

  Scenario: GET /v1/irpf/preguntas?lang=en devuelve textos traducidos
    When envío "GET" a "/v1/irpf/preguntas?lang=en"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "secciones"

  Scenario: El alias GET /v1/preguntas devuelve el mismo catálogo
    When envío "GET" a "/v1/preguntas"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "secciones"

  Scenario: GET /v1/irpf/idiomas devuelve la lista de idiomas
    When envío "GET" a "/v1/irpf/idiomas"
    Then la respuesta tiene status 200
    And el cuerpo de la respuesta es un array no vacío
    And cada elemento del array tiene las propiedades "code" y "label"

  Scenario: GET /v1/irpf/traducciones devuelve un mapa por código de idioma
    When envío "GET" a "/v1/irpf/traducciones"
    Then la respuesta tiene status 200
    And el cuerpo de la respuesta es un objeto con al menos una clave de idioma

  # ── Declaraciones – flujo público ─────────────────────────────────────────

  Scenario: POST /v1/public/declaraciones sin datos obligatorios devuelve 400
    When envío "POST" a "/v1/public/declaraciones" con el JSON
      """
      {"nombre": "Solo Nombre"}
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/public/declaraciones con respuesta inválida devuelve 400
    When envío "POST" a "/v1/public/declaraciones" con el JSON
      """
      {
        "nombre": "Pepe",
        "apellidos": "Pérez",
        "dniNie": "11111111H",
        "telefono": "600000001",
        "viviendaAlquiler": "tal-vez"
      }
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/public/declaraciones crea la declaración (201)
    Given un dniNie único en la variable "dniA"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniA"
    Then la respuesta tiene status 201
    And la respuesta JSON tiene la propiedad "id"
    And la respuesta JSON tiene la propiedad "estado"

  Scenario: POST /v1/public/declaraciones rechaza duplicados con 409
    Given un dniNie único en la variable "dniDup"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniDup"
    Then la respuesta tiene status 201
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniDup"
    Then la respuesta tiene status 409

  Scenario: POST /v1/irpf/declaraciones también acepta declaraciones públicas
    Given un dniNie único en la variable "dniB"
    When envío "POST" a "/v1/irpf/declaraciones" con la declaración usando "dniB"
    Then la respuesta tiene status 201

  Scenario: GET /v1/irpf/declaraciones lista por dniNie
    Given un dniNie único en la variable "dniC"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniC"
    Then la respuesta tiene status 201
    When envío "GET" a "/v1/irpf/declaraciones?dniNie=$dniC"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"
    And la respuesta JSON tiene la propiedad "total"

  Scenario: GET /v1/irpf/declaraciones/:id devuelve 404 para uuid no existente
    When envío "GET" a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000000"
    Then la respuesta tiene status 404

  Scenario: GET /v1/irpf/declaraciones/:id devuelve la declaración existente
    Given un dniNie único en la variable "dniD"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniD"
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "declD"
    When envío "GET" a "/v1/irpf/declaraciones/$declD"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "id"

  Scenario: GET /v1/irpf/consulta/:token devuelve 404 con uuid desconocido
    When envío "GET" a "/v1/irpf/consulta/00000000-0000-0000-0000-000000000000"
    Then la respuesta tiene status 404

  Scenario: GET /v1/irpf/consulta/:token recupera la declaración por su id
    Given un dniNie único en la variable "dniE"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniE"
    And guardo la propiedad "id" de la respuesta en la variable "declE"
    When envío "GET" a "/v1/irpf/consulta/$declE"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "id"

  Scenario: PUT /v1/irpf/declaraciones/:id actualiza un campo
    Given un dniNie único en la variable "dniF"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniF"
    And guardo la propiedad "id" de la respuesta en la variable "declF"
    When envío "PUT" a "/v1/irpf/declaraciones/$declF" con el JSON
      """
      {"telefono": "600999000", "viviendaAlquiler": "si", "alquilerMenos35": "no"}
      """
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "telefono"
    When envío "PUT" a "/v1/irpf/declaraciones/$declF" con el JSON
      """
      {"viviendaAlquiler": ""}
      """
    Then la respuesta tiene status 200
    When envío "PUT" a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000000" con el JSON
      """
      {"telefono": "600000000"}
      """
    Then la respuesta tiene status 404

  Scenario: POST /v1/public/declaraciones envía notificaciones cuando email_envio_activo=true
    Given inicio sesión como administrador
    When envío "PUT" autenticado a "/v1/admin/configuracion/email_envio_activo" con el JSON
      """
      {"valor": "true"}
      """
    Then la respuesta tiene status 200
    And un dniNie único en la variable "dniNotif"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniNotif"
    Then la respuesta tiene status 201
    When envío "PUT" autenticado a "/v1/admin/configuracion/email_envio_activo" con el JSON
      """
      {"valor": "false"}
      """
    Then la respuesta tiene status 200

  # ── Endpoints admin protegidos: autorización ──────────────────────────────

  Scenario Outline: Sin token de admin la respuesta es 401 en <ruta>
    When envío "<metodo>" a "<ruta>"
    Then la respuesta tiene status 401

    Examples:
      | metodo | ruta                                |
      | GET    | /v1/admin/users                     |
      | GET    | /v1/admin/preguntas-formulario      |
      | GET    | /v1/admin/idiomas                   |
      | GET    | /v1/admin/roles                     |
      | GET    | /v1/admin/configuracion             |
      | GET    | /v1/admin/traducciones/faltantes    |
      | GET    | /v1/irpf/declaraciones/all          |

  # ── Declaraciones – endpoints admin ───────────────────────────────────────

  Scenario: GET /v1/irpf/declaraciones/all devuelve listado paginado
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/irpf/declaraciones/all?limit=1"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"
    And la respuesta JSON tiene la propiedad "total"

  Scenario: PATCH /v1/irpf/declaraciones/:id sin estado devuelve 400
    Given inicio sesión como administrador
    When envío "PATCH" autenticado a "/v1/irpf/declaraciones/00000000-0000-0000-0000-000000000000" con el JSON
      """
      {}
      """
    Then la respuesta tiene status 400

  Scenario: PATCH /v1/irpf/declaraciones/:id actualiza el estado
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniG"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniG"
    And guardo la propiedad "id" de la respuesta en la variable "declG"
    When envío "PATCH" autenticado a "/v1/irpf/declaraciones/$declG" con el JSON
      """
      {"estado": "en_revision"}
      """
    Then la respuesta tiene status 200
    And la propiedad "estado" de la respuesta JSON vale "en_revision"

  Scenario: DELETE /v1/irpf/declaraciones/:id elimina la declaración
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniH"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniH"
    And guardo la propiedad "id" de la respuesta en la variable "declH"
    When envío "DELETE" autenticado a "/v1/irpf/declaraciones/$declH"
    Then la respuesta tiene status 200
    When envío "GET" a "/v1/irpf/declaraciones/$declH"
    Then la respuesta tiene status 404

  Scenario: POST /v1/irpf/declaraciones/:id/email con envío desactivado devuelve 503
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniMail"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniMail"
    And guardo la propiedad "id" de la respuesta en la variable "declMail"
    When envío "POST" autenticado a "/v1/irpf/declaraciones/$declMail/email" con el JSON
      """
      {"email": "destinatario@example.com", "mensaje": "test"}
      """
    Then la respuesta tiene un status de error de servicio

  # ── Preguntas del formulario (admin CRUD) ─────────────────────────────────

  Scenario: GET /v1/admin/preguntas-formulario lista las preguntas
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/preguntas-formulario?limit=5"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"
    And la respuesta JSON tiene la propiedad "total"

  Scenario: POST /v1/admin/preguntas-formulario crea, actualiza y borra una pregunta
    Given inicio sesión como administrador
    And un campo único en la variable "campoX"
    When envío "POST" autenticado a "/v1/admin/preguntas-formulario" con el JSON
      """
      {"campo": "$campoX", "orden": 999, "textos": {"es": "Pregunta de prueba"}}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "preguntaId"
    When envío "PUT" autenticado a "/v1/admin/preguntas-formulario/$preguntaId" con el JSON
      """
      {"orden": 1000}
      """
    Then la respuesta tiene status 200
    When envío "DELETE" autenticado a "/v1/admin/preguntas-formulario/$preguntaId"
    Then la respuesta tiene status 204

  Scenario: POST /v1/admin/preguntas-formulario acepta el formato legacy "texto"
    Given inicio sesión como administrador
    And un campo único en la variable "campoLegacy"
    When envío "POST" autenticado a "/v1/admin/preguntas-formulario" con el JSON
      """
      {"campo": "$campoLegacy", "orden": 1, "texto": "Pregunta legacy"}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "preguntaLegacyId"
    When envío "PUT" autenticado a "/v1/admin/preguntas-formulario/$preguntaLegacyId" con el JSON
      """
      {"orden": 5, "texto": "Pregunta legacy actualizada"}
      """
    Then la respuesta tiene status 200
    When envío "PUT" autenticado a "/v1/admin/preguntas-formulario/$preguntaLegacyId" con el JSON
      """
      {"orden": 1}
      """
    Then la respuesta tiene status 200
    When envío "DELETE" autenticado a "/v1/admin/preguntas-formulario/$preguntaLegacyId"
    Then la respuesta tiene status 204

  Scenario: POST /v1/admin/preguntas-formulario rechaza un campo duplicado con 409
    Given inicio sesión como administrador
    And un campo único en la variable "campoDup"
    When envío "POST" autenticado a "/v1/admin/preguntas-formulario" con el JSON
      """
      {"campo": "$campoDup", "textos": {"es": "Original"}}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "campoDupId"
    When envío "POST" autenticado a "/v1/admin/preguntas-formulario" con el JSON
      """
      {"campo": "$campoDup", "textos": {"es": "Duplicada"}}
      """
    Then la respuesta tiene status 409
    When envío "DELETE" autenticado a "/v1/admin/preguntas-formulario/$campoDupId"
    Then la respuesta tiene status 204

  Scenario: PUT /v1/admin/preguntas-formulario/:id valida los datos enviados
    Given inicio sesión como administrador
    When envío "PUT" autenticado a "/v1/admin/preguntas-formulario/00000000-0000-0000-0000-000000000000" con el JSON
      """
      {"orden": "no-numero"}
      """
    Then la respuesta tiene un status de error de cliente
    When envío "PUT" autenticado a "/v1/admin/preguntas-formulario/00000000-0000-0000-0000-000000000000" con el JSON
      """
      {"campo": "InValid Campo"}
      """
    Then la respuesta tiene un status de error de cliente

  Scenario: DELETE /v1/admin/preguntas-formulario/:id devuelve 404 si no existe
    Given inicio sesión como administrador
    When envío "DELETE" autenticado a "/v1/admin/preguntas-formulario/00000000-0000-0000-0000-000000000000"
    Then la respuesta tiene status 404

  # ── Idiomas (admin CRUD + content) ────────────────────────────────────────

  Scenario: GET /v1/admin/idiomas devuelve listado paginado
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/idiomas?limit=10"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"

  Scenario: CRUD completo de un idioma
    Given inicio sesión como administrador
    And un código de idioma único en la variable "codX"
    When envío "POST" autenticado a "/v1/admin/idiomas" con el JSON
      """
      {"code": "$codX", "label": "Idioma Test", "activo": true}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "idiomaId"
    When envío "PUT" autenticado a "/v1/admin/idiomas/$idiomaId" con el JSON
      """
      {"label": "Idioma Test 2", "activo": false}
      """
    Then la respuesta tiene status 200
    When envío "GET" autenticado a "/v1/admin/idiomas/$idiomaId/content"
    Then la respuesta tiene status 200
    When envío "PUT" autenticado a "/v1/admin/idiomas/$idiomaId/content" con el JSON
      """
      {"content": {"btnLogin": "Entrar (test)"}}
      """
    Then la respuesta tiene status 200
    When envío "DELETE" autenticado a "/v1/admin/idiomas/$idiomaId"
    Then la respuesta tiene status 204

  Scenario: POST /v1/admin/idiomas rechaza un código duplicado con 409
    Given inicio sesión como administrador
    And un código de idioma único en la variable "codDup"
    When envío "POST" autenticado a "/v1/admin/idiomas" con el JSON
      """
      {"code": "$codDup", "label": "Dup1"}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "idiomaDupId"
    When envío "POST" autenticado a "/v1/admin/idiomas" con el JSON
      """
      {"code": "$codDup", "label": "Dup2"}
      """
    Then la respuesta tiene un status de error de cliente
    When envío "DELETE" autenticado a "/v1/admin/idiomas/$idiomaDupId"
    Then la respuesta tiene status 204

  Scenario: GET y PUT de un idioma inexistente devuelven 404
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/idiomas/00000000-0000-0000-0000-000000000000/content"
    Then la respuesta tiene status 404
    When envío "DELETE" autenticado a "/v1/admin/idiomas/00000000-0000-0000-0000-000000000000"
    Then la respuesta tiene status 404

  # ── Roles (admin CRUD) ────────────────────────────────────────────────────

  Scenario: GET /v1/admin/roles devuelve la lista de roles
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/roles"
    Then la respuesta tiene status 200
    And el cuerpo de la respuesta es un array no vacío

  Scenario: CRUD completo de un rol
    Given inicio sesión como administrador
    And un nombre de rol único en la variable "rolX"
    When envío "POST" autenticado a "/v1/admin/roles" con el JSON
      """
      {"nombre": "$rolX", "descripcion": "rol de prueba"}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "rolId"
    When envío "PUT" autenticado a "/v1/admin/roles/$rolId" con el JSON
      """
      {"descripcion": "actualizado"}
      """
    Then la respuesta tiene status 200
    When envío "DELETE" autenticado a "/v1/admin/roles/$rolId"
    Then la respuesta tiene status 204

  Scenario: PUT /v1/admin/roles rechaza renombrar roles reservados
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/roles"
    Then la respuesta tiene status 200
    And guardo el id del rol "admin" en la variable "rolAdminId"
    When envío "PUT" autenticado a "/v1/admin/roles/$rolAdminId" con el JSON
      """
      {"nombre": "super-admin"}
      """
    Then la respuesta tiene un status de error de cliente

  Scenario: POST /v1/admin/roles rechaza un nombre duplicado con 409
    Given inicio sesión como administrador
    And un nombre de rol único en la variable "rolDup"
    When envío "POST" autenticado a "/v1/admin/roles" con el JSON
      """
      {"nombre": "$rolDup"}
      """
    Then la respuesta tiene status 201
    And guardo la propiedad "id" de la respuesta en la variable "rolDupId"
    When envío "POST" autenticado a "/v1/admin/roles" con el JSON
      """
      {"nombre": "$rolDup"}
      """
    Then la respuesta tiene status 409
    When envío "DELETE" autenticado a "/v1/admin/roles/$rolDupId"
    Then la respuesta tiene status 204

  Scenario: GET /v1/admin/users acepta filtros search y de estado
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/users?search=test&bloqueado=false&denunciado=false"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"

  Scenario: GET /v1/admin/users con token corrupto en el header devuelve 401
    When envío "GET" a "/v1/admin/users" con cabecera "Authorization" "Bearer token-claramente-invalido"
    Then la respuesta tiene status 401

  Scenario: GET /v1/admin/users sin esquema Bearer devuelve 401
    When envío "GET" a "/v1/admin/users" con cabecera "Authorization" "Basic dXNlcjpwYXNz"
    Then la respuesta tiene status 401

  Scenario: POST /v1/irpf/declaraciones/:id/email respeta la configuración email_envio_activo
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniMail2"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniMail2"
    And guardo la propiedad "id" de la respuesta en la variable "declMail2"
    When envío "PUT" autenticado a "/v1/admin/configuracion/email_envio_activo" con el JSON
      """
      {"valor": "true"}
      """
    Then la respuesta tiene status 200
    When envío "POST" autenticado a "/v1/irpf/declaraciones/$declMail2/email" con el JSON
      """
      {"email": "destinatario@example.com", "mensaje": "test"}
      """
    Then la respuesta tiene un status de error de servicio
    When envío "PUT" autenticado a "/v1/admin/configuracion/email_envio_activo" con el JSON
      """
      {"valor": "false"}
      """
    Then la respuesta tiene status 200

  # ── Usuarios (admin) ──────────────────────────────────────────────────────

  Scenario: GET /v1/admin/users lista usuarios paginados
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/users?limit=5"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"

  Scenario: POST /v1/admin/users/assign sin datos obligatorios devuelve error
    Given inicio sesión como administrador
    When envío "POST" autenticado a "/v1/admin/users/assign" con el JSON
      """
      {}
      """
    Then la respuesta tiene un status de error de cliente

  Scenario: Flujo completo de asignación y gestión de un usuario
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniU"
    When envío "POST" a "/v1/public/declaraciones" con la declaración usando "dniU"
    And guardo la propiedad "id" de la respuesta en la variable "declU"
    When envío "POST" autenticado a "/v1/admin/users/assign" con el JSON
      """
      {"dniNie": "$dniU", "password": "secreta-123", "declaracionId": "$declU"}
      """
    Then la respuesta tiene status 200
    When envío "GET" autenticado a "/v1/admin/users/$dniU"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "dniNie"
    When envío "PATCH" autenticado a "/v1/admin/users/$dniU/block" con el JSON
      """
      {"bloqueado": true}
      """
    Then la respuesta tiene status 200
    When envío "PATCH" autenticado a "/v1/admin/users/$dniU/report" con el JSON
      """
      {"denunciado": true}
      """
    Then la respuesta tiene status 200
    When envío "GET" autenticado a "/v1/admin/users/$dniU/roles"
    Then la respuesta tiene status 200
    When envío "PUT" autenticado a "/v1/admin/users/$dniU/roles" con el JSON
      """
      {"roles": ["user"]}
      """
    Then la respuesta tiene status 200
    When envío "POST" autenticado a "/v1/admin/users/$dniU/email" con el JSON
      """
      {"email": "u@u.com", "mensaje": "hola"}
      """
    Then la respuesta tiene un status de error de servicio
    When envío "DELETE" autenticado a "/v1/admin/users/$dniU"
    Then la respuesta tiene status 200

  # ── Configuración ─────────────────────────────────────────────────────────

  Scenario: GET y PUT /v1/admin/configuracion
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/configuracion"
    Then la respuesta tiene status 200
    When envío "PUT" autenticado a "/v1/admin/configuracion/email_envio_activo" con el JSON
      """
      {"valor": "false"}
      """
    Then la respuesta tiene status 200
    And la propiedad "valor" de la respuesta JSON vale "false"

  # ── Importación CSV ───────────────────────────────────────────────────────

  Scenario: GET /v1/admin/declaraciones/import/template descarga la plantilla CSV
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/declaraciones/import/template"
    Then la respuesta tiene status 200
    And la respuesta es un texto que contiene "nombre,apellidos,dniNie"

  Scenario: POST /v1/admin/declaraciones/import sin campo csv devuelve 400
    Given inicio sesión como administrador
    When envío "POST" autenticado a "/v1/admin/declaraciones/import" con el JSON
      """
      {}
      """
    Then la respuesta tiene status 400

  Scenario: POST /v1/admin/declaraciones/import procesa un CSV válido
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniCsv"
    When envío "POST" autenticado a "/v1/admin/declaraciones/import" con el JSON
      """
      {"csv": "nombre,apellidos,dniNie,email,telefono,viviendaAlquiler,alquilerMenos35\nPepe,Pérez,$dniCsv,p@p.com,600000099,si,no"}
      """
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "imported"

  Scenario: POST /v1/admin/declaraciones/import valida los valores de las respuestas
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniCsvBad"
    When envío "POST" autenticado a "/v1/admin/declaraciones/import" con el JSON
      """
      {"csv": "nombre,apellidos,dniNie,email,telefono,viviendaAlquiler\nPepe,Pérez,$dniCsvBad,p@p.com,600000111,quizá"}
      """
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "rows"

  Scenario: POST /v1/admin/declaraciones/import rechaza importaciones por encima del límite
    Given inicio sesión como administrador
    When envío "POST" autenticado a "/v1/admin/declaraciones/import" con un CSV de 40 filas vacías
    Then la respuesta tiene status 400

  # ── Traducciones faltantes ────────────────────────────────────────────────

  Scenario: GET /v1/admin/traducciones/faltantes devuelve la auditoría de claves
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/traducciones/faltantes"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "claves_requeridas"

  Scenario: GET /v1/admin/traducciones/faltantes con ref=es usa el idioma como referencia
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/traducciones/faltantes?ref=es"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "faltantes"
    And la respuesta JSON tiene la propiedad "resumen"

  Scenario: GET /v1/admin/traducciones/faltantes con ref desconocido cae al modo estático
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/admin/traducciones/faltantes?ref=xx-no-existe"
    Then la respuesta tiene status 200
    And la propiedad "referencia" de la respuesta JSON vale "static"

  # ── Importación CSV: casos avanzados ──────────────────────────────────────

  Scenario: POST /v1/admin/declaraciones/import acepta CSV con campos entrecomillados
    Given inicio sesión como administrador
    And un dniNie único en la variable "dniCsv2"
    When envío "POST" autenticado a "/v1/admin/declaraciones/import" con el JSON
      """
      {"csv": "nombre,apellidos,dniNie,email,telefono\r\n\"Juan, José\",\"Pé\"\"rez\",$dniCsv2,j@example.com,600000077"}
      """
    Then la respuesta tiene status 200

  Scenario: POST /v1/admin/declaraciones/import comunica errores fila a fila
    Given inicio sesión como administrador
    When envío "POST" autenticado a "/v1/admin/declaraciones/import" con el JSON
      """
      {"csv": "nombre,apellidos,dniNie,email,telefono\nSinDni,User,,n@n.com,600000088"}
      """
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "rows"
    And la respuesta JSON tiene la propiedad "failed"

  # ── Listado de declaraciones con filtros ──────────────────────────────────

  Scenario: GET /v1/irpf/declaraciones acepta el filtro por estado
    When envío "GET" a "/v1/irpf/declaraciones?estado=recibido&page=1&limit=2"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"

  Scenario: GET /v1/irpf/declaraciones/all acepta filtros combinados
    Given inicio sesión como administrador
    When envío "GET" autenticado a "/v1/irpf/declaraciones/all?estado=recibido&page=1&limit=2"
    Then la respuesta tiene status 200
    And la respuesta JSON tiene la propiedad "data"
