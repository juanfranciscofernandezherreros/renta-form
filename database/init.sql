-- =============================================================
--  Renta Form – Esquema completo (ES, FR, CA, EN)
-- =============================================================

BEGIN;

-- 1. Extensiones y Tipos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'respuesta_yn') THEN
        CREATE TYPE respuesta_yn AS ENUM ('si', 'no');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_expediente') THEN
        CREATE TYPE estado_expediente AS ENUM ('recibido', 'en_revision', 'documentacion_pendiente', 'completado', 'archivado');
    END IF;
END $$;

-- 2. Funciones de Auditoría
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_set_actualizada_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizada_en = NOW();
    RETURN NEW;
END;
$$;

-- 3. Tabla: Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_nie              VARCHAR(9)   NOT NULL UNIQUE,
    nombre               VARCHAR(100) NOT NULL,
    apellidos            VARCHAR(200) NOT NULL DEFAULT '',
    email                VARCHAR(254) NOT NULL,
    telefono             VARCHAR(20)  NOT NULL DEFAULT '',
    role                 VARCHAR(20)  NOT NULL DEFAULT 'user',
    password_hash        TEXT         NOT NULL,
    bloqueado            BOOLEAN      NOT NULL DEFAULT false,
    denunciado           BOOLEAN      NOT NULL DEFAULT false,
    preguntas_asignadas  JSONB        NOT NULL DEFAULT '[]',
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Tabla: Preguntas (Traducciones en JSONB)
CREATE TABLE IF NOT EXISTS preguntas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campo          VARCHAR(100) NOT NULL UNIQUE,
    texto          JSONB        NOT NULL DEFAULT '{}', -- Estructura: {"es": "", "fr": "", "ca": "", "en": ""}
    orden          INTEGER      NOT NULL DEFAULT 0,
    actualizada_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 5. Tabla: Declaraciones
CREATE TABLE IF NOT EXISTS declaraciones (
    id                        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en                 TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    estado                    estado_expediente NOT NULL DEFAULT 'recibido',
    nombre                    VARCHAR(100)      NOT NULL,
    apellidos                 VARCHAR(200)      NOT NULL,
    dni_nie                   VARCHAR(9)        NOT NULL,
    email                     VARCHAR(254)      NOT NULL,
    telefono                  VARCHAR(20)       NOT NULL,

    -- Respuestas (mapeadas con preguntas.campo)
    vivienda_alquiler         respuesta_yn      NOT NULL,
    alquiler_menos_35         respuesta_yn,
    vivienda_propiedad        respuesta_yn      NOT NULL,
    propiedad_antes_2013      respuesta_yn,
    pisos_alquilados_terceros respuesta_yn      NOT NULL,
    segunda_residencia        respuesta_yn      NOT NULL,
    familia_numerosa          respuesta_yn      NOT NULL,
    ayudas_gobierno           respuesta_yn      NOT NULL,
    mayores_65_a_cargo        respuesta_yn      NOT NULL,
    mayores_conviven          respuesta_yn,
    hijos_menores_26          respuesta_yn      NOT NULL,
    ingresos_juego            respuesta_yn      NOT NULL,
    ingresos_inversiones      respuesta_yn      NOT NULL,

    CONSTRAINT chk_dni_nie_formato       CHECK (dni_nie ~ '^[0-9XYZ][0-9]{7}[A-Z]$'),
    CONSTRAINT uq_declaraciones_dni_nie  UNIQUE (dni_nie)
);

