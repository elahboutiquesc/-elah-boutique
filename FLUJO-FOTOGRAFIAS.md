# Publicación de fotografías en la infraestructura existente

Endpoint MCP: https://elah-boutique.vercel.app/api/mcp

Conectar el MCP existente con OAuth y actualizar sus herramientas. Adjuntar una
fotografía y su referencia exacta; invocar `publicar_fotografia_en_elah` con `file`
o base64. La aprobación se realiza en el workflow existente
`autorizar-mcp.yml` en main, con el request_id de la ventana de autorización.
No pegar secretos en conversaciones.

La herramienta verifica una referencia única en el inventario maestro de Sheets,
consulta Blob, sube al preset existente `elah_catalogo` de Cloudinary `bl7tzrfk`
y registra la URL bajo `image-registry/REFERENCIA.json` en el Blob privado.
No escribe en Sheets ni crea productos o filas de inventario. Las referencias
de Sheets que faltaban en el HTML aparecen en el catálogo una sola vez.
Los productos históricos ausentes de Sheets conservan sus datos pero no se
ofrecen para venta tras una sincronización exitosa.

Una respuesta `existing` significa que el preset unsigned conservó la fotografía
anterior; no acredita que la fotografía enviada la haya reemplazado. Reemplazar
recursos existentes requiere configurar carga firmada con credenciales del
servidor. No se han extraído ni rotado secretos existentes.

Si falla Blob después de la carga, la respuesta es `registration_pending` e
incluye los argumentos de `recuperar_registro_fotografia`. Reutilizarlos sin
subir otra vez el archivo. No se confirma publicación mientras falle el registro.

Para acreditar una publicación real hay que comprobar:

1. Respuesta de carga con URL, public_id exacto y sin error.
2. GET `/api/image-registry?ref=REFERENCIA` devuelve el mismo registro.
3. GET `/api/product-image?ref=REFERENCIA` redirige a esa URL.
4. La imagen carga y se ve en la ficha de esa referencia en el catálogo.
5. Precio, talla y stock coinciden con Sheets antes y después.

ELAH-AC044 conserva su identidad y fotografía histórica en ambas copias del
catálogo. No apareció en la respuesta actual del inventario maestro. No se
inventó una fila ni se trasladó su foto a otra referencia. Su publicación por
la herramienta requiere que Sheets exponga esa misma referencia.

Las pruebas automatizadas usan almacenamiento y cargas simulados. Por sí solas
no acreditan una carga real ni la conexión de la cuenta del usuario a ChatGPT.
