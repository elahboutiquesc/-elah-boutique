# ELAH — carga por referencia (2026-10-14)

Sitio: https://elah-boutique.vercel.app
Repositorio: elahboutiquesc/-elah-boutique, main
Inventario maestro: 1YqRrJhYFUnqyunE9Cp-qkh1y9HvjVtZsCQ70i7pxBME; Inventario 2044694489, Tienda Web 368802770.

## Cloudinary activo
Cloud name: bl7tzrfk. Preset unsigned: elah_catalogo. Asset folder: ELAH_CATALOGO.
Public ID: referencia exacta, normalizada a mayúsculas, por ejemplo ELAH-AC034.
No API Secret en navegador ni repositorio. Las cargas unsigned no reemplazan recursos existentes.

## Fotos adjuntas en ChatGPT
1. Resolver la referencia desde la instrucción explícita o identificación verificada del producto; no inventar la relación a partir de una foto ambigua. Si falta precio, talla o cantidad para un producto nuevo, solicitarlos; nunca inventarlos.
2. Consultar index.html, productos.json y la fila de Inventario correspondiente antes de crear cualquier producto. Usar la referencia como identidad; conservar stock cuando solo se carga una foto.
3. Optimizar la foto JPEG RGB, lado mayor hasta 1200 px y calidad 75. POST multipart a https://api.cloudinary.com/v1_1/bl7tzrfk/image/upload con file, upload_preset=elah_catalogo, public_id=REFERENCIA.
4. Verificar secure_url y public_id. Si existing=true, conservar y avisar: no afirmar que se reemplazó. Reemplazar fotos requiere una carga firmada autorizada; no crear referencias adicionales para eludirlo.
5. Para referencias ya registradas, no cambiar index.html ni agregar filas: /api/product-image?ref=REFERENCIA resuelve automáticamente Cloudinary. Inventario!I y Tienda Web!I tienen enlaces por referencia que se mantienen con fórmulas.
6. Para productos nuevos, incorporar una sola entrada a index.html y productos.json, con ID de carrito único, y una sola fila en Inventario. Mantener la derivación de Tienda Web; verificar todos los campos y desplegar con GitHub.
7. Confirmar que el endpoint público redirige a la foto correcta y que la fila del inventario conserva sus unidades.

## Cargador de la página
/cargar-imagenes.html permite elegir una referencia existente sin renombrar una foto, o subir un lote con nombres ELAH-AC034.jpg. Optimiza las fotos, valida 10 MB y formatos JPG/PNG/WebP, impide referencias desconocidas y dos fotos de la misma referencia en un lote. No crea productos ni modifica unidades.

## Catálogo e inventario
productos.json conserva fotos históricas como respaldo. /api/product-image prioriza la foto de Cloudinary con el public ID de la referencia; si no existe, usa la URL histórica. El catálogo mantiene sus recortes originales cuando no hay archivo independiente. Cache de redirección hasta 30 segundos.
/api/inventory consulta el Apps Script existente y usa Google Sheets como autoridad; no sobrescribe precios/stock con constantes históricas. Rechaza referencias duplicadas y omite referencias malformadas. La hoja contenía una referencia malformada `}}}}`; no se le asignó una referencia inventada.

No usar Floot para nuevas cargas. No borrar las fotos históricas. No prometer cargas desde ChatGPT cuando no se está ejecutando una tarea ni afirmar que toda foto sin contexto puede identificarse automáticamente.
