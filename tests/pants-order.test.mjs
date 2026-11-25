import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('requested pants form an ordered final group without changing other categories',()=>{
 const ctx={activeCategory:'pantalones'};vm.createContext(ctx);
 vm.runInContext(html.slice(html.indexOf('function orderPantsProducts('),html.indexOf('function filteredCategoryProducts(')),ctx);
 const ending=[53,56,57,63,65,66,69,71].map(n=>'ELAH-JN'+String(n).padStart(3,'0'));
 const input=[{r:ending[7]}, {r:'ELAH-JN073'},...ending.slice(0,7).reverse().map(r=>({r})),{r:'ELAH-JN010'}];
 assert.deepEqual(Array.from(ctx.orderPantsProducts(input),p=>p.r),['ELAH-JN073','ELAH-JN010',...ending]);
 assert.equal(input[0].r,ending[7]);
 ctx.activeCategory='blackfriday';assert.equal(ctx.orderPantsProducts(input),input);
});
