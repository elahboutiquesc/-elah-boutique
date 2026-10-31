# ELAH — Conectar Apps Script sin Google Cloud ni tarjeta

La hoja maestra es https://docs.google.com/spreadsheets/d/1YqRrJhYFUnqyunE9Cp-qkh1y9HvjVtZsCQ70i7pxBME/edit

## Instalación única (desde la cuenta propietaria)

1. Abrir la hoja → Extensiones → Apps Script. Identificar la implementación existente que alimenta GET del inventario. **No borrar ni reemplazar doGet ni el proyecto.**
2. Crear un archivo `elah-writes.gs` dentro de ese mismo proyecto y copiar el contenido de [elah-writes.gs](./elah-writes.gs). Revisar antes de guardar que el proyecto no tenga otra función `doPost`: si existe, integrar el enrutamiento en esa función en lugar de declarar dos.
3. En *Configuración del proyecto → Propiedades de secuencia de comandos*, crear `ELAH_WRITE_TOKEN` con un secreto aleatorio suficientemente largo, generado fuera del chat. No ponerlo en el repositorio ni compartirlo en mensajes.
4. Implementar → Administrar implementaciones → Editar la implementación web existente (o generar una nueva versión). Ejecutar como **propietario**. El acceso de Web App debe permitir llamadas de Vercel; la autenticación de escritura depende obligatoriamente del secreto del paso anterior. Copiar la URL `https://script.google.com/macros/s/.../exec` sin el secreto.
5. En Vercel, proyecto `elah-boutique`, configurar variables **Production**:
   - `ELAH_APPS_SCRIPT_WRITE_URL` = URL /exec
   - `ELAH_APPS_SCRIPT_WRITE_TOKEN` = exactamente el secreto de la propiedad de script
   Elegir tipo **Sensitive** para el secreto. Volver a desplegar producción.
6. Probar la ruta `PATCH /api/inventory-update` únicamente con `dryRun:true` y el `expected` actual obtenido de Sheets. Comparar que `dryRun:true`, `ok:true` y que la hoja no haya cambiado. Nunca usar una referencia inexistente ni datos ficticios en producción.

## Seguridad y límites

- El cliente solo se autentica ante Vercel con `ELAH_ADMIN_TOKEN`; nunca necesita conocer el secreto de Apps Script.
- Vercel envía a Apps Script la clave compartida mediante POST. No incluir secretos en enlaces, repositorios, capturas o registros.
- La extensión de Apps Script valida tipos, exige referencia única, toma un bloqueo, contrasta valores esperados y hace una lectura de verificación.
- El modo de simulación es el predeterminado; una escritura real exige `dryRun:false`.
- Google Sheets sigue siendo la fuente de verdad. Se escriben únicamente talla (D), precio USD (E) y stock (G); no se toca la fórmula COP (F).
- Las llamadas simultáneas a referencias iguales deben serializarse en Vercel o realizarse secuencialmente.
- La integración no se considera operativa hasta verificar una solicitud autorizada contra la implementación real.
