# language: es
Característica: Consulta de declaración por token
  Los usuarios pueden consultar el estado de su declaración usando el token recibido.

  Antecedentes:
    Dado que he accedido a la intranet con código "intranet2025"

  Escenario: Consulta exitosa con token válido
    Dado que he enviado un formulario y tengo un token de acceso
    Cuando navego a la página de consulta de token
    Y introduzco el token en el campo de búsqueda
    Y hago clic en consultar
    Entonces veo los datos de la declaración con el nombre del solicitante

  Escenario: Consulta con token vacío
    Dado que estoy en la página de consulta de token
    Cuando hago clic en consultar sin introducir token
    Entonces veo el error de token requerido

  Escenario: Consulta con token inexistente
    Dado que estoy en la página de consulta de token
    Cuando introduzco el token "token-que-no-existe-xyz"
    Y hago clic en consultar
    Entonces veo el mensaje de token no encontrado

  Escenario: Navegación desde consulta al formulario
    Dado que estoy en la página de consulta de token
    Cuando hago clic en el botón "Nuevo cuestionario"
    Entonces estoy en la página principal del formulario

  Escenario: Historial de tokens guardados
    Dado que he enviado un formulario y tengo un token de acceso
    Y navego a la página de consulta de token
    Entonces veo el historial de tokens en la página de consulta

  Escenario: Limpiar historial de tokens
    Dado que he enviado un formulario y tengo un token de acceso
    Y navego a la página de consulta de token
    Cuando hago clic en limpiar historial
    Entonces el historial de tokens está vacío
