# ELAH Boutique — protocolo permanente de carga de imágenes

Catálogo público: https://elah-boutique.vercel.app/#categorias
Repositorio: elahboutiquesc/-elah-boutique, main, index.html
Inventario: Google Sheets 1YqRrJhYFUnqyunE9Cp-qkh1y9HvjVtZsCQ70i7pxBME (tabs 2044694489 y 368802770).

## Almacenamiento
- Banco histórico (casi lleno, NO USAR para nuevos productos): Floot bbbab6cd-7156-44c3-9c74-92463dfe89b3, https://elah-assets.floot.app
- Banco activo para próximas fotos: Floot 8ef50686-a1ab-4ad5-92e1-de27c7df2a35, https://elah-imagenes.floot.app
- Banco de reserva para cuando el activo se acerque a su límite: Floot 2891607b-d1d5-4500-9c7d-f2b70562ff93, https://elah-imagenes-reserva.floot.app

## Política para ~300 fotografías pendientes
1. Optimizar CADA imagen antes de subirla: JPEG RGB, lado mayor máximo 1200 px, calidad 65–75, optimize=true; objetivo <250 KB por imagen, preferentemente 100–180 KB. No usar PNG de varios MB para fotos.
2. Usar banco activo; si la cuota se agota, cambiar al banco de reserva SIN borrar fotos usadas.
3. Floot upload_asset devuelve /_cdn/static/...; guardar URL absoluta https://elah-imagenes.floot.app/_cdn/static/... (o dominio del banco de reserva) en el campo img del producto de index.html.
4. Mantener referencia única, id único, talla, precio y stock. Añadir producto al array data en index.html usando fetch_file y SHA actualizado, luego update_file.
5. Registrar en ambas pestañas de Sheets mediante appendCells; evitar duplicados consultando previamente.
6. Confirmar éxito SOLO cuando imagen esté alojada, URL registrada en GitHub y filas de Sheets guardadas. Si alguna etapa falla, explicar exactamente qué falta.
7. Comprobar URLs e imágenes del catálogo. No afirmar capacidad ilimitada ni que futuras subidas están garantizadas; supervisar cuota y habilitar más almacenamiento antes de alcanzar límite.
8. No borrar archivos existentes sin verificar que no son usados por la web u otros proyectos.

Estimación: 300 x 100–250 KB = 30–75 MB, muy por debajo de los ~207.5 MB usados en el banco histórico. Es una estimación de tamaño, no garantía contractual de cuota de Floot.
