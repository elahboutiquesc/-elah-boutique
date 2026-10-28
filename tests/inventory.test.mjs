import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import handler from '../api/inventory.js';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('../productos.json',import.meta.url),'utf8'));
test('both catalog copies have unique references and cart IDs',()=>{
 const inline=JSON.parse(source.match(/data=(\[[\s\S]*?\]);let c=/)[1]);
 for(const rows of [catalog,inline])for(const key of ['r','id'])assert.equal(new Set(rows.map(p=>p[key])).size,rows.length,key+' duplicates');
});
async function inventory(rows){
 const m=mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({ok:true,productos:rows})}));
 const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(d){this.data=d;return this;}};
 try{await handler({method:'GET'},res);return res;}finally{m.mock.restore();}
}
test('inventory rejects duplicates after reference normalization',async()=>{assert.equal((await inventory([{referencia:'ELAH-AC034'},{referencia:' elah-ac034 '}])).code,409);});
test('inventory preserves authoritative values and omits malformed references',async()=>{
 const row={referencia:' elah-ac034 ',stock:0,precioUSD:3,precioCOP:10000,talla:'M'};
 const r=await inventory([row,{referencia:'invalid'}]);assert.equal(r.code,200);assert.deepEqual(r.data.productos,[{...row,referencia:'ELAH-AC034',imagen:'/api/product-image?ref=ELAH-AC034'}]);
});
test('browser synchronization updates stock and prices without duplicating products',async()=>{
 const products=[{r:'ELAH-AC034',stock:9,p:8,cop:20000}];
 const ctx={window:{scrollY:0},data:products,fetch:async()=>({ok:true,json:async()=>({ok:true,productos:[{referencia:'ELAH-AC034',stock:0,precioUSD:3,precioCOP:10000,talla:'M',estado:'AGOTADO'}]})}),categoryConfig:()=>false,activeCategory:'all',renderProducts(){},draw(){},console};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function syncInventory(){'),source.indexOf('function openProfile()')),ctx);
 await ctx.syncInventory();assert.equal(products.length,1);assert.equal(products[0].stock,0);assert.equal(products[0].p,3);assert.equal(products[0].cop,10000);assert.equal(products[0].estado,'AGOTADO');
});
test('Sheets-only references appear once; historical-only references retain metadata but are unverified',async()=>{
 const products=[{id:1,r:'ELAH-AC044',stock:1,p:2.42,cop:8000}];
 const row={referencia:'ELAH-BL021',descripcion:'Top beige',talla:'XS',stock:2,precioUSD:12,precioCOP:39.6,estado:'DISPONIBLE'};
 const ctx={window:{scrollY:0},data:products,fetch:async()=>({ok:true,json:async()=>({ok:true,productos:[row]})}),categoryConfig:()=>false,activeCategory:'all',renderProducts(){},draw(){},console};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function syncInventory(){'),source.indexOf('function openProfile()')),ctx);
 await ctx.syncInventory();await ctx.syncInventory();
 assert.equal(products.length,2);assert.equal(products[0].inventoryVerified,false);assert.equal(products[0].stock,1);
 assert.equal(products[1].r,row.referencia);assert.equal(products[1].cop,39600);assert.equal(products[1].stock,2);assert.equal(products[1].s,'XS');
});
