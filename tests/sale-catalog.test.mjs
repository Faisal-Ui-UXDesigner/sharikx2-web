import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaleCatalog,loadSaleCatalog} from '../sale-catalog.js';
const row={id:'p',project_id:'project',barcode:'001',quantity_pieces:2,default_sale_price:3,weighted_unit_cost:1};
test('sale catalog indexes all identities and exact trimmed barcodes without modifying source',()=>{
 const rows=Array.from({length:45},(_,i)=>({...row,id:`p${i}`,barcode:`00${i}`})),before=structuredClone(rows),catalog=createSaleCatalog(rows,'project');
 assert.equal(catalog.products.length,45);assert.equal(catalog.barcode(' 0044 ').id,'p44');assert.equal(catalog.get('p44'),catalog.barcode('0044'));assert.equal(catalog.barcode('44'),undefined);
 assert.deepEqual(rows,before);assert.equal(Object.isFrozen(catalog.products),true);assert.equal(Object.isFrozen(catalog.get('p1')),true);
});
test('sale catalog rejects duplicate IDs/barcodes and wrong-scope inactive rows',()=>{
 for(const rows of [[row,row],[row,{...row,id:'q',barcode:' 001 '}],[{...row,project_id:'other'}],[{...row,active:false}],[{...row,id:''}],null])assert.throws(()=>createSaleCatalog(rows,'project'));
 assert.equal(createSaleCatalog([{...row,barcode:''},{...row,id:'q',barcode:null}],'project').products.length,2);
});
test('sale catalog rejects unknown or negative quantity/price/cost instead of assuming zero',()=>{
 for(const key of ['quantity_pieces','default_sale_price','weighted_unit_cost'])for(const value of [null,undefined,'',NaN,Infinity,-1,'bad'])assert.throws(()=>createSaleCatalog([{...row,[key]:value}],'project'));
 assert.equal(createSaleCatalog([{...row,quantity_pieces:'0.25'}],'project').products.length,1);
});
test('sale catalog loader preserves active project scope and discards stale completed reads',async()=>{
 let current=true,calls=0;const api={allRows:async(...args)=>{calls++;assert.deepEqual(args,['products','project','*',{active:'eq.true'}]);current=false;return [row];}};
 assert.equal(await loadSaleCatalog(api,'project',()=>current),null);assert.equal(calls,1);
 assert.equal(await loadSaleCatalog(api,'project',()=>false),null);assert.equal(calls,1);
});
test('sale catalog loader fails whole read and permits an explicit later retry',async()=>{
 let fail=true;const api={allRows:async()=>{if(fail)throw Error('load failed');return [row];}};
 await assert.rejects(loadSaleCatalog(api,'project'),/load failed/);fail=false;assert.equal((await loadSaleCatalog(api,'project')).get('p').id,'p');
});
