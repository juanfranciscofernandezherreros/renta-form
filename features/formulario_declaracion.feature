# language: es
Característica: Formulario de declaración de la renta
  El usuario puede rellenar y enviar el cuestionario IRPF.

  Antecedentes:
    Dado que he accedido a la intranet con código "intranet2025"

  Escenario: Envío exitoso del formulario completo
    Dado que estoy en la página principal del formulario
    Cuando relleno el campo "nombre" con "María"
    Y relleno el campo "apellidos" con "García López"
    Y relleno el campo "dniNie" con "12345678A"
    Y relleno el campo "email" con "maria@test.es"
    Y relleno el campo "telefono" con "600123456"
    Y respondo "no" a la pregunta "viviendaAlquiler"
    Y respondo "no" a la pregunta "viviendaPropiedad"
    Y respondo "no" a la pregunta "pisosAlquiladosTerceros"
    Y respondo "no" a la pregunta "segundaResidencia"
    Y respondo "no" a la pregunta "familiaNumerosa"
    Y respondo "no" a la pregunta "ayudasGobierno"
    Y respondo "no" a la pregunta "mayores65ACargo"
    Y respondo "no" a la pregunta "hijosMenores26"
    Y respondo "no" a la pregunta "ingresosJuego"
    Y respondo "no" a la pregunta "ingresosInversiones"
    Y hago clic en el botón de enviar cuestionario
    Entonces veo el panel de éxito con "¡Cuestionario enviado correctamente!"
    Y veo un token de consulta

  Escenario: Preguntas condicionales de vivienda en alquiler
    Dado que estoy en la página principal del formulario
    Cuando respondo "si" a la pregunta "viviendaAlquiler"
    Entonces veo la pregunta condicional "alquilerMenos35"

  Escenario: Preguntas condicionales de vivienda en propiedad
    Dado que estoy en la página principal del formulario
    Cuando respondo "si" a la pregunta "viviendaPropiedad"
    Entonces veo la pregunta condicional "propiedadAntes2013"

  Escenario: Preguntas condicionales de mayores a cargo
    Dado que estoy en la página principal del formulario
    Cuando respondo "si" a la pregunta "mayores65ACargo"
    Entonces veo la pregunta condicional "mayoresConviven"

  Escenario: Pregunta condicional oculta al cambiar respuesta
    Dado que estoy en la página principal del formulario
    Cuando respondo "si" a la pregunta "viviendaAlquiler"
    Y veo la pregunta condicional "alquilerMenos35"
    Y respondo "no" a la pregunta "viviendaAlquiler"
    Entonces no veo la pregunta condicional "alquilerMenos35"

  Escenario: Limpiar el formulario
    Dado que estoy en la página principal del formulario
    Cuando relleno el campo "nombre" con "Juan"
    Y hago clic en el botón de limpiar
    Y acepto la confirmación
    Entonces el campo "nombre" está vacío

  Escenario: El formulario muestra las 5 secciones de progreso
    Dado que estoy en la página principal del formulario
    Entonces veo el indicador de progreso con 5 pasos

  Escenario: Enviar otro cuestionario tras el éxito
    Dado que estoy en la página principal del formulario
    Cuando envío el formulario con datos mínimos válidos
    Y veo el panel de éxito con "¡Cuestionario enviado correctamente!"
    Y hago clic en "Enviar otro cuestionario"
    Entonces veo el formulario vacío de nuevo
