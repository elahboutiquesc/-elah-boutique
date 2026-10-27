# OAuth del conector ELAH

El endpoint sigue siendo https://elah-boutique.vercel.app/api/mcp. No se cambia
ELAH_ADMIN_TOKEN, BLOB_READ_WRITE_TOKEN ni Cloudinary. Los clientes anteriores
con el bearer administrativo siguen funcionando; ChatGPT usa tokens OAuth
independientes y nunca recibe esa clave.

## Conectar ChatGPT

Configurar el conector como OAuth y actualizar sus herramientas. El servidor
anuncia la autorización, token, registro dinámico (cliente público), revocación
y PKCE S256 en /.well-known/oauth-authorization-server. La metadata del recurso
está en /.well-known/oauth-protected-resource/api/mcp. Se admite también CIMD
de ChatGPT, sin descargar documentos de clientes desde dominios arbitrarios.

Al conectar, ChatGPT abre la página de consentimiento de ELAH. Esta muestra un
identificador de solicitud y el enlace al workflow «Autorizar conexión MCP de
ELAH» del repositorio existente. Un administrador con acceso de escritura debe:

1. Revisar que la conexión sea propia y permita publicar fotografías.
2. Abrir Run workflow en GitHub, elegir main y pegar el request_id mostrado.
3. Volver a la ventana de ELAH; al aprobarse, regresa automáticamente a ChatGPT.

La identidad se verifica mediante el token OIDC firmado por GitHub Actions,
con repositorio, ID inmutable, audiencia, rama main, workflow y evento exactos.
No se añade un proveedor externo ni se introducen credenciales en la página.
Los registros públicos del workflow no incluyen códigos, cookies ni tokens.
El identificador de solicitud por sí solo no permite completar la autorización.
Esta aprobación es manual por diseño; no es un inicio de sesión automático con
GitHub ni un formulario para introducir ELAH_ADMIN_TOKEN.

## Seguridad y persistencia

- Solo redirects HTTPS de ChatGPT registrados exactamente; sin redirects abiertos.
- PKCE S256 obligatorio, estado del cliente y resource exacto /api/mcp.
- Cookie de navegador Secure, HttpOnly, SameSite=Lax y ligada a la transacción;
  el POST final exige mismo origen. CSP y escape de la metadata del cliente.
- Solicitudes de diez minutos, códigos de dos minutos, un único uso con escritura
  condicional ETag. El SDK de Blob se fija en 2.8.2 para conservar este contrato.
- Tokens opacos aleatorios (256 bits), guardados únicamente como hashes en el
  Blob privado existente bajo oauth/. No entran en image-registry/ ni inventario.
- Access tokens de 15 minutos; refresh tokens con rotación y revocación familiar
  ante reutilización. Duración máxima de la autorización: 30 días o 3000 rotaciones.
- Lecturas sin caché y CAS en canjes, rotación y revocación. Ante un error de
  almacenamiento no se autoriza la operación. El proceso no depende de memoria
  local para códigos ni tokens.
- Token endpoint público con autenticación de cliente none: la prueba es el código
  de un solo uso más PKCE, o el refresh token. No se admiten password grants ni
  client_credentials, ni OAuth implícito ni PKCE plain.

Las escrituras OAuth son exclusivamente estados de autorización. No se modifican
productos, referencias, precios, existencias ni fotos durante la verificación.
La aprobación no autoriza otros recursos ni otros scopes.

Los blobs OAuth vencidos no se aceptan. Este cambio no incorpora borrado periódico
de sus registros; puede añadirse una política de retención para retirar estados
vencidos sin afectar autorizaciones activas. La rotación de la clave administrativa
invalida los identificadores DCR firmados; los conectores DCR deberán reconectarse.

Las pruebas automatizadas verifican el protocolo y los casos de abuso. La conexión
final en la interfaz de la cuenta de ChatGPT exige la acción del titular: no es
posible realizarla solo mediante GitHub o una petición HTTP al MCP.
