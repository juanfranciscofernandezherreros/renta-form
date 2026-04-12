# language: es
Característica: Acceso a la intranet
  La aplicación requiere un código de acceso antes de mostrar cualquier contenido.

  Escenario: Acceso con código válido
    Dado que visito la página principal
    Cuando introduzco el código de acceso "intranet2025"
    Y hago clic en el botón de entrar
    Entonces veo el formulario de cuestionario fiscal

  Escenario: Acceso con código inválido
    Dado que visito la página principal
    Cuando introduzco el código de acceso "codigoinvalido"
    Y hago clic en el botón de entrar
    Entonces veo un mensaje de error en la página de intranet

  Escenario: Sin código de acceso
    Dado que visito la página principal
    Cuando hago clic en el botón de entrar sin código
    Entonces veo el mensaje "El código de acceso es obligatorio"
