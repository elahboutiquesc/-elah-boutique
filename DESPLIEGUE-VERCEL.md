# Preparación para Vercel

Cambios locales para revisión; sin despliegue ni push.

- Runtime Node 24 fijado en package.json; proyecto estático y funciones Node
  existentes, sin nuevo servicio ni framework. vercel.json da hasta 60 segundos
  por función para comprobar inventario, registro y cargar la imagen.
- .vercelignore excluye dependencias locales, pruebas, scripts, documentación y
  archivos .env de la subida del proyecto. Vercel instalará @vercel/blob.
- npm test valida lector, registro, recuperación y referencias con datos simulados.
- En esta máquina iniciar con bash scripts/dev.sh para activar --use-env-proxy;
  no imponer las variables de proxy de la máquina de nube al proyecto Vercel.

## Credenciales realmente necesarias

El flujo vigente usa Cloudinary unsigned con el preset existente elah_catalogo:
no requiere API key ni secret para subir. La carga real de un PNG mínimo y su
lectura respondieron 200. El nombre configurado coincide con la integración
tras quitar espacios. No se cambiaron variables ni secretos.

BLOB_READ_WRITE_TOKEN: token del almacén privado que ya utiliza el registro,
con lectura y escritura. ELAH_ADMIN_TOKEN: autentica MCP y escrituras del registro.
Ambos están ausentes en esta sesión. Su ausencia aquí no demuestra ausencia en
el proyecto Vercel: comprobar los enlaces existentes de Preview y Production.
No se necesita un ELAH_MCP_KEY adicional: el código usa ELAH_ADMIN_TOKEN.

El inventario usa el Apps Script existente de lectura; no solicita credenciales
adicionales de Google. Ninguna ruta nueva escribe en Sheets ni crea productos.
Todas las escrituras de registro del servidor verifican una referencia única
actual en Sheets y fallan de forma segura si no pueden consultarlo.

Para ejecutar un despliegue desde esta sesión se necesita acceso al proyecto
Vercel existente mediante una sesión autenticada o VERCEL_TOKEN y su vinculación
al proyecto/equipo correcto (VERCEL_PROJECT_ID y VERCEL_ORG_ID son identificadores,
no credenciales). No hay CLI, sesión de despliegue, token ni vinculación de proyecto
disponibles aquí. También puede usarse la integración Git existente, cuya
configuración y permisos no se han verificado; no se hizo push para activarla.

## Antes de activar producción

1. Verificar lectura y escritura con los tokens de Blob/administrador existentes
   en un entorno de prueba y completar recuperación y lectura del registro real.
2. Verificar en Preview la foto en navegador, no solo en el DOM simulado.
3. Revisar las diferencias de productos documentadas en VERIFICACION-PRODUCCION.md;
   no restaurar AC002 ni crear referencias automáticamente.
4. Revisar el diff, vincular el proyecto Vercel existente y comprobar el build
   remoto antes del despliegue aprobado. No se afirma que el build remoto pasó.

La fotografía mínima de la prueba unsigned permanece aislada en Cloudinary bajo
`_elah_integration_tests/`. Sus public_id y URL, sin credenciales, están en
/workspace/.elah-dev/cloudinary-upload-test.json. No pertenece al catálogo y no
modifica inventario. No se intentó borrarla: unsigned no permite eliminarla y las
credenciales firmadas no están inyectadas en este proceso. Puede limpiarse después
con el acceso administrativo existente de Cloudinary.
