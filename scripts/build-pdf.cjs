// Build a PDF that documents the Renta Form application end-to-end,
// embedding the screenshots captured in /tmp/screenshots.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = '/tmp/screenshots';
const OUT_PDF = '/tmp/renta-form-overview.pdf';

function img(name) {
  const file = path.join(SHOTS, name);
  const b64 = fs.readFileSync(file).toString('base64');
  return `data:image/png;base64,${b64}`;
}

const sections = [
  {
    title: '1. Introducción',
    body: `
      <p><strong>Renta Form</strong> es una aplicación web para la gestión de declaraciones de la Renta (IRPF). Está dividida en dos áreas principales:</p>
      <ul>
        <li><strong>Formulario público</strong> – un asistente paso a paso (tipo "quiz") en el que el ciudadano introduce sus datos identificativos y responde a un conjunto de preguntas Sí / No sobre su situación fiscal.</li>
        <li><strong>Panel de administración</strong> – un back-office protegido por usuario y contraseña para gestionar las declaraciones recibidas, los usuarios, el catálogo de preguntas y la internacionalización (idiomas y traducciones).</li>
      </ul>
      <p>Tecnológicamente la aplicación se compone de tres capas:</p>
      <table>
        <thead><tr><th>Capa</th><th>Tecnología</th><th>Puerto local</th></tr></thead>
        <tbody>
          <tr><td>Frontend</td><td>React 19 + Vite</td><td>5173 (dev) / 3001 (build servida por backend)</td></tr>
          <tr><td>Backend</td><td>Node.js + Express</td><td>3001</td></tr>
          <tr><td>Base de datos</td><td>PostgreSQL 16</td><td>5432</td></tr>
        </tbody>
      </table>
      <p>La especificación de la API se publica en <code>/#/api-docs</code> mediante Swagger UI y todas las rutas REST cuelgan del prefijo <code>/v1</code>.</p>
    `,
  },
  {
    title: '2. Página de aterrizaje del formulario público',
    img: '01_public_landing.png',
    body: `
      <p>Al acceder a la raíz (<code>http://localhost:3001/</code>) el usuario aterriza en el primer paso del asistente. La cabecera contiene el logotipo de la aplicación y un selector de idioma con bandera (ES, CA, EN, FR). La barra superior muestra el progreso (paso 1 de 15) y una caja de instrucciones describe el propósito de la campaña.</p>
      <p>El primer paso pide los datos identificativos: <em>Nombre, Apellidos, DNI / NIE, Email (opcional) y Teléfono</em>. Hasta que se rellenen los campos obligatorios, el botón <strong>Continuar</strong> bloquea el avance.</p>
    `,
  },
  {
    title: '3. Datos de identificación rellenos',
    img: '02_public_id_filled.png',
    body: `
      <p>Los campos validan formato (DNI/NIE de 9 caracteres, email opcional con formato válido). El campo <strong>DNI/NIE</strong> es la clave única de la declaración: si ya existe una declaración con ese DNI, el backend devolverá un error de duplicado.</p>
    `,
  },
  {
    title: '4. Asistente de preguntas Sí / No (paso 1 de las preguntas)',
    img: '03_public_question_1.png',
    body: `
      <p>A partir del paso 2 cada pantalla muestra <strong>una única pregunta</strong> en formato tipo quiz. Las preguntas se cargan desde la base de datos (tabla <code>preguntas</code>) y cubren cuatro bloques: situación de la vivienda, cargas familiares y ayudas, hijos a cargo e ingresos extraordinarios e inversiones.</p>
      <p>El catálogo actual contiene <strong>14 preguntas</strong>, todas con dos respuestas posibles: <strong>Sí</strong> o <strong>No</strong>. Al elegir una respuesta se muestra un anillo de feedback animado y el asistente avanza automáticamente al siguiente paso.</p>
    `,
  },
  {
    title: '5. Avance entre preguntas',
    img: '04_public_question_2.png',
    body: `
      <p>La barra superior y el contador <em>"X / 15"</em> reflejan en tiempo real el progreso. El botón <strong>Volver</strong> permite revisar respuestas anteriores y los datos se conservan en memoria mientras el usuario navega.</p>
    `,
  },
  {
    title: '6. Cambio de idioma en caliente',
    img: '05_public_language_en.png',
    body: `
      <p>Pulsando una de las banderas de la cabecera, todos los textos del asistente se traducen al instante (ES, CA, EN, FR). Los idiomas disponibles y sus traducciones se obtienen de la base de datos a través de los endpoints públicos <code>GET /v1/irpf/idiomas</code> y <code>GET /v1/irpf/traducciones</code>, por lo que el administrador puede dar de alta nuevos idiomas y editar textos sin necesidad de volver a desplegar la aplicación.</p>
    `,
  },
  {
    title: '7. Confirmación de envío',
    img: '06_public_success.png',
    body: `
      <p>Al responder a la última pregunta y pulsar <strong>Enviar declaración</strong>, el backend almacena un nuevo registro en la tabla <code>declaraciones</code> con estado inicial <em>recibido</em>. El usuario ve una pantalla de éxito con animación de confeti y la opción <strong>Nueva declaración</strong> para empezar otra.</p>
    `,
  },
  {
    title: '8. Documentación interactiva de la API (Swagger UI)',
    img: '07_api_docs.png',
    body: `
      <p>En <code>/#/api-docs</code> se sirve Swagger UI con la especificación OpenAPI completa. Desde aquí se pueden inspeccionar y probar todos los endpoints: autenticación (<code>/auth/login</code>, <code>/auth/admin-login</code>), preguntas (<code>/irpf/preguntas</code>), declaraciones (<code>/irpf/declaraciones</code>), idiomas y traducciones (<code>/irpf/idiomas</code>, <code>/irpf/traducciones</code>) y la zona de administración (<code>/admin/...</code>).</p>
    `,
  },
  {
    title: '9. Acceso al panel de administración',
    img: '08_admin_login.png',
    body: `
      <p>El back-office se encuentra en <code>http://localhost:3001/#/backend_admin</code>. Si el navegador no tiene una sesión activa de administrador, se muestra una pantalla de login. Las credenciales por defecto del seed son:</p>
      <table>
        <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
        <tbody>
          <tr><td>Usuario (DNI)</td><td><code>admin</code></td></tr>
          <tr><td>Contraseña</td><td><code>admin</code></td></tr>
        </tbody>
      </table>
      <p>Estas credenciales se siembran con el script <code>npm run db:seed-admin</code> y pueden personalizarse con las variables <code>ADMIN_DNI</code>, <code>ADMIN_EMAIL</code> y <code>ADMIN_PASSWORD</code>.</p>
    `,
  },
  {
    title: '10. Login con credenciales',
    img: '09_admin_login_filled.png',
    body: `
      <p>El formulario envía las credenciales a <code>POST /v1/auth/admin-login</code>. El backend valida la contraseña con <strong>bcrypt</strong> contra la tabla <code>usuarios</code>, comprueba que el usuario tenga rol <em>admin</em> y devuelve los datos de sesión que el frontend guarda en su <code>AuthContext</code>.</p>
    `,
  },
  {
    title: '11. Pestaña "Declaraciones"',
    img: '10_admin_declaraciones.png',
    body: `
      <p>Es la vista por defecto al entrar al panel. Lista todas las declaraciones IRPF almacenadas en la base de datos con paginación, filtro por estado y búsqueda por DNI/NIE. Sobre cada declaración el administrador puede:</p>
      <ul>
        <li>Cambiar el <strong>estado</strong>: <em>recibido → en revisión → documentación pendiente → completado → archivado</em>.</li>
        <li><strong>Editar</strong> los datos identificativos y las respuestas a las preguntas.</li>
        <li><strong>Eliminar</strong> la declaración.</li>
        <li><strong>Asignar</strong> una cuenta de usuario al ciudadano (búsqueda por DNI).</li>
        <li><strong>Subir un PDF</strong> de la renta firmada y <strong>descargar</strong> un PDF generado dinámicamente.</li>
      </ul>
    `,
  },
  {
    title: '12. Pestaña "Preguntas"',
    img: '11_admin_preguntas.png',
    body: `
      <p>CRUD del catálogo de preguntas mostradas en el formulario público. Cada pregunta tiene:</p>
      <ul>
        <li>Un <strong>campo</strong> técnico (clave estable, p. ej. <code>viviendaAlquiler</code>) que se corresponde con una columna de la tabla <code>declaraciones</code>.</li>
        <li>Un <strong>texto multiidioma</strong> almacenado como JSONB (<code>{ es: "...", en: "...", ca: "...", fr: "..." }</code>) con fallback al castellano.</li>
        <li>Una <strong>sección</strong> y un <strong>orden</strong> que controlan cómo se agrupan en el asistente.</li>
      </ul>
      <p>Solo las preguntas cuyo <code>campo</code> coincide con una columna real de la tabla <code>declaraciones</code> se muestran al ciudadano (filtro <code>QUESTION_CAMPOS</code> en el frontend).</p>
    `,
  },
  {
    title: '13. Pestaña "Usuarios"',
    img: '12_admin_usuarios.png',
    body: `
      <p>Gestión del padrón de cuentas. Permite ver los 100 usuarios sembrados por defecto, bloquear / desbloquear cuentas, marcar denuncias y asignar las preguntas que cada usuario debe responder. La contraseña se almacena <em>hashed</em> con bcrypt y nunca se muestra en claro.</p>
    `,
  },
  {
    title: '14. Pestaña "Idiomas"',
    img: '13_admin_idiomas.png',
    body: `
      <p>Permite dar de alta y dar de baja idiomas (tabla <code>idiomas</code>: <em>code, label, activo</em>). Solo los marcados como activos aparecen en el selector de bandera del frontend público. Desde esta pestaña el administrador también puede subir o descargar el contenido completo de un idioma vía los endpoints <code>/v1/admin/idiomas/{id}/content</code>.</p>
    `,
  },
  {
    title: '15. Pestaña "Traducciones"',
    img: '14_admin_traducciones.png',
    body: `
      <p>Editor en tabla de la lista completa de claves de traducción (alrededor de 100 claves) y sus valores en cada idioma (tabla <code>traducciones</code>: <em>idioma_id, clave, valor</em>). Cualquier cambio se refleja inmediatamente en el formulario público al recargar las traducciones.</p>
    `,
  },
  {
    title: '16. Modelo de datos',
    body: `
      <p>El esquema (definido en <code>database/init.sql</code>) consta de cinco tablas:</p>
      <ol>
        <li><strong>usuarios</strong> – cuentas de ciudadanos y administradores; almacena DNI/NIE único, email, contraseña hasheada, rol y banderas de bloqueo / denuncia.</li>
        <li><strong>preguntas</strong> – catálogo de preguntas con campo único, texto JSONB multiidioma, sección y orden.</li>
        <li><strong>declaraciones</strong> – una fila por declaración; columnas con datos identificativos y una columna por respuesta. <code>dni_nie</code> es <em>UNIQUE</em>.</li>
        <li><strong>idiomas</strong> – idiomas activos del sistema.</li>
        <li><strong>traducciones</strong> – pares clave/valor por idioma.</li>
      </ol>
    `,
  },
  {
    title: '17. Puesta en marcha (resumen)',
    body: `
      <p>Pasos para arrancar la aplicación en local:</p>
      <pre><code>docker-compose up -d                # PostgreSQL en :5432
npm install
cd backend && npm install && cd ..
cp backend/.env.example backend/.env
npm run db:setup-all                # migra esquema + siembra datos
npm run start:backend               # backend en :3001
npm run dev                         # frontend en :5173</code></pre>
      <p>Tests E2E con Cucumber + Playwright: <code>npm run test</code>. Linter: <code>npm run lint</code>.</p>
    `,
  },
  {
    title: '18. Estado verificado',
    body: `
      <p>Durante la captura de este documento se ha comprobado que <strong>todos los flujos descritos están operativos</strong> sobre el build de producción servido por el backend en el puerto 3001:</p>
      <ul>
        <li>✅ Carga de idiomas y traducciones desde la base de datos.</li>
        <li>✅ Asistente público completo: validación de identidad, navegación entre preguntas Sí/No, cambio de idioma en caliente y envío final con persistencia en <code>declaraciones</code>.</li>
        <li>✅ Pantalla de éxito con confeti tras enviar la declaración.</li>
        <li>✅ Documentación de la API (Swagger UI) accesible en <code>/#/api-docs</code>.</li>
        <li>✅ Login de administrador con <code>admin / admin</code> (hash bcrypt en BD).</li>
        <li>✅ Pestañas del panel admin: Declaraciones, Preguntas, Usuarios, Idiomas y Traducciones — todas se cargan y muestran datos sembrados (100 usuarios, 14 preguntas, 4 idiomas, ~100 claves de traducción × 4 idiomas).</li>
      </ul>
    `,
  },
];

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Renta Form – Documentación funcional</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c1c2b; line-height: 1.5; font-size: 11.5pt; }
  h1 { font-size: 28pt; color: #6c11c8; margin: 0 0 4pt; }
  h2 { font-size: 16pt; color: #6c11c8; margin: 18pt 0 6pt; border-bottom: 1px solid #e0d6f0; padding-bottom: 4pt; }
  p, ul, ol, table { margin: 6pt 0; }
  code { background: #f3eefb; color: #4a0c8c; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
  pre { background: #1e1b2e; color: #f0eaff; padding: 10pt; border-radius: 6pt; font-size: 9.5pt; overflow-x: auto; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5pt; }
  th, td { border: 1px solid #d8cce8; padding: 5pt 8pt; text-align: left; vertical-align: top; }
  th { background: #f3eefb; }
  ul, ol { padding-left: 22pt; }
  .cover { text-align: center; padding-top: 80pt; page-break-after: always; }
  .cover .sub { color: #555; font-size: 13pt; margin-top: 8pt; }
  .cover .meta { margin-top: 60pt; font-size: 10pt; color: #777; }
  .section { page-break-inside: avoid; }
  .shot { margin: 8pt 0 4pt; text-align: center; }
  .shot img { max-width: 100%; max-height: 165mm; border: 1px solid #d8cce8; border-radius: 6pt; box-shadow: 0 2px 4px rgba(0,0,0,.06); }
  .toc { font-size: 11pt; }
  .toc li { margin: 2pt 0; }
</style>
</head>
<body>

<section class="cover">
  <h1>Renta Form</h1>
  <div class="sub">Documentación funcional con capturas de pantalla<br>De principio a fin</div>
  <div class="meta">Generado el ${new Date().toLocaleDateString('es-ES', { year:'numeric', month:'long', day:'numeric' })}</div>
</section>

<section class="section">
  <h2>Índice</h2>
  <ol class="toc">
    ${sections.map(s => `<li>${s.title.replace(/^\d+\.\s*/, '')}</li>`).join('')}
  </ol>
</section>

${sections.map(s => `
<section class="section">
  <h2>${s.title}</h2>
  ${s.img ? `<div class="shot"><img src="${img(s.img)}" alt="${s.title}" /></div>` : ''}
  ${s.body || ''}
</section>
`).join('\n')}

</body>
</html>`;

(async () => {
  const tmpHtml = '/tmp/renta-form-overview.html';
  fs.writeFileSync(tmpHtml, html);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + tmpHtml, { waitUntil: 'load' });
  await page.pdf({
    path: OUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  });
  await browser.close();
  console.log('PDF written to', OUT_PDF, '(', fs.statSync(OUT_PDF).size, 'bytes )');
})().catch(err => { console.error(err); process.exit(1); });
