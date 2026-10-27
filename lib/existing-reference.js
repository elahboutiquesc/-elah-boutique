import inventory from '../api/inventory.js';

// Use the existing authoritative integration; never create inventory entries.
export async function requireExistingReference(reference) {
  let status = 200, payload;
  await inventory({method: 'GET'}, {
    setHeader() {},
    status(code) { status = code; return this; },
    json(data) { payload = data; return this; }
  });
  if (status !== 200 || !payload?.ok) {
    throw new Error('No se pudo verificar la referencia en el inventario maestro');
  }
  if (payload.productos.filter(p => p.referencia === reference).length !== 1) {
    throw new Error('La referencia no existe de forma única en el inventario maestro');
  }
}
