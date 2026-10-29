import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('blouse prices follow inventory by reference even when description differs',async()=>{
 const product={r:'ELAH-BL034',n:'Catalog name',s:'M',p:100,cop:330000};
 let usd=9.6,cop=31.68;
 const ctx={data:[product],console:{warn(){},error(e){throw e}},refreshVisibleCatalog(){},fetch:async()=>({ok:true,json:async()=>({ok:true,productos:[{referencia:product.r,descripcion:'Different inventory wording',talla:'S',precioUSD:usd,precioCOP:cop,stock:1,estado:'DISPONIBLE'}]})})};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function syncInventory(){'),source.indexOf('function openProfile()')),ctx);
 await ctx.syncInventory();assert.equal(product.p,9.6);assert.equal(product.cop,31680);assert.equal(product.n,'Catalog name');assert.equal(product.s,'M');
 usd=12;cop=39600;await ctx.syncInventory();assert.equal(product.p,12);assert.equal(product.cop,39600);
});
