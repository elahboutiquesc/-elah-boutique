import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script id="elah-reload-position">([\s\S]*?)<\/script>/)[1];
function boot(type,value){
 const ctx={performance:{getEntriesByType:()=>[{type}]},history:{scrollRestoration:'manual'},location:{pathname:'/',search:''},window:{},sessionStorage:{getItem:()=>value}};
 vm.runInNewContext(source,ctx);return ctx;
}
test('reload keeps native scroll restoration and restores the matching saved catalog view',()=>{
 const ctx=boot('reload',JSON.stringify({path:'/',category:'accesorios',subcategory:'zarcillos',search:'dorados'}));
 assert.equal(ctx.history.scrollRestoration,'auto');assert.equal(ctx.window.elahReloadView.category,'accesorios');assert.equal(ctx.window.elahReloadView.search,'dorados');
});
test('fresh and back/forward navigation ignore stale reload state',()=>{
 for(const type of ['navigate','back_forward'])assert.equal(boot(type,'{"path":"/"}').window.elahReloadView,undefined);
});
test('missing, damaged or unrelated saved state does not break navigation',()=>{
 for(const value of [null,'invalid','{"path":"/other"}'])assert.equal(boot('reload',value).window.elahReloadView,undefined);
});
test('view restoration preserves filters and hydrates new Sheets-only products without duplicate references',()=>{
 const view={category:'accesorios',subcategory:'zarcillos',search:'ELAH-AC047',size:'Única',price:'',color:'',horizontal:80,items:[{id:4,r:'ELAH-AC047',n:'Zarcillos dorados',s:'Única',p:2,cop:6600}]};
 const ctx={window:{elahReloadView:view},data:[{id:4,r:'ELAH-AC044'}],activeCategory:'favoritos',cur:'usd',categoryConfig:k=>k==='accesorios',currency(){},showAccessorySub(){},filterSearch:{},filterSize:{},filterPrice:{},filterColor:{},products:{},applyCategoryFilters(){}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function restoreCatalogView(){'),html.indexOf("addEventListener('pagehide',rememberCatalogView)")),ctx);ctx.restoreCatalogView();
 assert.equal(ctx.activeCategory,'accesorios');assert.equal(ctx.filterSearch.value,'ELAH-AC047');assert.equal(ctx.filterSize.value,'Única');assert.equal(ctx.products.scrollLeft,80);assert.equal(ctx.data.length,2);assert.notEqual(ctx.data[0].id,ctx.data[1].id);assert.equal(ctx.window.elahReloadView,undefined);
});
