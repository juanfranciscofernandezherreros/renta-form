Feature: Idiomas y traducciones de la interfaz

  # ── Selector de idioma visible ──────────────────────────────────────────

  Scenario: El selector de idioma es visible en la página principal
    Given el usuario abre la pagina principal
    Then el selector de idioma es visible
    Then se toma un screenshot "idiomas_01_selector_visible"

  Scenario: El selector de idioma es visible en la página de login
    Given el usuario navega a la pantalla de login
    Then el selector de idioma es visible
    Then se toma un screenshot "idiomas_02_selector_login"

  Scenario: El selector de idioma es visible en la página de consulta
    Given el usuario navega a la pantalla de consulta
    Then el selector de idioma es visible
    Then se toma un screenshot "idiomas_03_selector_consulta"

  # ── Idioma por defecto ──────────────────────────────────────────────────

  Scenario: El idioma español está activo por defecto en la página principal
    Given el usuario abre la pagina principal
    Then el botón de idioma "ES" está activo

  Scenario: El idioma español está activo por defecto en la página de login
    Given el usuario navega a la pantalla de login
    Then el botón de idioma "ES" está activo

  # ── Cambio de idioma ────────────────────────────────────────────────────

  Scenario: Cambiar al inglés activa el botón EN y desactiva el español
    Given el usuario abre la pagina principal
    When el usuario selecciona el idioma "EN"
    Then el botón de idioma "EN" está activo
    Then el botón de idioma "ES" no está activo
    Then se toma un screenshot "idiomas_04_ingles_activo"

  Scenario: Cambiar al catalán activa el botón CA
    Given el usuario abre la pagina principal
    When el usuario selecciona el idioma "CA"
    Then el botón de idioma "CA" está activo
    Then se toma un screenshot "idiomas_05_catalan_activo"

  Scenario: Cambiar al francés activa el botón FR
    Given el usuario abre la pagina principal
    When el usuario selecciona el idioma "FR"
    Then el botón de idioma "FR" está activo
    Then se toma un screenshot "idiomas_06_frances_activo"

  Scenario: Se puede volver al español después de cambiar de idioma
    Given el usuario abre la pagina principal
    When el usuario selecciona el idioma "EN"
    Then el botón de idioma "EN" está activo
    When el usuario selecciona el idioma "ES"
    Then el botón de idioma "ES" está activo

  # ── Traducciones aplicadas con mock de API ──────────────────────────────

  Scenario: Las traducciones al inglés se aplican correctamente en los botones
    Given el usuario abre la pagina con traducciones simuladas
    When el usuario selecciona el idioma "EN"
    Then el botón de continuar muestra el texto traducido al inglés
    Then se toma un screenshot "idiomas_07_botones_en_ingles"

  Scenario: Las traducciones al español se muestran correctamente
    Given el usuario abre la pagina con traducciones simuladas
    Then el botón de continuar muestra el texto en español

  Scenario: Las traducciones al francés se aplican en los campos del formulario
    Given el usuario abre la pagina con traducciones simuladas
    When el usuario selecciona el idioma "FR"
    Then el formulario muestra etiquetas en francés
    Then se toma un screenshot "idiomas_08_formulario_en_frances"

  Scenario: Las traducciones al catalán se aplican en los botones de respuesta
    Given el usuario abre la pagina con traducciones simuladas
    When el usuario selecciona el idioma "CA"
    Then los botones de respuesta muestran el texto en catalán
    Then se toma un screenshot "idiomas_09_respuestas_en_catalan"

  # ── Fallback de traducción ───────────────────────────────────────────────

  Scenario: Si no hay traducciones cargadas se muestra la clave como fallback
    Given el usuario abre la pagina con traducciones vacías
    Then los elementos de interfaz son visibles aunque no haya traducciones cargadas

  # ── API de idiomas ───────────────────────────────────────────────────────

  Scenario: La API de idiomas devuelve un array con los idiomas disponibles
    Given el usuario abre la pagina principal
    When se llama al endpoint de idiomas
    Then la respuesta de idiomas tiene el formato correcto

  Scenario: La API de traducciones devuelve las traducciones agrupadas por idioma
    Given el usuario abre la pagina principal
    When se llama al endpoint de traducciones
    Then la respuesta de traducciones tiene el formato correcto

  # ── Admin: gestión de idiomas ───────────────────────────────────────────

  Scenario: El panel de administración tiene la pestaña de idiomas
    Given el administrador accede al panel de administracion
    Then la pestaña de idiomas está visible en el panel de administración

  Scenario: El administrador puede navegar a la pestaña de idiomas
    Given el administrador accede al panel de administracion
    When el administrador navega a la pestaña de idiomas
    Then la tabla de idiomas es visible
    Then se toma un screenshot "idiomas_10_admin_tab_idiomas"

  Scenario: La tabla de idiomas en el admin muestra las columnas correctas
    Given el administrador accede al panel de administracion
    When el administrador navega a la pestaña de idiomas
    Then la tabla de idiomas muestra columnas de código y etiqueta

  Scenario: El administrador puede crear un nuevo idioma
    Given el administrador accede al panel de administracion
    When el administrador navega a la pestaña de idiomas
    And el administrador crea un nuevo idioma con código "de" y etiqueta "Deutsch"
    Then la tabla de idiomas muestra el idioma recién creado
    Then se toma un screenshot "idiomas_11_nuevo_idioma_creado"
