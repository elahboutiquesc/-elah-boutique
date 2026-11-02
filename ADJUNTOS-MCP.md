# Adjuntos en «Publicar fotografía en ELAH»

La herramienta MCP existente `publicar_fotografia_en_elah` declara
`_meta["openai/fileParams"] = ["file"]` conforme a la
[referencia de Apps SDK](https://developers.openai.com/apps-sdk/reference/).
El campo `file` declara download_url, file_id, mime_type y file_name; solo
los dos primeros son obligatorios, como exige ChatGPT para Scan Tools.

En ChatGPT, actualizar o volver a conectar las herramientas del conector tras
el despliegue. Adjuntar una fotografía y especificar la referencia existente.
ChatGPT suministra el objeto de archivo y su URL temporal; el usuario no necesita
convertir el archivo a base64 ni pegar credenciales o enlaces privados en el chat.
No se usa openaiFileIdRefs, que corresponde a las Actions de GPT personalizados.

El servidor admite una foto JPG/PNG/WebP de hasta 3,5 MB por llamada. Primero
comprueba referencia y Blob; luego descarga el archivo temporal por HTTPS desde
el almacenamiento oaiusercontent.com de ChatGPT, sin seguir redirecciones, sin
reenviar credenciales administrativas y sin conservar ni registrar la URL
firmada. Limita el tamaño durante la descarga y reconoce el formato por el
contenido, sin depender de la extensión. Si caduca el enlace, solicita adjuntar
de nuevo la foto. Si el cliente entrega un archivo de otro dominio o una URL
que exige redirección, se rechaza; revisar el contrato antes de ampliar orígenes.

Se mantienen la entrada base64 anterior, la autenticación, el preset unsigned,
la validación del inventario y la recuperación del registro. No se aceptan ambas
formas de entrada a la vez. No se crean productos ni se modifican existencias.

Validación: 30 pruebas aprobadas; 10 nuevas comprueban el contrato de descubrimiento,
descarga, validaciones y recorrido hasta el registro con servicios simulados.
La prueba con un adjunto real desde la interfaz ChatGPT requiere que el conector
haya actualizado su lista de herramientas y que el usuario adjunte una fotografía.


## Actualización 1.1.0

La herramienta de adjuntos ahora declara `reference` y `file` obligatorios sin
`oneOf` en el objeto raíz. La carga base64 conserva su herramienta separada y
la compatibilidad del servidor con llamadas anteriores. Esto elimina la unión
ambigua que se exponía al cliente; no demuestra por sí solo que una versión
concreta de ChatGPT entregue el archivo. Tras actualizar las herramientas del
conector debe verificarse una foto real con URL emitida por el host. Nunca
inventar `download_url`, `file_id` ni usar la imagen vista como si fueran bytes.

`crear_producto_en_elah` crea una referencia explícita en la pestaña Inventario
por medio del Apps Script existente. Requiere stock confirmado, además de nombre,
categoría, talla y precio. La creación usa bloqueo y rechaza referencias ya
ocupadas; copia la fórmula COP existente. No infiere stock del número de tallas.
Primero debe actualizarse la implementación del Apps Script con el archivo
`integrations/apps-script/elah-writes.gs` de esta versión, preservando doGet.
Las variables de escritura existentes se reutilizan; no hay nuevos secretos.
La herramienta rechaza respuestas de versiones antiguas del script.
Crear el producto y subir la foto son pasos independientes: si falla la foto,
conservar el producto y reintentar únicamente la publicación de la imagen.
