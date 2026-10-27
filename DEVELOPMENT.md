# Desarrollo en el entorno de nube

Usar el checkout existente; no crear otro servicio ni un worktree.
Con Node 24, iniciar el adaptador local instalado durante la preparación:

```sh
bash scripts/dev.sh
```

El comando activa `--use-env-proxy` para que `fetch` alcance Google Sheets y
Cloudinary mediante el proxy de esta máquina. No cambia la configuración de
Vercel ni los secretos. El adaptador `/workspace/.elah-dev/server.mjs` pertenece
al entorno de nube y se prepara con su script de instalación guardado.

Comprobar `/api/inventory`: debe responder 200, `ok: true` y `productos`.
Google Sheets sigue siendo la autoridad de precios y existencias. No ejecutar
cargas para comprobar disponibilidad.

Pruebas sin escrituras remotas, con credenciales ficticias solo en el proceso de prueba:

```sh
node --experimental-test-module-mocks --test tests/*.test.mjs
```

El MCP comprueba la presencia del token de Blob y realiza una lectura del
registro antes de enviar la fotografía al preset unsigned existente. Una lectura
correcta no garantiza permiso de escritura ni atomicidad entre Cloudinary y
Blob: un fallo posterior de escritura se devuelve como error, sin confirmar publicación.

Para recuperar una foto aceptada por Cloudinary cuando falle Blob, conservar la
respuesta `registration_pending` del MCP y seguir RECUPERACION-FOTOGRAFIAS.md.
