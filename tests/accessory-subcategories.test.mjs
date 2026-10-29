import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const s=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('rings and necklaces use their inventory subcategories without leaking into earrings',()=>{
 const ctx={data:[{r:'ELAH-AC071',n:'Anillo ámbar',category:'Accesorios - Anillos'},{r:'ELAH-AC072',n:'Collar ámbar',category:'Accesorios - Collares'},{r:'ELAH-AC073',n:'Collar corazón',category:'Accesorios - Collares'},{r:'ELAH-AC046',n:'Zarcillos flor',category:'Accesorios - Zarcillos'}],activeCategory:'accesorios',activeAccessorySub:'collares',categoryConfig:()=>({prefix:'ELAH-AC'}),filterSearch:{value:''},filterSize:{value:''},filterPrice:{value:''},filterColor:{value:''}};
 vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('function filteredCategoryProducts(){'),s.indexOf('function applyCategoryFilters(){')),ctx);
 assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-AC072','ELAH-AC073']);
 ctx.activeAccessorySub='anillos';assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-AC071']);
 ctx.activeAccessorySub='zarcillos';assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-AC046']);
});
