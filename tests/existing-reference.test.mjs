import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {requireExistingReference} from '../lib/existing-reference.js';
for(const [name,rows,ok] of [
 ['existing reference',[{referencia:'ELAH-AC034',stock:0}],true],
 ['absent reference',[],false],
 ['duplicate reference',[{referencia:'ELAH-AC034'},{referencia:' elah-ac034 '}],false]
])test(name,async()=>{
 const mocked=mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({ok:true,productos:rows})}));
 try{if(ok)await requireExistingReference('ELAH-AC034');else await assert.rejects(requireExistingReference('ELAH-AC034'));}finally{mocked.mock.restore();}
});
test('upstream failure prevents assignment',async()=>{const m=mock.method(globalThis,'fetch',async()=>{throw Error('offline')});try{await assert.rejects(requireExistingReference('ELAH-AC034'));}finally{m.mock.restore();}});
