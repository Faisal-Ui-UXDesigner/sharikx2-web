import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const root=new URL('..',import.meta.url);
async function shellAssets(){
 const worker=await readFile(new URL('service-worker.js',root),'utf8');
 return Array.from(runInNewContext(worker+'\nSHELL;',{self:{addEventListener(){}}}));
}

test('PWA shell references existing assets and excludes connection configuration',async()=>{
 const paths=await shellAssets();
 assert.equal(new Set(paths).size,paths.length);
 assert.equal(paths.includes('./config.js'),false);
 for(const path of paths)await access(new URL(path,root));
});

test('every relative dependency of a cached module is also in the PWA shell',async()=>{
 const paths=await shellAssets(),cached=new Set(paths.map(path=>new URL(path,root).href));
 for(const path of paths.filter(path=>path.endsWith('.js'))){
  const sourceUrl=new URL(path,root),source=await readFile(sourceUrl,'utf8');
  for(const match of source.matchAll(/\b(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){
   assert.ok(cached.has(new URL(match[1],sourceUrl).href),`${path} dependency ${match[1]} must be cached`);
  }
 }
});
