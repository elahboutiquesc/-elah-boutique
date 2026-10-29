import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('first and repeated inventory responses update existing cards without resetting navigation',async()=>{
 const ref={textContent:'ELAH-AC044'},name={textContent:'Old name'},price={textContent:'Old price'},size={textContent:'Talla M'},button={textContent:'🛒',disabled:false};
 const nodes={'.ref':ref,h3:name,'.price':price,'.info div[style*="font-size:10px"]':size,'.add':button};
 const card={style:{},querySelector:selector=>nodes[selector]||null};
 Object.defineProperty(card,'innerHTML',{set(){throw Error('Card replaced');}});
 const product={id:1,r:'ELAH-AC044',stock:2,p:2.42,cop:8000};
 let stock=0;
 const ctx={data:[product],elahFavorites:[],document:{querySelectorAll:()=>[card]},money:(p,cop)=>String(cop),draw(){},window:{scrollY:700},activeCategory:'accesorios',filterSearch:{value:'ELAH-AC044'},filterSize:{value:'Única'},showCategory(){throw Error('Filters reset');},renderProducts(){throw Error('Grid rebuilt');},console,fetch:async()=>({ok:true,json:async()=>({ok:true,productos:[{referencia:product.r,descripcion:'Zarcillos dorados',talla:'Única',stock,precioUSD:2.42,precioCOP:8000,estado:stock?'DISPONIBLE':'AGOTADO'}]})})};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function refreshVisibleCatalog(){'),source.indexOf('function openProfile()')),ctx);
 await ctx.syncInventory();assert.equal(button.disabled,true);assert.equal(name.textContent,'Zarcillos dorados');assert.equal(price.textContent,'8000');assert.equal(size.textContent,'Talla Única');
 stock=1;await ctx.syncInventory();assert.equal(button.disabled,false);assert.equal(button.textContent,'🛒');assert.equal(ctx.window.scrollY,700);assert.equal(ctx.filterSearch.value,'ELAH-AC044');assert.equal(ctx.filterSize.value,'Única');assert.equal(ctx.data[0],product);
});
