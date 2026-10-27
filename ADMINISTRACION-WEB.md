# Administración web de fotografías

Abrir `/cargar-fotos.html` y seleccionar **Entrar como administrador**. El acceso
usa la misma aprobación por GitHub que el conector: ejecutar el workflow existente
«Autorizar conexión MCP de ELAH», rama main, con el request_id mostrado. Volver a la
ventana de ELAH; tras la aprobación se abre el cargador con una sesión de una hora.
No se solicita la clave administrativa ni se muestran tokens OAuth.

La sesión está en una cookie `__Host-elah_admin`, Secure, HttpOnly, SameSite=Strict,
con Path=/ y duración limitada. Solo su hash se guarda en el Blob privado, separado
de los registros de imágenes y concesiones OAuth. La identidad viene de la
aprobación OIDC verificada de GitHub. No se añade un proveedor ni un secreto nuevo.

Cada escritura desde el navegador exige la cookie, el origen exacto de ELAH y un
token CSRF obtenido de `/admin/session` y mantenido solo en memoria. Las respuestas
no se almacenan en caché. El cargador no utiliza localStorage/sessionStorage para
credenciales y no conserva la clave administrativa. El cierre de sesión revoca
el estado persistente, además de retirar la cookie. Ante fallos de almacenamiento
se deniegan las operaciones.

Los clientes existentes con bearer administrativo siguen funcionando; no se
acepta una cookie como alternativa si se envía un Authorization incorrecto.
El MCP conserva OAuth, PKCE y sus validaciones: no acepta la cookie del navegador.
Las transacciones OAuth y las de acceso web tienen tipos distintos y no pueden
intercambiarse. Se mantienen los endpoints de carga y registro, las referencias
existentes y el control del inventario.

La página usa un script propio y CSP sin scripts inline ni terceros. El flujo de
aprobación comparte una página de consentimiento que escapa nombres del cliente y
requiere CSP nonce. La cookie temporal de acceso web es distinta de la de OAuth,
para no interferir en una conexión simultánea de ChatGPT.

Si falla el registro después de que Cloudinary acepte la fotografía, el cargador
ofrece reintentar la vinculación utilizando la misma URL, sin repetir la carga.
Esta recuperación permanece en la página actual; conservar el enlace si se cierra
la pestaña antes de completar el registro.
