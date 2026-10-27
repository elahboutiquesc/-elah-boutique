# Verificación de catálogo e integración

Consultas de solo lectura realizadas sobre el checkout existente. No se crearon,
eliminaron ni modificaron productos, inventario, fotografías, secretos ni despliegues.

## Referencias solicitadas

Google Sheets, consultado mediante el handler `/api/inventory` con Node 24 y
`--use-env-proxy`, respondió HTTP 200, `ok: true`, con 192 productos y cero
referencias duplicadas. Una ausencia en esa respuesta no demuestra que el producto
se haya eliminado de todas las pestañas o del historial de la hoja; solo describe
el inventario expuesto por el Apps Script existente.

| Referencia | Google Sheets vía Apps Script | productos.json | index.html | Fuente observada y diferencia |
| --- | --- | --- | --- | --- |
| ELAH-BL021 | Top beige con lazo; XS; USD 12; precioCOP bruto 39.6; stock 1; DISPONIBLE | Ausente | Ausente | Solo inventario vivo. La interfaz interpreta COP inferiores a 1000 en miles: 39.600 COP. No se muestra como producto nuevo porque la sincronización solo actualiza entradas existentes. |
| ELAH-BL096 | Ausente | Crop top verde oliva asimétrico en tela rib; XS; USD 6; COP 19.800; sin stock ni estado declarados | Mismos datos que JSON | Solo catálogos locales. No hay confirmación actual de existencias en Sheets. Foto histórica de Floot. |
| ELAH-AC002 | Ausente | Zarcillos dorados chunky; USD 1,52; COP 5.000; stock 1; DISPONIBLE | Ausente | Solo JSON local. Su stock local no está confirmado por Sheets. Foto histórica de Floot. |
| ELAH-AC044 | Ausente | Ausente | Zarcillos dorados de aro escultórico; talla Única; USD 2,42; COP 8.000; stock 1; DISPONIBLE | Solo HTML local. Foto configurada en Cloudinary bajo el prefijo elah_catalogo/. Su stock local no está confirmado por Sheets. |

Sheets es la autoridad prevista para stock, talla, estado y precios. HTML define
los productos renderizados y JSON sirve al resolvedor `/api/product-image`.
El registro de Blob puede aportar URLs de imágenes a productos que ya existen
en HTML. El MCP registra fotografías; no crea productos ni filas de inventario.
La procedencia histórica de estas diferencias no se ha determinado.

## Vercel Blob y MCP

- `BLOB_READ_WRITE_TOKEN` y `ELAH_ADMIN_TOKEN`: ausentes en el proceso actual.
  Tampoco aparecen como requisitos en la configuración consultada. No se alteraron
  credenciales ni se intentó extraerlas de otros sistemas.
- Lectura/escritura autenticada real de Blob: no ejecutada por falta del token.
- Diez pruebas existentes pasaron: seis del MCP y cuatro de inventario/catálogos.
  Usan respuestas simuladas y credenciales ficticias en un proceso separado; no
  acreditan permisos reales ni una carga completa en producción.
- El MCP comprueba el token y consulta Blob antes de subir; mantiene el preset
  unsigned existente, valida la referencia devuelta y no confirma publicación si
  falla el registro. Estas rutas quedaron verificadas en simulación.
- Defecto adicional reproducido con un resultado simulado conforme al SDK
  instalado: GET `/api/image-registry` responde 500 al leer un registro válido.
  `get()` devuelve `stream` como propiedad ReadableStream, pero el handler llama
  a `file.stream().then(...)`. Por ello no puede confirmarse el flujo de registro
  y visualización completa en el catálogo, aunque la escritura MCP simulada pase.
- Comprobar Blob mediante list no garantiza permisos de escritura ni elimina
  el riesgo de una caída posterior. Cloudinary y Blob no constituyen una
  transacción: una foto puede subirse y fallar su registro después.

## Pendientes antes de producción

1. Confirmar el estado comercial de las cuatro referencias y aprobar qué entradas
   deben reconciliarse. No deducir stock cero, altas o bajas de su ausencia.
2. Corregir la lectura del flujo de Blob y comprobar registro, lectura y aplicación
   de la URL en el catálogo con pruebas de regresión.
3. Disponer de las credenciales existentes de Blob y administrador en el entorno
   de validación y verificar su alcance. Su ausencia aquí no establece que falten
   también en Vercel producción.
4. Ejecutar una prueba completa de escritura y lectura con una imagen y un destino
   de prueba expresamente acordados, sin reemplazar imágenes existentes ni afectar
   productos reales. No realizada en esta verificación.
5. Verificar el preset unsigned en ese flujo y definir la recuperación ante un
   fallo de registro posterior a la carga (sin reintentos que alteren fotografías).
6. Revisar los cambios de código y arranque preparados. No desplegar hasta resolver
   estos puntos. El flag --use-env-proxy corresponde a esta máquina de nube;
   no implica que Vercel producción lo necesite.

## Actualización tras la corrección del lector

El defecto de `stream()` descrito anteriormente quedó corregido. Se añadieron
pruebas de escritura/lectura y recuperación del MCP sin servicios reales; pasan
14 pruebas en total. El flujo usa `file.stream` y entrega datos de recuperación
si falla Blob después de Cloudinary. La recuperación reutiliza el registro
existente sin otra carga de imagen. Ver RECUPERACION-FOTOGRAFIAS.md. Las menciones
anteriores al error 500 describen el diagnóstico previo, no el estado actual.

Siguen pendientes la validación con credenciales reales, la prueba visual en
navegador y la resolución comercial de diferencias de catálogo. Ningún producto
ni secreto se modificó como parte de esta corrección.
