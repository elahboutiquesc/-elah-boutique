import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script id="elah-reload-position">([\s\S]*?)<\/script>/)[1];
function boot(type){
 const events=new Map(),calls=[];
 const ctx={performance:{getEntriesByType:()=>[{type}]},history:{scrollRestoration:'auto',state:{cart:1},replaceState:(...args)=>calls.push(['replace',...args])},location:{hash:'#tienda',pathname:'/',search:'?source=test'},document:{documentElement:{style:{scrollBehavior:'smooth'}}},scrollTo:(...args)=>calls.push(['scroll',...args]),addEventListener:(name,fn)=>events.set(name,fn),requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(source,ctx);return {ctx,events,calls};
}
test('reload clears the old collection fragment before restoration and returns to the top',()=>{
 const {ctx,events,calls}=boot('reload');assert.equal(ctx.history.scrollRestoration,'manual');assert.equal(calls[0][3],'/?source=test');assert.deepEqual(calls[1],['scroll',0,0]);
 events.get('pageshow')({persisted:false});assert.equal(calls.filter(c=>c[0]==='scroll').length,2);assert.equal(ctx.history.scrollRestoration,'auto');assert.equal(ctx.document.documentElement.style.scrollBehavior,'smooth');
});
test('fresh links and back/forward navigation keep their native scroll behavior',()=>{
 for(const type of ['navigate','back_forward']){const {ctx,calls,events}=boot(type);assert.equal(calls.length,0);assert.equal(events.size,0);assert.equal(ctx.history.scrollRestoration,'auto');}
});
test('late load never pulls the page away from a user who has already started browsing',()=>{
 const {events,calls}=boot('reload');events.get('touchstart')();events.get('pageshow')({persisted:false});assert.equal(calls.filter(c=>c[0]==='scroll').length,1);
});
