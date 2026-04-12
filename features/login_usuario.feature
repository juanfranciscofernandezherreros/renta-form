# language: es
Característica: Login de usuario
  Los usuarios con cuenta pueden iniciar sesión con su DNI/NIE y contraseña.

  Antecedentes:
    Dado que he accedido a la intranet con código "intranet2025"

  Escenario: Login exitoso con credenciales válidas
    Dado que estoy en la página de login
    Cuando introduzco el DNI "12345678A" y la contraseña "renta2025"
    Y hago clic en el botón de acceder
    Entonces veo la página de perfil

  Escenario: Login con contraseña incorrecta
    Dado que estoy en la página de login
    Cuando introduzco el DNI "12345678A" y la contraseña "wrongpassword"
    Y hago clic en el botón de acceder
    Entonces veo un mensaje de error de credenciales inválidas

  Escenario: Login con DNI no existente
    Dado que estoy en la página de login
    Cuando introduzco el DNI "99999999Z" y la contraseña "renta2025"
    Y hago clic en el botón de acceder
    Entonces veo un mensaje de error de credenciales inválidas

  Escenario: Login con campos vacíos
    Dado que estoy en la página de login
    Cuando hago clic en el botón de acceder sin rellenar campos
    Entonces no se envía el formulario de login

  Escenario: Cerrar sesión
    Dado que he iniciado sesión con "12345678A" y "renta2025"
    Cuando hago clic en el botón de cerrar sesión
    Entonces veo el botón de acceder en la cabecera
    Y estoy en la página principal del formulario

  Escenario: Cambio de idioma en la página de login
    Dado que estoy en la página de login
    Cuando selecciono el idioma "en"
    Entonces veo el título en inglés "Access my file"

  Escenario: Redirección al perfil si ya está autenticado
    Dado que he iniciado sesión con "12345678A" y "renta2025"
    Cuando navego a "#/perfil"
    Entonces veo la página de perfil
