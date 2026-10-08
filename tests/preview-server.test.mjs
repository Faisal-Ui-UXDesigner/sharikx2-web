import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));

test('isolated previews serve assets and do not collide on ports',async()=>{
 const first=await startPreviewServer({root}),second=await startPreviewServer({root});
 try{
  assert.notEqual(first.origin,second.origin);
  const response=await fetch(first.origin+'/inventory.js?fixture=1');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'text/javascript');
  assert.match(await response.text(),/normalizeProduct/);
  assert.equal((await fetch(second.origin)).status,200);
 }finally{await Promise.all([first.close(),second.close()]);}
});

test('preview rejects missing files and decoded paths outside the project',async()=>{
 const preview=await startPreviewServer({root});
 try{
  for(const path of ['/missing-fixture.js','/%2e%2e%5coutside-fixture.js','/%00']){
   assert.equal((await fetch(preview.origin+path)).status,404);
  }
 }finally{await preview.close();}
});
