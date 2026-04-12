# language: es
Característica: Perfil de usuario
  Los usuarios autenticados pueden consultar sus declaraciones y cambiar su contraseña.

  Antecedentes:
    Dado que he accedido a la intranet con código "intranet2025"
    Dado que he iniciado sesión con "12345678A" y "renta2025"

  Escenario: Ver declaraciones en el perfil
    Dado que estoy en la página de perfil
    Entonces veo la lista de declaraciones del usuario
    Y veo el DNI del usuario en la cabecera de perfil

  Escenario: Expandir los detalles de una declaración
    Dado que estoy en la página de perfil
    Y hay al menos una declaración en la lista
    Cuando hago clic para expandir la primera declaración
    Entonces veo los detalles de la declaración expandida

  Escenario: Cambio de contraseña exitoso
    Dado que estoy en la página de perfil
    Cuando relleno el formulario de cambio de contraseña con contraseña actual "renta2025" y nueva "nueva1234"
    Y hago clic en guardar nueva contraseña
    Entonces veo el mensaje de éxito del cambio de contraseña
    Y restablezco la contraseña a "renta2025" con la contraseña actual "nueva1234"

  Escenario: Cambio de contraseña con contraseña actual incorrecta
    Dado que estoy en la página de perfil
    Cuando relleno el formulario de cambio de contraseña con contraseña actual "incorrecta" y nueva "nueva1234"
    Y hago clic en guardar nueva contraseña
    Entonces veo el error de contraseña incorrecta

  Escenario: Cambio de contraseña demasiado corta
    Dado que estoy en la página de perfil
    Cuando relleno el formulario de cambio de contraseña con contraseña actual "renta2025" y nueva "abc"
    Y hago clic en guardar nueva contraseña
    Entonces veo el error de contraseña demasiado corta

  Escenario: Cambio de contraseña sin confirmación coincidente
    Dado que estoy en la página de perfil
    Cuando relleno el formulario de cambio de contraseña con contraseña actual "renta2025", nueva "nueva1234" y confirmación "diferente"
    Y hago clic en guardar nueva contraseña
    Entonces veo el error de contraseñas no coinciden

  Escenario: Descargar PDF de una declaración
    Dado que estoy en la página de perfil
    Y hay al menos una declaración en la lista
    Cuando hago clic para expandir la primera declaración
    Entonces veo el botón de descargar PDF

  Escenario: Navegar al formulario desde el perfil
    Dado que estoy en la página de perfil
    Cuando hago clic en el botón "Nuevo cuestionario" del perfil
    Entonces estoy en la página principal del formulario
