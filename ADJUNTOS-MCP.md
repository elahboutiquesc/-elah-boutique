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
