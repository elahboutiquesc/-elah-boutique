# Alta segura de productos nuevos en ELAH

Estado: **pendiente de configurar el servicio Apps Script de escritura**. Esta rama no modifica el inventario de producción.

## Nueva acción

El servidor MCP anuncia `crear_producto_en_elah`, que acepta `category`, `description`, `sizes`, `priceUSD` y `requestId` estable de al menos 16 caracteres. El servidor no acepta referencias solicitadas por el cliente ni fotografías dentro de esta acción.

## Integración obligatoria

Configurar en Vercel **solo en el servidor**:

- `ELAH_APPS_SCRIPT_CREATE_URL`: URL HTTPS del Apps Script desplegado bajo `script.google.com/macros/s/`.
- `ELAH_APPS_SCRIPT_CREATE_TOKEN`: secreto compartido separado de OAuth y del token administrativo.

El Apps Script receptor debe validar el token, `action=create_product` y los datos; usar `LockService.getScriptLock().waitLock(...)`; consultar el inventario maestro y el registro persistente de operaciones por `requestId`; devolver el mismo resultado si ese `requestId` ya se completó; calcular la siguiente referencia numérica libre dentro del prefijo de categoría *bajo el bloqueo*, rechazando cualquier duplicado en todas las pestañas; crear los registros en la pestaña `Inventario` y en su pestaña de categoría conservando columnas, fórmulas COP y validaciones; verificar que ambas filas coincidan; guardar durablemente el resultado de la operación; y solo entonces devolver `{ok:true,verified:true,created:true,reference:'ELAH-JN054',stock:5}`.

Debe tratarse la escritura parcial como error pendiente de reconciliación, **no** generar otra referencia en un reintento. Si falla una operación, consultar el `requestId` original antes de cualquier reejecución. La pestaña `Tienda Web` solo debe actualizarse bajo el mismo contrato de idempotencia o por su sincronizador existente; no sobrescribir filas históricas.

### Prueba previa obligatoria

1. Alta de prueba bajo autenticación y confirmación de datos en ambas pestañas.
2. Reenvío del mismo `requestId` sin crear filas nuevas.
3. Dos altas simultáneas con IDs distintos que obtengan referencias diferentes.
4. Comprobación de referencias existentes: no modificar precio, talla, stock o fotografía.
5. Comprobación de `F` (precio COP) como fórmula, no precio fijo.
6. Bloqueo seguro cuando no hay credenciales, falla Sheets, hay referencia duplicada o Apps Script devuelve una respuesta no verificada.

Después de verificar el alta, usar la herramienta **existente** `publicar_fotografia_en_elah` con la referencia devuelta; confirmar Cloudinary, registro Blob, imagen visible en catálogo y existencias intactas.

**No desplegar en producción hasta que el Apps Script y las pruebas estén listos**.
