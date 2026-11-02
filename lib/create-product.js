import {referencePattern} from './image-record.js';

export const productSchema={
 type:'object',properties:{
  reference:{type:'string',description:'Referencia nueva exacta; comprobar disponibilidad antes de crearla.'},
  name:{type:'string'},category:{type:'string'},size:{type:'string'},
  priceUSD:{type:'number',minimum:0,maximum:100000},
  stock:{type:'integer',minimum:0,maximum:100000,description:'Cantidad de unidades confirmada por el usuario. No inferirla del número de tallas.'}
 },required:['reference','name','category','size','priceUSD','stock'],additionalProperties:false
};
export function validProduct(p){
 return p&&typeof p==='object'&&!Array.isArray(p)&&
 Object.keys(p).length===6&&productSchema.required.every(k=>Object.hasOwn(p,k))&&
 referencePattern.test(p.reference)&&['name','category','size'].every(k=>
 typeof p[k]==='string'&&p[k].trim()===p[k]&&p[k].length>0&&p[k].length<=(k==='size'?60:160)&&! /^[=+@-]/.test(p[k]))&&
 Number.isFinite(p.priceUSD)&&p.priceUSD>=0&&p.priceUSD<=100000&&
 Number.isInteger(p.stock)&&p.stock>=0&&p.stock<=100000;
}
export async function createProduct(product){
 if(!validProduct(product))throw Error('Producto inválido: confirma referencia, nombre, categoría, tallas, precio y stock.');
 const url=process.env.ELAH_APPS_SCRIPT_WRITE_URL,token=process.env.ELAH_APPS_SCRIPT_WRITE_TOKEN;
 if(!url||!token)throw Error('La creación requiere la integración de escritura de Apps Script configurada.');
 const target=new URL(url);
 if(target.protocol!=='https:'||target.hostname!=='script.google.com'||!target.pathname.startsWith('/macros/s/')||target.username||target.password)throw Error('Integración de escritura inválida.');
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token,action:'create_product',product}),redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('No se confirmó la creación en el inventario maestro.');
 const result=await response.json();
 if(result.error==='REFERENCE_EXISTS')throw Error('La referencia ya existe; no se modificó el producto.');
 if(!result.ok||result.verified!==true||result.reference!==product.reference||result.action!=='create_product')throw Error('No se confirmó la creación. Comprueba que Apps Script tenga instalada la operación create_product antes de reintentar.');
 return {ok:true,verified:true,action:'create_product',reference:product.reference,row:result.row};
}
