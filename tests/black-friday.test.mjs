import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Black Friday contains exactly the approved references and expires at Caracas midnight',()=>{
 const ctx={Date};vm.createContext(ctx);
 vm.runInContext(html.slice(html.indexOf('const blackFridayEndsAt='),html.indexOf('function showBlackFriday()'))+';globalThis.refs=[...blackFridayRefs];globalThis.active=blackFridayActive;',ctx);
 assert.equal(ctx.refs.length,40);assert.equal(new Set(ctx.refs).size,40);
 assert.deepEqual(Array.from(ctx.refs),[3,4,5,6,7,8,9,14,20,21,22,23,32,33,35,41,42,43,44,25,26,58].map(n=>'ELAH-JN'+String(n).padStart(3,'0')).concat(['ELAH-BL023', 'ELAH-BL086', 'ELAH-BL043', 'ELAH-BL048', 'ELAH-BL049', 'ELAH-BL051', 'ELAH-BL053', 'ELAH-BL055', 'ELAH-BL056', 'ELAH-BL083', 'ELAH-BL050', 'ELAH-BL054', 'ELAH-BL057', 'ELAH-BL064', 'ELAH-BL065', 'ELAH-BL066', 'ELAH-BL067', 'ELAH-BL081']));
 assert.equal(ctx.active(Date.parse('2026-11-29T23:59:59-04:00')),true);
 assert.equal(ctx.active(Date.parse('2026-11-30T00:00:00-04:00')),false);
});
test('promotional pieces only appear in Black Friday while the campaign is active',()=>{
 const ctx={data:[{r:'ELAH-JN003',n:'Promoción',s:'M',p:10},{r:'ELAH-JN010',n:'Regular',s:'M',p:30}],activeBlackFridaySub:'pantalones',activeCategory:'pantalones',activePantsSub:'pantalones',categoryConfig:()=>({prefix:'ELAH-'}),blackFridayActive:()=>true,blackFridayRefs:new Set(['ELAH-JN003']),filterSearch:{value:''},filterSize:{value:''},filterPrice:{value:''},filterColor:{value:''}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function filteredCategoryProducts(){'),html.indexOf('function applyCategoryFilters(){')),ctx);
 assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-JN010']);
 ctx.activeCategory='blackfriday';assert.deepEqual(Array.from(ctx.filteredCategoryProducts(),p=>p.r),['ELAH-JN003']);
 ctx.activeBlackFridaySub='blusas';assert.equal(ctx.filteredCategoryProducts().length,0);
 ctx.activeBlackFridaySub='pantalones';
 ctx.activeCategory='pantalones';ctx.blackFridayActive=()=>false;assert.equal(ctx.filteredCategoryProducts().length,2);
});
