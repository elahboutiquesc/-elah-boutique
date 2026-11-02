# Migración ELAH a Cloudflare: preparada, pendiente de publicación

Se conserva Cloudinary bl7tzrfk, su preset elah_catalogo y Google Sheets como
inventario maestro. No se cargaron fotos ni se modificaron existencias.
La tienda y las funciones se alojan en un Worker con Static Assets; D1 reemplaza
Blob para JSON y estados OAuth. No hace falta crear además un proyecto Pages.

## Validación realizada

- Suite Node existente más pruebas nuevas con SQL real: almacenamiento,
  paginación de 1.001 registros, escrituras condicionales, aislamiento,
  protección de rutas y autorización de un solo uso.
- Wrangler dry-run: compilación y allowlist de archivos públicos.
- workerd + D1 local: metadatos, sesión administrativa segura, registro masivo,
  registro de cliente, PKCE, canje, rechazo de replay y tools/list autenticado.
- Ninguna prueba publica una imagen ni modifica servicios externos.

## Configurar la cuenta gratuita

1. Crear cuenta Cloudflare y verificar correo. Elegir Workers & Pages.
2. Autorizar Wrangler desde una máquina de confianza con `npx wrangler login`.
   No copiar tokens ni claves en chat. Alternativamente el operador puede usar
   un token limitado a Workers Scripts, D1 y la cuenta necesaria, introducido en
   la configuración segura del entorno como CLOUDFLARE_API_TOKEN y
   CLOUDFLARE_ACCOUNT_ID. Esa conexión NO está configurada en esta sesión.
3. Ejecutar `npx wrangler d1 create elah-catalog`. Guardar el database_id devuelto
   en wrangler.jsonc. No crear otra base si el comando ya tuvo éxito.
4. Elegir el subdominio workers.dev de la cuenta. Configurar ELAH_PUBLIC_ORIGIN
   en wrangler.jsonc con el origen HTTPS final, sin barra al final.
   El dominio de Vercel no se puede trasladar a Cloudflare: habrá una URL nueva.
5. Aplicar esquema: `npx wrangler d1 migrations apply elah-catalog --remote`.
6. Configurar ELAH_ADMIN_TOKEN con `npx wrangler secret put ELAH_ADMIN_TOKEN`.
   Usar una clave aleatoria fuerte en el formulario protegido de la herramienta;
   puede generarse una nueva para esta instalación. No se importa ninguna sesión
   de Vercel: todas las conexiones se autorizan de nuevo.
7. Para conservar escrituras de inventario, configurar también las integraciones
   existentes ELAH_APPS_SCRIPT_WRITE_URL y ELAH_APPS_SCRIPT_WRITE_TOKEN mediante
   `wrangler secret put`. Sin ellas la lectura funciona y la escritura devuelve
   503; no anunciar que las escrituras están migradas antes de verificarlas.

## Preservación de registros: puerta previa a activar la tienda

El repositorio contiene 12 vínculos explícitos en image-overrides.json.
`node scripts/import-cloudflare-records.mjs` genera SQL de esos vínculos en work/.
No es una exportación completa de Blob y no acredita que no existan otros datos.

Antes de activar el catálogo nuevo, recuperar/exportar todos los registros
image-registry/ y content-overrides/ del almacén antiguo, aunque las operaciones
normales estén suspendidas. Puede requerir soporte Vercel o esperar el
restablecimiento. Nunca borrar el almacén para resolver la cuota.
No importar oauth/: las sesiones viejas deben expirar y los clientes reconectarse.

Un archivo local de exportación verificado tiene esta estructura:
`{"images":[{"reference":"ELAH-AC034","url":"https://res.cloudinary.com/bl7tzrfk/image/upload/ELAH-AC034","public_id":"ELAH-AC034"}],"content":[]}`
Ejecutar `node scripts/import-cloudflare-records.mjs /ruta/export.json` y luego
`npx wrangler d1 execute elah-catalog --remote --file work/cloudflare-records.sql`.
La importación no sobrescribe registros ya presentes. Si Blob no permite exportar,
reconstruir y auditar los enlaces de Cloudinary por referencia e identificar los
cambios editoriales faltantes antes de afirmar que la migración está completa.
Las fotos originales siguen en Cloudinary y los respaldos estáticos permanecen.

## Publicar y verificar

- Ejecutar npm test y npm run cloudflare:check.
- Publicar con npm run cloudflare:deploy solo tras configurar cuenta, DB y claves.
  La comprobación previa impide desplegar los identificadores de ejemplo.
- En GitHub, actualizar la variable de repositorio ELAH_PUBLIC_ORIGIN con la misma
  URL de Cloudflare y publicar la actualización de autorizar-mcp.yml en main.
  La política OIDC conserva repositorio, rama, workflow y audiencia exactos.
- Abrir /admin/login, aprobar solicitud propia con el workflow, cargar el panel.
- Reconectar ChatGPT usando OAuth y <nuevo-origen>/api/mcp; comprobar tools/list.
- Verificar inventario de solo lectura, fotos actuales, categorías, filtros,
  carrito, favoritos y cuenta de clientes. AUTH_API conserva su Apps Script actual.
- Solo con referencia e imagen autorizadas por el usuario, probar una carga real,
  el registro D1 y su visualización. Comprobar que stock y precios no cambiaron.
- Confirmar CSP/cookies, funcionamiento en móvil y ausencia de fuentes/secretos
  en archivos públicos antes de sustituir los enlaces compartidos de la tienda.

## Consumo y frescura

El catálogo obtiene todos los enlaces en una petición por lotes (D1 pagina a
1.000 registros). Carga imágenes de tarjetas con lazy loading y limita la revisión
de cada foto visible a una vez por minuto. El CDN guarda exclusivamente respuestas
públicas de imágenes/contenido hasta 60 segundos; cookies y Authorization evitan
esa caché. OAuth, sesiones, escrituras y stock no entran en caché.
El inventario mantiene su actualización actual, sin modificar valores ni fórmulas.

D1 elimina hasta 500 estados OAuth expirados por día, con un día de margen; no
elimina imágenes, inventario ni autorizaciones vigentes. D1 y Workers gratuitos
siguen teniendo cuotas; la migración no garantiza consumo ilimitado.
Cloudinary continúa con sus cuotas compartidas. No se cambia el preset existente.

## Reproducir pruebas del runtime

`npm run cloudflare:check` genera el bundle, luego
`npm run cloudflare:test-runtime` verifica workerd y D1 efímero con claves ficticias.
En el entorno administrado, usar XDG_CONFIG_HOME dentro de work/ y
WRANGLER_SEND_METRICS=false para que no se escriba en el directorio personal.
