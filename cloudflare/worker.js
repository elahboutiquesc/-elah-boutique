import inventory from '../api/inventory.js';
import inventoryUpdate from '../api/inventory-update.js';
import productImage from '../api/product-image.js';
import imageRegistry from '../api/image-registry.js';
import contentUpdates from '../api/content-updates.js';
import uploadImage from '../api/upload-product-image.js';
import rawUpload from '../api/admin-image-upload.js';
import oauth from '../api/oauth.js';
import admin from '../api/admin.js';
import mcp from '../api/mcp.js';
import {withStorage} from '../lib/storage.js';
import {ISSUER} from '../lib/oauth.js';
import {invoke} from './adapter.js';
const routes={'/api/inventory':inventory,'/api/inventory-update':inventoryUpdate,'/api/product-image':productImage,'/api/image-registry':imageRegistry,'/api/content-updates':contentUpdates,'/api/upload-product-image':uploadImage,'/api/admin-image-upload':rawUpload,'/api/oauth':oauth,'/api/admin':admin,'/api/mcp':mcp};
const actions={'/.well-known/oauth-authorization-server':'metadata','/.well-known/oauth-protected-resource':'resource','/.well-known/oauth-protected-resource/api/mcp':'resource'};
export default {
 async fetch(request,env){
  const url=new URL(request.url),query=Object.fromEntries(url.searchParams);let handler=routes[url.pathname];
  if(actions[url.pathname]){handler=oauth;query.action=actions[url.pathname];}
  const match=url.pathname.match(/^\/(oauth|admin)\/([a-z]+)$/);
  if(match){handler=match[1]==='oauth'?oauth:admin;query.action=match[2];}
  if(!handler){if(url.pathname.startsWith('/api/'))return Response.json({error:'Ruta no encontrada'},{status:404});return env.ASSETS.fetch(request);}
  // Host is configured by the operator, never inferred from untrusted request headers.
  if(url.origin!==ISSUER)return Response.json({error:'Origen de despliegue incorrecto'},{status:503});
  if(!env.DB)return Response.json({error:'D1 no configurado'},{status:503});
  const publicRead=request.method==='GET'&&!request.headers.has('Authorization')&&!request.headers.has('Cookie')&&(
   handler===productImage||handler===imageRegistry||handler===contentUpdates);
  const cache=globalThis.caches?.default;
  const cacheKey=new Request(url.toString(),{method:'GET'});
  if(publicRead&&cache){const hit=await cache.match(cacheKey);if(hit)return hit;}
  try{
   const response=await withStorage(env.DB,()=>invoke(handler,request,query));
   if(publicRead&&cache&&[200,307].includes(response.status)){
    const cached=new Response(response.body,response);cached.headers.set('Cache-Control','public, max-age=30, s-maxage=60');
    // Only public photo/editorial responses enter CDN cache, never OAuth or stock.
    await cache.put(cacheKey,cached.clone());return cached;
   }
   return response;
  }
  catch{console.error(JSON.stringify({event:'api.failure',path:url.pathname}));return Response.json({error:'Servicio temporalmente no disponible'},{status:503});}
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil(env.DB.prepare('DELETE FROM records WHERE key IN (SELECT key FROM records WHERE expires_at < ? LIMIT 500)').bind(Math.floor(Date.now()/1000)).run());
 }
};
