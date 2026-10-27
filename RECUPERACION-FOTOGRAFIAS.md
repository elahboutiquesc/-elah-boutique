# Lectura y recuperación de fotografías

El lector usa `new Response(file.stream).json()`, conforme al `ReadableStream`
que devuelve `get()` en el SDK de Vercel Blob instalado. No invoca `stream()`.
Rechaza registros sin contenido, con referencia distinta o URL ajena al Cloudinary
configurado. La decodificación UTF-8 funciona aunque los caracteres estén divididos
entre fragmentos.

El MCP mantiene el preset unsigned y las integraciones existentes. Si Cloudinary
acepta la imagen y falla la escritura de Blob, responde con `isError: true` y un
contenido JSON con estado `registration_pending`, `reference`, `url`, `public_id`
y `recovery`. No informa que la publicación haya terminado ni elimina la foto.

El cliente debe conservar esa respuesta y ejecutar el `tools/call` indicado en
`recovery`, usando la autenticación de administrador existente. La herramienta
`recuperar_registro_fotografia` reutiliza el endpoint de registro existente para
escribir la URL en la misma clave `image-registry/REFERENCIA.json`. No vuelve a
cargar la imagen en Cloudinary y no modifica filas, referencias ni existencias.
Repetir la recuperación no crea nuevas claves. Si Blob sigue caído se devuelve
un error: conservar los datos originales para reintentar. La recuperación actualiza
la clave de esa referencia, como ya permite el registro administrativo existente;
no debe usarse para sobrescribir una foto que otro administrador haya cambiado.

No hay una cola duradera nueva ni una transacción entre los dos proveedores. La
foto queda en Cloudinary y los datos de recuperación se entregan al cliente; su
retención y reintento son necesarios. Si se pierde la respuesta, debe verificarse
el recurso existente en Cloudinary por la referencia antes de registrar su URL,
sin repetir la carga unsigned ni inventar una referencia.

Validación: 14 pruebas sin servicios remotos, con Blob en memoria y Cloudinary
simulado, cubren escritura/lectura, recuperación tras fallo, repetición sin nuevas
claves ni cargas, rechazo de enlaces ajenos y aplicación de la URL por el código
real del catálogo en un DOM simulado. No equivalen a una prueba visual de navegador
ni a una escritura autenticada en Vercel Blob. Esas verificaciones reales quedan
pendientes mientras las credenciales no estén disponibles en el proceso.

No se modificaron index.html, productos.json ni el handler de inventario. No se
restauró ELAH-AC002 ni se añadieron productos. Los cambios requieren revisión y
no se desplegaron.
