import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validImageUrl,validPublicId} from '../lib/image-record.js';
test('image identity must match the complete Cloudinary asset name',()=>{
 const root='https://res.cloudinary.com/bl7tzrfk/image/upload/';
 for(const path of ['ELAH-AC044','v123/elah_catalogo/ELAH-AC044.jpg'])assert.ok(validImageUrl(root+path,'ELAH-AC044'));
 for(const path of ['ELAH-AC0440','ELAH-AC044/OTHER','OTHER?ref=ELAH-AC044'])assert.equal(validImageUrl(root+path,'ELAH-AC044'),false);
 assert.equal(validPublicId('OTHER/ELAH-AC044','ELAH-AC044'),false);
});
