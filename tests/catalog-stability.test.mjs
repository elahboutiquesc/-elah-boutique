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
 const ctx={data:[product],elahFavorites:[],document:{querySelectorAll:()=>[card]},money:(p,cop)=>String(cop),draw(){},categoryConfig:()=>false,window:{scrollY:700},activeCategory:'accesorios',filterSearch:{value:'ELAH-AC044'},filterSize:{value:'Única'},showCategory(){throw Error('Filters reset');},renderProducts(){throw Error('Grid rebuilt');},console,fetch:async()=>({ok:true,json:async()=>({ok:true,productos:[{referencia:product.r,descripcion:'Zarcillos dorados',talla:'Única',stock,precioUSD:2.42,precioCOP:8000,estado:stock?'DISPONIBLE':'AGOTADO'}]})})};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function reconcileCategoryCards(){'),source.indexOf('function openProfile()')),ctx);
 await ctx.syncInventory();assert.equal(button.disabled,true);assert.equal(name.textContent,'Zarcillos dorados');assert.equal(price.textContent,'8000');assert.equal(size.textContent,'Talla Única');
 stock=1;await ctx.syncInventory();assert.equal(button.disabled,false);assert.equal(button.textContent,'🛒');assert.equal(ctx.window.scrollY,700);assert.equal(ctx.filterSearch.value,'ELAH-AC044');assert.equal(ctx.filterSize.value,'Única');assert.equal(ctx.data[0],product);
});
test('accessory subcategories use inventory classification, including products named Aros',()=>{
 const ctx={data:[{r:'ELAH-AC050',n:'Aros dorados con bolitas',category:'Accesorios - Zarcillos'},{r:'ELAH-AC051',n:'Modelo nuevo',category:'Accesorios - Zarcillos'},{r:'ELAH-AC020',n:'Lentes con cristales claros',category:'Accesorios - Lentes'},{r:'ELAH-AC052',n:'Aros dorados'}],activeCategory:'accesorios',activeAccessorySub:'zarcillos',categoryConfig:()=>({prefix:'ELAH-AC'}),filterSearch:{value:''},filterSize:{value:''},filterPrice:{value:''},filterColor:{value:''}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function filteredCategoryProducts(){'),source.indexOf('function applyCategoryFilters(){')),ctx);
 assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-AC050','ELAH-AC051','ELAH-AC052']);
 ctx.activeAccessorySub='lentes';assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-AC020']);
});
test('new matching inventory cards appear once without replacing existing cards or clearing filters',()=>{
 const cards=[];
 const card=ref=>({isConnected:true,querySelector:()=>({textContent:ref}),getBoundingClientRect:()=>({top:100,bottom:400}),remove(){cards.splice(cards.indexOf(this),1);this.isConnected=false;}});
 const original=card('ELAH-AC048');cards.push(original);
 const ctx={data:[{r:'ELAH-AC048',n:'Zarcillos plateados',p:1.5,s:'Única'},{r:'ELAH-AC049',n:'Zarcillos dorados cuadrados',p:1.5,s:'Única'},{r:'ELAH-AC050',n:'Lentes dorados',p:1.5,s:'Única'}],activeCategory:'accesorios',activeAccessorySub:'zarcillos',categoryConfig:()=>({prefix:'ELAH-AC'}),filterSearch:{value:'zarcillos'},filterSize:{value:''},filterPrice:{value:''},filterColor:{value:''},inferColor:()=>'',window:{innerHeight:800,scrollBy(){throw Error('Unexpected scroll');}},productCard:p=>p.r,products:{querySelectorAll:()=>cards,querySelector:()=>null,insertAdjacentHTML(position,ref){assert.equal(position,'beforeend');cards.push(card(ref));}}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function reconcileCategoryCards(){'),source.indexOf('function refreshVisibleCatalog(){'))+source.slice(source.indexOf('function filteredCategoryProducts(){'),source.indexOf('function applyCategoryFilters(){')),ctx);
 ctx.reconcileCategoryCards();ctx.reconcileCategoryCards();assert.equal(cards.length,2);assert.equal(cards[0],original);assert.equal(cards[1].querySelector('.ref').textContent,'ELAH-AC049');assert.equal(ctx.filterSearch.value,'zarcillos');
});
