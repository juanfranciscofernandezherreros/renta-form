# language: es
Característica: Panel de administración
  El administrador puede gestionar declaraciones, preguntas, secciones y usuarios.

  Antecedentes:
    Dado que he accedido a la intranet con código "intranet2025"

  Escenario: Acceso al panel admin con credenciales correctas
    Dado que navego a la ruta "#/admin"
    Cuando introduzco usuario admin "admin" y contraseña "admin"
    Y confirmo el login de admin
    Entonces veo el panel de administración
    Y veo la pestaña "Declaraciones"

  Escenario: Acceso al panel admin con credenciales incorrectas
    Dado que navego a la ruta "#/admin"
    Cuando introduzco usuario admin "admin" y contraseña "wrongpass"
    Y confirmo el login de admin
    Entonces veo el error de login de admin

  Escenario: Ver lista de declaraciones en el admin
    Dado que he iniciado sesión como administrador
    Entonces veo la lista de declaraciones en el admin

  Escenario: Cambiar el estado de una declaración
    Dado que he iniciado sesión como administrador
    Y hay declaraciones en el panel de admin
    Cuando cambio el estado de la primera declaración a "en_revision"
    Entonces la primera declaración muestra el estado "En revisión"

  Escenario: Buscar declaraciones por DNI en el admin
    Dado que he iniciado sesión como administrador
    Cuando busco declaraciones por DNI "12345678A"
    Entonces veo solo declaraciones del DNI "12345678A"

  Escenario: Ver pestaña de preguntas en el admin
    Dado que he iniciado sesión como administrador
    Cuando hago clic en la pestaña "Preguntas"
    Entonces veo la lista de preguntas del catálogo

  Escenario: Ver pestaña de secciones en el admin
    Dado que he iniciado sesión como administrador
    Cuando hago clic en la pestaña "Secciones"
    Entonces veo la lista de secciones del catálogo

  Escenario: Ver pestaña de usuarios en el admin
    Dado que he iniciado sesión como administrador
    Cuando hago clic en la pestaña "Usuarios"
    Entonces veo la tabla de usuarios registrados

  Escenario: Ver pestaña de idiomas en el admin
    Dado que he iniciado sesión como administrador
    Cuando hago clic en la pestaña "Idiomas"
    Entonces veo la configuración de idiomas disponibles

  Escenario: Eliminar una declaración en el admin
    Dado que he iniciado sesión como administrador
    Y hay declaraciones en el panel de admin
    Cuando elimino la primera declaración
    Entonces el número de declaraciones disminuye en 1
