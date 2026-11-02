import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const origin=config.vars?.ELAH_PUBLIC_ORIGIN;
if(!origin||origin.includes('REPLACE_')||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('Configura ELAH_PUBLIC_ORIGIN con la URL real de Cloudflare antes de desplegar.');
if(!config.d1_databases?.[0]?.database_id||config.d1_databases[0].database_id.startsWith('00000000-'))throw Error('Crea D1 y configura su database_id antes de desplegar.');
console.log('Configuración pública válida. Deben existir DB, ELAH_ADMIN_TOKEN y las integraciones de inventario en la cuenta destino.');