-- 6. Tabla: Idiomas
CREATE TABLE IF NOT EXISTS idiomas (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(10)  NOT NULL UNIQUE,
    label          VARCHAR(100) NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 7. Tabla: Traducciones
CREATE TABLE IF NOT EXISTS traducciones (
    id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    idioma_id UUID         NOT NULL REFERENCES idiomas(id) ON DELETE CASCADE,
    clave     VARCHAR(200) NOT NULL,
    valor     TEXT         NOT NULL DEFAULT '',
    UNIQUE (idioma_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_traducciones_idioma ON traducciones (idioma_id);

-- 8. Triggers
CREATE OR REPLACE TRIGGER trg_declaraciones_actualizado_en
    BEFORE UPDATE ON declaraciones FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

CREATE OR REPLACE TRIGGER trg_idiomas_actualizado_en
    BEFORE UPDATE ON idiomas FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

CREATE OR REPLACE TRIGGER trg_preguntas_actualizada_en
    BEFORE UPDATE ON preguntas FOR EACH ROW EXECUTE FUNCTION fn_set_actualizada_en();

-- 9. Datos de inicio
INSERT INTO usuarios (dni_nie, nombre, email, role, password_hash)
VALUES ('ADMIN', 'Admin', 'admin@renta-form.local', 'admin', '$2b$12$a3QpSIVIiYpVQuwcWtYIbO.5/VbAKdDNClFrl0WTe4GVN7sjA0ruW')
ON CONFLICT (dni_nie) DO NOTHING;

INSERT INTO idiomas (code, label, activo) VALUES
    ('es', 'Español',  TRUE),
    ('fr', 'Français', TRUE),
    ('en', 'English',  TRUE),
    ('ca', 'Català',   TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO preguntas (campo, texto, orden) VALUES
    ('viviendaAlquiler',
     '{"es": "¿Vive de alquiler?", "fr": "Vivez-vous en location ?", "ca": "Viu de lloguer?", "en": "Do you live in a rental?"}',
     1),
    ('alquilerMenos35',
     '{"es": "¿El importe del alquiler es inferior al 35 % de los ingresos?", "fr": "Le montant du loyer est-il inférieur à 35 % des revenus ?", "ca": "L''import del lloguer és inferior al 35 % dels ingressos?", "en": "Is the rent amount less than 35% of your income?"}',
     2),
    ('viviendaPropiedad',
     '{"es": "¿Es propietario de su vivienda habitual?", "fr": "Êtes-vous propriétaire de votre résidence principale ?", "ca": "És propietari del seu habitatge habitual?", "en": "Do you own your primary residence?"}',
     3),
    ('propiedadAntes2013',
     '{"es": "¿Adquirió la vivienda antes de 2013?", "fr": "Avez-vous acquis le logement avant 2013 ?", "ca": "Va adquirir l''habitatge abans de 2013?", "en": "Did you purchase the property before 2013?"}',
     4),
    ('pisosAlquiladosTerceros',
     '{"es": "¿Tiene pisos alquilados a terceros?", "fr": "Avez-vous des appartements loués à des tiers ?", "ca": "Té pisos llogats a tercers?", "en": "Do you have properties rented to third parties?"}',
     5),
    ('segundaResidencia',
     '{"es": "¿Posee una segunda residencia?", "fr": "Possédez-vous une résidence secondaire ?", "ca": "Posseeix una segona residència?", "en": "Do you own a second residence?"}',
     6),
    ('familiaNumerosa',
     '{"es": "¿Es familia numerosa?", "fr": "Êtes-vous une famille nombreuse ?", "ca": "És família nombrosa?", "en": "Are you a large family?"}',
     7),
    ('ayudasGobierno',
     '{"es": "¿Ha recibido ayudas del Gobierno?", "fr": "Avez-vous reçu des aides du gouvernement ?", "ca": "Ha rebut ajudes del Govern?", "en": "Have you received government grants?"}',
     8),
    ('mayores65ACargo',
     '{"es": "¿Tiene mayores de 65 años a su cargo?", "fr": "Avez-vous des personnes de plus de 65 ans à votre charge ?", "ca": "Té majors de 65 anys al seu càrrec?", "en": "Do you have dependants over 65?"}',
     9),
    ('mayoresConviven',
     '{"es": "¿Conviven con usted?", "fr": "Vivent-ils avec vous ?", "ca": "Conviuen amb vostè?", "en": "Do they live with you?"}',
     10),
    ('hijosMenores26',
     '{"es": "¿Tiene hijos menores de 26 años?", "fr": "Avez-vous des enfants de moins de 26 ans ?", "ca": "Té fills menors de 26 anys?", "en": "Do you have children under 26?"}',
     11),
    ('ingresosJuego',
     '{"es": "¿Ha tenido ganancias procedentes del juego?", "fr": "Avez-vous eu des gains provenant de jeux ?", "ca": "Ha tingut guanys procedents del joc?", "en": "Have you had gambling winnings?"}',
     12),
    ('ingresosInversiones',
     '{"es": "¿Ha obtenido rendimientos de capital mobiliario o inversiones?", "fr": "Avez-vous obtenu des revenus de capitaux mobiliers ou investissements ?", "ca": "Ha obtingut rendiments de capital mobiliari o inversions?", "en": "Have you earned income from investments or securities?"}',
     13)
ON CONFLICT (campo) DO NOTHING;

-- Seed traducciones
INSERT INTO traducciones (idioma_id, clave, valor)
SELECT i.id, k.clave, k.valor
FROM idiomas i
CROSS JOIN (VALUES
  ('navLogout', '🚪 Cerrar sesión'),
  ('navLogin', '🔑 Acceder'),
  ('navNewForm', '📋 Nuevo cuestionario'),
  ('instructionsTitle', '📋 Instrucciones'),
  ('instructionsText', 'Rellene el siguiente cuestionario con la mayor precisión posible. La información proporcionada nos permitirá preparar su expediente fiscal para la '),
  ('instructionsText2', '. Todos los datos se tratarán con total confidencialidad conforme a la normativa de protección de datos.'),
  ('campaignName', 'Campaña de la Renta 2025'),
  ('section1', '1. Datos de Identificación'),
  ('fieldNombre', 'Nombre'),
  ('fieldApellidos', 'Apellidos'),
  ('fieldApellidosPlaceholder', 'Primer apellido Segundo apellido'),
  ('fieldDniNie', 'Número de DNI / NIE'),
  ('fieldEmail', 'Correo electrónico de contacto'),
  ('fieldEmailPlaceholder', 'ejemplo@correo.es'),
  ('fieldTelefono', 'Teléfono móvil'),
  ('fieldTelefonoPlaceholder', '600 000 000'),
  ('btnClear', '🗑 Limpiar'),
  ('btnSubmit', '📤 Enviar cuestionario'),
  ('btnSubmitting', '⏳ Enviando…'),
  ('confirmClear', '¿Seguro que quiere limpiar todos los campos?'),
  ('toastErrorHttp', '❌ Error al enviar el cuestionario (HTTP'),
  ('toastErrorHttpSuffix', '). Inténtelo de nuevo.'),
  ('toastErrorNetwork', '❌ No se pudo conectar con el servidor. Compruebe su conexión e inténtelo de nuevo.'),
  ('successTitle', '¡Cuestionario enviado correctamente!'),
  ('successText', 'Hemos recibido tu información. Nuestro equipo revisará tu expediente fiscal y se pondrá en contacto contigo en breve.'),
  ('btnSendAnother', 'Enviar otro cuestionario'),
  ('loadingQuestions', '⏳ Cargando preguntas…'),
  ('errorQuestions', '❌ No se pudieron cargar las preguntas: '),
  ('footerDisclaimer', 'Este formulario es meramente informativo y no constituye una presentación oficial ante la NH Gestión Integral.'),
  ('loginInfoTitle', '🔒 Acceso a tu expediente'),
  ('loginInfoText', 'Introduce tu DNI/NIE y contraseña para consultar y modificar tu cuestionario fiscal.'),
  ('loginTestUsers', 'Usuarios de prueba disponibles:'),
  ('loginTestPassword', 'Contraseña para todos: '),
  ('loginSectionId', 'Identificación'),
  ('fieldPassword', 'Contraseña'),
  ('fieldPasswordPlaceholder', 'renta2025'),
  ('btnLogin', '🔑 Acceder'),
  ('btnLoggingIn', '⏳ Verificando…'),
  ('errDniFormat', 'Formato inválido. Ejemplo: 12345678A'),
  ('errPasswordRequired', 'Introduce tu contraseña'),
  ('errUserBlocked', 'Tu cuenta está bloqueada. Contacta con el administrador.'),
  ('profileDeclaraciones', 'Mis declaraciones'),
  ('profileLoading', '⏳ Cargando tus declaraciones…'),
  ('profileLoadError', '❌ No se pudieron cargar tus declaraciones: '),
  ('profileEmpty', '📭 Sin declaraciones'),
  ('profileEmptyText', 'Aún no has enviado ningún cuestionario. '),
  ('profileEmptyLink', 'Haz clic aquí para empezar.'),
  ('profileSent', 'Enviado: '),
  ('profileUpdated', 'Actualizado: '),
  ('profileEdit', '✏️ Modificar cuestionario'),
  ('profileEditLocked', '🔒 Este cuestionario está completado y no puede modificarse.'),
  ('changePasswordTitle', '🔑 Cambiar contraseña'),
  ('fieldOldPassword', 'Contraseña actual'),
  ('fieldNewPassword', 'Nueva contraseña'),
  ('fieldConfirmPassword', 'Confirmar nueva contraseña'),
  ('btnUpdatePassword', '💾 Actualizar contraseña'),
  ('btnUpdatingPassword', '⏳ Guardando…'),
  ('pwSuccess', '✅ Contraseña actualizada correctamente.'),
  ('errOldPasswordRequired', 'Introduce la contraseña actual'),
  ('errNewPasswordLength', 'La nueva contraseña debe tener al menos'),
  ('errNewPasswordLengthSuffix', 'caracteres'),
  ('errPasswordsNoMatch', 'Las contraseñas no coinciden'),
  ('langLabel', 'Idioma'),
  ('yes', 'Sí'),
  ('no', 'No'),
  ('tokenConsultaTitle', 'Consultar estado de cuestionario'),
  ('tokenConsultaDesc', 'Introduce el código de seguimiento que recibiste al enviar el formulario para consultar el estado de tu expediente.'),
  ('tokenLabel', 'Código de seguimiento'),
  ('tokenPlaceholder', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
  ('btnConsultar', '🔍 Consultar'),
  ('btnConsultando', '⏳ Consultando…'),
  ('errTokenRequired', 'Introduce el código de seguimiento'),
  ('tokenResultTitle', 'Estado de tu cuestionario'),
  ('tokenNotFound', '❌ No se ha encontrado ningún cuestionario con ese código.'),
  ('tokenMyTokens', '📋 Mis cuestionarios enviados'),
  ('tokenNoHistory', 'No hay cuestionarios guardados en este dispositivo.'),
  ('tokenClearHistory', '🗑 Limpiar historial'),
  ('tokenResultNombre', 'Nombre'),
  ('tokenResultDni', 'DNI/NIE'),
  ('tokenResultEmail', 'Correo electrónico'),
  ('btnDownloadPDF', '📄 Descargar PDF'),
  ('fieldEmailOptional', '(opcional)'),
  ('errValidationRequired', '❌ Por favor, rellena los campos obligatorios: Nombre, Apellidos, DNI/NIE y Teléfono móvil.'),
  ('errValidationQuestions', '❌ Por favor, responde a todas las preguntas antes de enviar el formulario.'),
  ('btnContinue', 'Continuar'),
  ('btnBack', 'Volver'),
  ('btnDismissError', '×'),
  ('step1Subtitle', 'Rellene sus datos de identificación para continuar'),
  ('toastSuccess', '✅ Cuestionario enviado correctamente'),
  ('logoText', 'NH Gestión Integral'),
  ('footerBrandName', 'NH Gestión Integral'),
  ('estadoRecibido', 'Recibido'),
  ('estadoEnRevision', 'En revisión'),
  ('estadoDocumentacionPendiente', 'Documentación pendiente'),
  ('estadoCompletado', 'Completado'),
  ('estadoArchivado', 'Archivado'),
  ('labelTelefono', 'Teléfono'),
  ('rentaPdfBtn', '📥 Descargar PDF de la renta'),
  ('rentaPdfBtnTitle', 'Descargar el PDF de la renta preparado por el gestor'),
  ('btnAdmin', '🛡️ Admin')
) AS k(clave, valor)
WHERE i.code = 'es'
ON CONFLICT (idioma_id, clave) DO NOTHING;

INSERT INTO traducciones (idioma_id, clave, valor)
SELECT i.id, k.clave, k.valor
FROM idiomas i
CROSS JOIN (VALUES
  ('navLogout', '🚪 Se déconnecter'),
  ('navLogin', '🔑 Se connecter'),
  ('navNewForm', '📋 Nouveau questionnaire'),
  ('instructionsTitle', '📋 Instructions'),
  ('instructionsText', 'Veuillez remplir ce questionnaire aussi précisément que possible. Les informations fournies nous permettront de préparer votre dossier fiscal pour la '),
  ('instructionsText2', '. Toutes les données seront traitées en toute confidentialité conformément à la réglementation sur la protection des données.'),
  ('campaignName', 'Campagne Impôt sur le Revenu 2025'),
  ('section1', '1. Données d''Identification'),
  ('fieldNombre', 'Prénom'),
  ('fieldApellidos', 'Nom(s)'),
  ('fieldApellidosPlaceholder', 'Premier nom Deuxième nom'),
  ('fieldDniNie', 'Numéro de DNI / NIE'),
  ('fieldEmail', 'Adresse e-mail de contact'),
  ('fieldEmailPlaceholder', 'exemple@mail.fr'),
  ('fieldTelefono', 'Téléphone mobile'),
  ('fieldTelefonoPlaceholder', '600 000 000'),
  ('btnClear', '🗑 Effacer'),
  ('btnSubmit', '📤 Envoyer le questionnaire'),
  ('btnSubmitting', '⏳ Envoi en cours…'),
  ('confirmClear', 'Êtes-vous sûr de vouloir effacer tous les champs ?'),
  ('toastErrorHttp', '❌ Erreur lors de l''envoi (HTTP'),
  ('toastErrorHttpSuffix', '). Veuillez réessayer.'),
  ('toastErrorNetwork', '❌ Impossible de se connecter au serveur. Vérifiez votre connexion et réessayez.'),
  ('successTitle', 'Questionnaire envoyé avec succès !'),
  ('successText', 'Nous avons reçu vos informations. Notre équipe examinera votre dossier fiscal et vous contactera prochainement.'),
  ('btnSendAnother', 'Envoyer un autre questionnaire'),
  ('loadingQuestions', '⏳ Chargement des questions…'),
  ('errorQuestions', '❌ Impossible de charger les questions : '),
  ('footerDisclaimer', 'Ce formulaire est purement informatif et ne constitue pas une déclaration officielle auprès de NH Gestión Integral.'),
  ('loginInfoTitle', '🔒 Accès à votre dossier'),
  ('loginInfoText', 'Saisissez votre DNI/NIE et votre mot de passe pour consulter et modifier votre questionnaire fiscal.'),
  ('loginTestUsers', 'Utilisateurs de test disponibles :'),
  ('loginTestPassword', 'Mot de passe pour tous : '),
  ('loginSectionId', 'Identification'),
  ('fieldPassword', 'Mot de passe'),
  ('fieldPasswordPlaceholder', 'renta2025'),
  ('btnLogin', '🔑 Se connecter'),
  ('btnLoggingIn', '⏳ Vérification…'),
  ('errDniFormat', 'Format invalide. Exemple : 12345678A'),
  ('errPasswordRequired', 'Saisissez votre mot de passe'),
  ('errUserBlocked', 'Votre compte est bloqué. Contactez l''administrateur.'),
  ('profileDeclaraciones', 'Mes déclarations'),
  ('profileLoading', '⏳ Chargement de vos déclarations…'),
  ('profileLoadError', '❌ Impossible de charger vos déclarations : '),
  ('profileEmpty', '📭 Aucune déclaration'),
  ('profileEmptyText', 'Vous n''avez encore envoyé aucun questionnaire. '),
  ('profileEmptyLink', 'Cliquez ici pour commencer.'),
  ('profileSent', 'Envoyé : '),
  ('profileUpdated', 'Mis à jour : '),
  ('profileEdit', '✏️ Modifier le questionnaire'),
  ('profileEditLocked', 'Ce questionnaire est terminé et ne peut plus être modifié.'),
  ('changePasswordTitle', '🔑 Changer le mot de passe'),
  ('fieldOldPassword', 'Mot de passe actuel'),
  ('fieldNewPassword', 'Nouveau mot de passe'),
  ('fieldConfirmPassword', 'Confirmer le nouveau mot de passe'),
  ('btnUpdatePassword', '💾 Mettre à jour le mot de passe'),
  ('btnUpdatingPassword', '⏳ Enregistrement…'),
  ('pwSuccess', '✅ Mot de passe mis à jour avec succès.'),
  ('errOldPasswordRequired', 'Saisissez le mot de passe actuel'),
  ('errNewPasswordLength', 'Le nouveau mot de passe doit comporter au moins'),
  ('errNewPasswordLengthSuffix', 'caractères'),
  ('errPasswordsNoMatch', 'Les mots de passe ne correspondent pas'),
  ('langLabel', 'Langue'),
  ('yes', 'Oui'),
  ('no', 'Non'),
  ('tokenConsultaTitle', 'Consulter l''état du questionnaire'),
  ('tokenConsultaDesc', 'Saisissez le code de suivi reçu lors de l''envoi du formulaire pour vérifier l''état de votre dossier.'),
  ('tokenLabel', 'Code de suivi'),
  ('tokenPlaceholder', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
  ('btnConsultar', '🔍 Consulter'),
  ('btnConsultando', '⏳ Consultation…'),
  ('errTokenRequired', 'Saisissez le code de suivi'),
  ('tokenResultTitle', 'État de votre questionnaire'),
  ('tokenNotFound', '❌ Aucun questionnaire trouvé avec ce code.'),
  ('tokenMyTokens', '📋 Mes questionnaires envoyés'),
  ('tokenNoHistory', 'Aucun questionnaire enregistré sur cet appareil.'),
  ('tokenClearHistory', '🗑 Effacer l''historique'),
  ('tokenResultNombre', 'Prénom et nom'),
  ('tokenResultDni', 'DNI/NIE'),
  ('tokenResultEmail', 'Adresse e-mail'),
  ('btnDownloadPDF', '📄 Télécharger le PDF'),
  ('fieldEmailOptional', '(optionnel)'),
  ('errValidationRequired', '❌ Veuillez remplir les champs obligatoires : Prénom, Nom, DNI/NIE et Téléphone mobile.'),
  ('errValidationQuestions', '❌ Veuillez répondre à toutes les questions avant d''envoyer le formulaire.'),
  ('btnContinue', 'Continuer'),
  ('btnBack', 'Retour'),
  ('btnDismissError', '×'),
  ('step1Subtitle', 'Remplissez vos données d''identification pour continuer'),
  ('toastSuccess', '✅ Questionnaire envoyé avec succès'),
  ('logoText', 'NH Gestión Integral'),
  ('footerBrandName', 'NH Gestión Integral'),
  ('estadoRecibido', 'Reçu'),
  ('estadoEnRevision', 'En cours de révision'),
  ('estadoDocumentacionPendiente', 'Documentation en attente'),
  ('estadoCompletado', 'Terminé'),
  ('estadoArchivado', 'Archivé'),
  ('labelTelefono', 'Téléphone'),
  ('rentaPdfBtn', '📥 Télécharger le PDF fiscal'),
  ('rentaPdfBtnTitle', 'Télécharger le PDF fiscal préparé par le gestionnaire'),
  ('btnAdmin', '🛡️ Admin')
) AS k(clave, valor)
WHERE i.code = 'fr'
ON CONFLICT (idioma_id, clave) DO NOTHING;

INSERT INTO traducciones (idioma_id, clave, valor)
SELECT i.id, k.clave, k.valor
FROM idiomas i
CROSS JOIN (VALUES
  ('navLogout', '🚪 Log out'),
  ('navLogin', '🔑 Log in'),
  ('navNewForm', '📋 New questionnaire'),
  ('instructionsTitle', '📋 Instructions'),
  ('instructionsText', 'Please fill in this questionnaire as accurately as possible. The information provided will allow us to prepare your tax file for the '),
  ('instructionsText2', '. All data will be treated in strict confidence in accordance with data protection regulations.'),
  ('campaignName', '2025 Income Tax Campaign'),
  ('section1', '1. Identification Data'),
  ('fieldNombre', 'First name'),
  ('fieldApellidos', 'Surname(s)'),
  ('fieldApellidosPlaceholder', 'First surname Second surname'),
  ('fieldDniNie', 'DNI / NIE number'),
  ('fieldEmail', 'Contact e-mail address'),
  ('fieldEmailPlaceholder', 'example@mail.com'),
  ('fieldTelefono', 'Mobile phone'),
  ('fieldTelefonoPlaceholder', '600 000 000'),
  ('btnClear', '🗑 Clear'),
  ('btnSubmit', '📤 Submit questionnaire'),
  ('btnSubmitting', '⏳ Sending…'),
  ('confirmClear', 'Are you sure you want to clear all fields?'),
  ('toastErrorHttp', '❌ Error submitting questionnaire (HTTP'),
  ('toastErrorHttpSuffix', '). Please try again.'),
  ('toastErrorNetwork', '❌ Could not connect to the server. Please check your connection and try again.'),
  ('successTitle', 'Questionnaire submitted successfully!'),
  ('successText', 'We have received your information. Our team will review your tax file and contact you shortly.'),
  ('btnSendAnother', 'Submit another questionnaire'),
  ('loadingQuestions', '⏳ Loading questions…'),
  ('errorQuestions', '❌ Could not load questions: '),
  ('footerDisclaimer', 'This form is for informational purposes only and does not constitute an official submission to NH Gestión Integral.'),
  ('loginInfoTitle', '🔒 Access your file'),
  ('loginInfoText', 'Enter your DNI/NIE and password to view and edit your tax questionnaire.'),
  ('loginTestUsers', 'Available test users:'),
  ('loginTestPassword', 'Password for all: '),
  ('loginSectionId', 'Identification'),
  ('fieldPassword', 'Password'),
  ('fieldPasswordPlaceholder', 'renta2025'),
  ('btnLogin', '🔑 Log in'),
  ('btnLoggingIn', '⏳ Verifying…'),
  ('errDniFormat', 'Invalid format. Example: 12345678A'),
  ('errPasswordRequired', 'Please enter your password'),
  ('errUserBlocked', 'Your account is blocked. Please contact the administrator.'),
  ('profileDeclaraciones', 'My declarations'),
  ('profileLoading', '⏳ Loading your declarations…'),
  ('profileLoadError', '❌ Could not load your declarations: '),
  ('profileEmpty', '📭 No declarations'),
  ('profileEmptyText', 'You have not submitted any questionnaire yet. '),
  ('profileEmptyLink', 'Click here to get started.'),
  ('profileSent', 'Sent: '),
  ('profileUpdated', 'Updated: '),
  ('profileEdit', '✏️ Edit questionnaire'),
  ('profileEditLocked', '🔒 This questionnaire is completed and cannot be modified.'),
  ('changePasswordTitle', '🔑 Change password'),
  ('fieldOldPassword', 'Current password'),
  ('fieldNewPassword', 'New password'),
  ('fieldConfirmPassword', 'Confirm new password'),
  ('btnUpdatePassword', '💾 Update password'),
  ('btnUpdatingPassword', '⏳ Saving…'),
  ('pwSuccess', '✅ Password updated successfully.'),
  ('errOldPasswordRequired', 'Please enter your current password'),
  ('errNewPasswordLength', 'New password must be at least'),
  ('errNewPasswordLengthSuffix', 'characters'),
  ('errPasswordsNoMatch', 'Passwords do not match'),
  ('langLabel', 'Language'),
  ('yes', 'Yes'),
  ('no', 'No'),
  ('tokenConsultaTitle', 'Check questionnaire status'),
  ('tokenConsultaDesc', 'Enter the tracking code you received when submitting the form to check the status of your file.'),
  ('tokenLabel', 'Tracking code'),
  ('tokenPlaceholder', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
  ('btnConsultar', '🔍 Check'),
  ('btnConsultando', '⏳ Checking…'),
  ('errTokenRequired', 'Please enter your tracking code'),
  ('tokenResultTitle', 'Your questionnaire status'),
  ('tokenNotFound', '❌ No questionnaire found with that code.'),
  ('tokenMyTokens', '📋 My submitted questionnaires'),
  ('tokenNoHistory', 'No questionnaires saved on this device.'),
  ('tokenClearHistory', '🗑 Clear history'),
  ('tokenResultNombre', 'Name'),
  ('tokenResultDni', 'DNI/NIE'),
  ('tokenResultEmail', 'Email'),
  ('btnDownloadPDF', '📄 Download PDF'),
  ('fieldEmailOptional', '(optional)'),
  ('errValidationRequired', '❌ Please fill in the required fields: First name, Surname(s), DNI/NIE and Mobile phone.'),
  ('errValidationQuestions', '❌ Please answer all questions before submitting the form.'),
  ('btnContinue', 'Continue'),
  ('btnBack', 'Back'),
  ('btnDismissError', '×'),
  ('step1Subtitle', 'Fill in your identification details to continue'),
  ('toastSuccess', '✅ Questionnaire submitted successfully'),
  ('logoText', 'NH Gestión Integral'),
  ('footerBrandName', 'NH Gestión Integral'),
  ('estadoRecibido', 'Received'),
  ('estadoEnRevision', 'Under review'),
  ('estadoDocumentacionPendiente', 'Pending documentation'),
  ('estadoCompletado', 'Completed'),
  ('estadoArchivado', 'Archived'),
  ('labelTelefono', 'Phone'),
  ('rentaPdfBtn', '📥 Download income tax PDF'),
  ('rentaPdfBtnTitle', 'Download the income tax PDF prepared by the manager'),
  ('btnAdmin', '🛡️ Admin')
) AS k(clave, valor)
WHERE i.code = 'en'
ON CONFLICT (idioma_id, clave) DO NOTHING;

INSERT INTO traducciones (idioma_id, clave, valor)
SELECT i.id, k.clave, k.valor
FROM idiomas i
CROSS JOIN (VALUES
  ('navLogout', '🚪 Tancar sessió'),
  ('navLogin', '🔑 Accedir'),
  ('navNewForm', '📋 Nou qüestionari'),
  ('instructionsTitle', '📋 Instruccions'),
  ('instructionsText', 'Ompliu el següent qüestionari amb la màxima precisió possible. La informació proporcionada ens permetrà preparar el vostre expedient fiscal per a la '),
  ('instructionsText2', '. Totes les dades seran tractades amb total confidencialitat d''acord amb la normativa de protecció de dades.'),
  ('campaignName', 'Campanya de la Renda 2025'),
  ('section1', '1. Dades d''Identificació'),
  ('fieldNombre', 'Nom'),
  ('fieldApellidos', 'Cognoms'),
  ('fieldApellidosPlaceholder', 'Primer cognom Segon cognom'),
  ('fieldDniNie', 'Número de DNI / NIE'),
  ('fieldEmail', 'Correu electrònic de contacte'),
  ('fieldEmailPlaceholder', 'exemple@correu.cat'),
  ('fieldTelefono', 'Telèfon mòbil'),
  ('fieldTelefonoPlaceholder', '600 000 000'),
  ('btnClear', '🗑 Netejar'),
  ('btnSubmit', '📤 Enviar qüestionari'),
  ('btnSubmitting', '⏳ Enviant…'),
  ('confirmClear', 'Esteu segur que voleu netejar tots els camps?'),
  ('toastErrorHttp', '❌ Error en enviar el qüestionari (HTTP'),
  ('toastErrorHttpSuffix', '). Torneu-ho a intentar.'),
  ('toastErrorNetwork', '❌ No s''ha pogut connectar amb el servidor. Comproveu la connexió i torneu-ho a intentar.'),
  ('successTitle', 'Qüestionari enviat correctament!'),
  ('successText', 'Hem rebut la vostra informació. El nostre equip revisarà el vostre expedient fiscal i es posarà en contacte amb vosaltres aviat.'),
  ('btnSendAnother', 'Enviar un altre qüestionari'),
  ('loadingQuestions', '⏳ Carregant preguntes…'),
  ('errorQuestions', '❌ No s''han pogut carregar les preguntes: '),
  ('footerDisclaimer', 'Aquest formulari és merament informatiu i no constitueix una presentació oficial davant de NH Gestión Integral.'),
  ('loginInfoTitle', '🔒 Accés al teu expedient'),
  ('loginInfoText', 'Introduïu el vostre DNI/NIE i contrasenya per consultar i modificar el vostre qüestionari fiscal.'),
  ('loginTestUsers', 'Usuaris de prova disponibles:'),
  ('loginTestPassword', 'Contrasenya per a tots: '),
  ('loginSectionId', 'Identificació'),
  ('fieldPassword', 'Contrasenya'),
  ('fieldPasswordPlaceholder', 'renta2025'),
  ('btnLogin', '🔑 Accedir'),
  ('btnLoggingIn', '⏳ Verificant…'),
  ('errDniFormat', 'Format no vàlid. Exemple: 12345678A'),
  ('errPasswordRequired', 'Introduïu la vostra contrasenya'),
  ('errUserBlocked', 'El vostre compte està bloquejat. Contacteu amb l''administrador.'),
  ('profileDeclaraciones', 'Les meves declaracions'),
  ('profileLoading', '⏳ Carregant les vostres declaracions…'),
  ('profileLoadError', '❌ No s''han pogut carregar les vostres declaracions: '),
  ('profileEmpty', '📭 Sense declaracions'),
  ('profileEmptyText', 'Encara no heu enviat cap qüestionari. '),
  ('profileEmptyLink', 'Feu clic aquí per començar.'),
  ('profileSent', 'Enviat: '),
  ('profileUpdated', 'Actualitzat: '),
  ('profileEdit', '✏️ Modificar qüestionari'),
  ('profileEditLocked', '🔒 Aquest qüestionari està completat i no es pot modificar.'),
  ('changePasswordTitle', '🔑 Canviar contrasenya'),
  ('fieldOldPassword', 'Contrasenya actual'),
  ('fieldNewPassword', 'Nova contrasenya'),
  ('fieldConfirmPassword', 'Confirmar nova contrasenya'),
  ('btnUpdatePassword', '💾 Actualitzar contrasenya'),
  ('btnUpdatingPassword', '⏳ Desant…'),
  ('pwSuccess', '✅ Contrasenya actualitzada correctament.'),
  ('errOldPasswordRequired', 'Introduïu la contrasenya actual'),
  ('errNewPasswordLength', 'La nova contrasenya ha de tenir almenys'),
  ('errNewPasswordLengthSuffix', 'caràcters'),
  ('errPasswordsNoMatch', 'Les contrasenyes no coincideixen'),
  ('langLabel', 'Idioma'),
  ('yes', 'Sí'),
  ('no', 'No'),
  ('tokenConsultaTitle', 'Consultar estat del qüestionari'),
  ('tokenConsultaDesc', 'Introduïu el codi de seguiment rebut en enviar el formulari per consultar l''estat del vostre expedient.'),
  ('tokenLabel', 'Codi de seguiment'),
  ('tokenPlaceholder', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
  ('btnConsultar', '🔍 Consultar'),
  ('btnConsultando', '⏳ Consultant…'),
  ('errTokenRequired', 'Introduïu el codi de seguiment'),
  ('tokenResultTitle', 'Estat del vostre qüestionari'),
  ('tokenNotFound', '❌ No s''ha trobat cap qüestionari amb aquest codi.'),
  ('tokenMyTokens', '📋 Els meus qüestionaris enviats'),
  ('tokenNoHistory', 'No hi ha qüestionaris desats en aquest dispositiu.'),
  ('tokenClearHistory', '🗑 Netejar historial'),
  ('tokenResultNombre', 'Nom'),
  ('tokenResultDni', 'DNI/NIE'),
  ('tokenResultEmail', 'Correu electrònic'),
  ('btnDownloadPDF', '📄 Descarregar PDF'),
  ('fieldEmailOptional', '(opcional)'),
  ('errValidationRequired', '❌ Si us plau, ompliu els camps obligatoris: Nom, Cognoms, DNI/NIE i Telèfon mòbil.'),
  ('errValidationQuestions', '❌ Si us plau, responeu a totes les preguntes abans d''enviar el formulari.'),
  ('btnContinue', 'Continuar'),
  ('btnBack', 'Tornar'),
  ('btnDismissError', '×'),
  ('step1Subtitle', 'Ompliu les vostres dades d''identificació per continuar'),
  ('toastSuccess', '✅ Qüestionari enviat correctament'),
  ('logoText', 'NH Gestión Integral'),
  ('footerBrandName', 'NH Gestión Integral'),
  ('estadoRecibido', 'Rebut'),
  ('estadoEnRevision', 'En revisió'),
  ('estadoDocumentacionPendiente', 'Documentació pendent'),
  ('estadoCompletado', 'Completat'),
  ('estadoArchivado', 'Arxivat'),
  ('labelTelefono', 'Telèfon'),
  ('rentaPdfBtn', '📥 Descarregar PDF de la renda'),
  ('rentaPdfBtnTitle', 'Descarregar el PDF de la renda preparat pel gestor'),
  ('btnAdmin', '🛡️ Admin')
) AS k(clave, valor)
WHERE i.code = 'ca'
ON CONFLICT (idioma_id, clave) DO NOTHING;

COMMIT;
