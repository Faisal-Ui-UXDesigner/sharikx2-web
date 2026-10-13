import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {inventoryCreationOrder,inventoryPinOrder,orderInventoryRows} from '../inventory-order.js';import {sortPinnedRows} from '../inventory-pinned.js';
test('native positive creation milliseconds take precedence over text dates and ID fallback',()=>{
 assert.equal(inventoryCreationOrder({id:'99',createdAtMs:'123',created_at:'2099-01-01T00:00:00Z'}),123n);
 assert.equal(inventoryCreationOrder({id:'99',createdAtMs:0,createdAt:'2026-10-13 10:00'}),BigInt(Date.parse('2026-10-13T07:00:00Z')));
});
test('native numeric ID fallback preserves adjacent long identities beyond Number precision',()=>{
 const rows=[{id:'9007199254740992'},{id:'9007199254740993'}];
 assert.deepEqual(sortPinnedRows(rows,{}).map(row=>row.id),['9007199254740993','9007199254740992']);
 assert.equal(inventoryCreationOrder({id:'9223372036854775808'}),0n);assert.equal(inventoryCreationOrder({id:'uuid'}),0n);
});
test('native fallback supports signed IDs and ignores calendar overflow rather than normalizing dates',()=>{
 assert.equal(inventoryCreationOrder({id:'42',createdAt:'2026-02-30 10:00'}),42n);
 assert.equal(inventoryCreationOrder({id:'-42'}),-42n);assert.equal(inventoryCreationOrder({id:'+42'}),42n);
});
test('explicit web pinned membership remains authoritative over stale per-product native stamps',()=>{
 const rows=[{id:'a',pinnedAt:999,createdAtMs:3},{id:'b',createdAtMs:1}];
 assert.deepEqual(sortPinnedRows(rows,{inventoryPinnedIds:['b'],inventoryPinnedAt:{b:2}}).map(row=>row.id),['b','a']);
});
test('equal pin timestamps use creation fallback and final stable source order',()=>{
 const rows=[{id:'first',createdAtMs:2},{id:'new',createdAtMs:3},{id:'tie',createdAtMs:2}];
 assert.deepEqual(sortPinnedRows(rows,{inventoryPinnedIds:['first','new','tie'],inventoryPinnedAt:{first:10,new:10,tie:10}}).map(row=>row.id),['new','first','tie']);
});
test('missing invalid and inherited pin timestamps cannot introduce NaN comparator results',()=>{
 const timestamps=Object.create({a:999});timestamps.b='bad';timestamps.c=-1;
 const rows=[{id:'a',createdAtMs:1},{id:'b',createdAtMs:3},{id:'c',createdAtMs:2}];
 assert.deepEqual(orderInventoryRows(rows,{pinnedIds:['a','b','c'],timestamps}).map(row=>row.id),['b','c','a']);
 for(const value of [null,NaN,Infinity,{},'',-1])assert.equal(inventoryPinOrder(value),0n);
});
test('one decoration pass reads each date once and does not mutate or clone row identities',()=>{
 let reads=0;const rows=Array.from({length:1000},(_,i)=>Object.freeze({id:String(i),get createdAtMs(){reads++;return i+1;}}));
 Object.freeze(rows);const sorted=sortPinnedRows(rows,{});
 assert.equal(reads,1000);assert.equal(sorted[0],rows.at(-1));assert.equal(rows[0].id,'0');
});
test('offset-bearing server creation is an instant and legacy wall sorting is viewer-zone independent',()=>{
 const module=new URL('../inventory-pinned.js',import.meta.url).href;
 const code=`import {sortPinnedRows} from ${JSON.stringify(module)};console.log(JSON.stringify(sortPinnedRows([{id:'native',createdAt:'2026-10-13 10:00'},{id:'api',created_at:'2026-10-13T07:30:00Z'}],{}).map(row=>row.id)));`;
 const output=['UTC','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}));
 assert.equal(output[0],'["api","native"]\n');assert.equal(output[0],output[1]);assert.equal(output[0],output[2]);
});
test('empty/nonarray inputs retain safe empty projection',()=>{
 for(const value of [null,undefined,{},[]])assert.deepEqual(sortPinnedRows(value,{}),[]);
});
