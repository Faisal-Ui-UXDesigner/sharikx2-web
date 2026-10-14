import test from 'node:test';import assert from 'node:assert/strict';
import {popularitySnapshot,snapshotPopularityCounts,readInventoryPopularity,refreshInventoryPopularity,POPULARITY_REFRESH_MS} from '../inventory-popularity-cache.js';
import {auditInstant} from '../date-display.js';
const now=auditInstant('2026-10-13 12:00');
const sales=[{id:'s',status:'completed',completed_at:'2026-10-13T08:00:00Z',items:[{product_id:'a'},{product_id:'a'}]}];
const api=()=>({generation:0,config:{url:'fixture'},deviceContext:{mode:'owner'},allRows:async()=>structuredClone(sales)});
test('native snapshot stores frozen daily aggregates without raw invoice/customer data',()=>{
 const before=JSON.stringify(sales),snapshot=popularitySnapshot('p',sales,now);
 assert.deepEqual(snapshot.dailyCounts,[['a',[['2026-10-13',1]]]]);
 assert.equal(JSON.stringify(sales),before);assert.ok(Object.isFrozen(snapshot.dailyCounts[0][1][0]));assert.equal('sales' in snapshot,false);
});
test('cached counts prune old days as Palestine window moves without recounting invoices',()=>{
 const snapshot=popularitySnapshot('p',[...sales,{...sales[0],id:'old',completed_at:'2026-08-15T08:00:00Z'}],now);
 assert.equal(snapshotPopularityCounts(snapshot,now).get('a'),2);
 assert.equal(snapshotPopularityCounts(snapshot,auditInstant('2026-10-14 12:00')).get('a'),1);
});
test('native integer ceiling bounds cached aggregate without changing daily snapshot',()=>{
 const snapshot={dailyCounts:[['a',[['2026-10-13',2147483647],['2026-10-12',2]]]]};
 assert.equal(snapshotPopularityCounts(snapshot,now).get('a'),2147483647);
});
test('fresh cache avoids backend reads until exact sixty-second boundary',async()=>{
 const client=api();let reads=0;client.allRows=async()=>{reads++;return sales;};
 await refreshInventoryPopularity(client,'p',{now});
 assert.equal((await refreshInventoryPopularity(client,'p',{now:now+59999})).cached,false);assert.equal(reads,1);
 await refreshInventoryPopularity(client,'p',{now:now+POPULARITY_REFRESH_MS});assert.equal(reads,2);
});
test('concurrent same-project refreshes share one read and independent count projections',async()=>{
 const client=api();let release,reads=0;client.allRows=async()=>{reads++;return new Promise(resolve=>release=resolve);};
 const first=refreshInventoryPopularity(client,'p',{now}),second=refreshInventoryPopularity(client,'p',{now});release(sales);await Promise.all([first,second]);assert.equal(reads,1);
 const view=readInventoryPopularity(client,'p',{now});view.counts.set('a',999);assert.equal(readInventoryPopularity(client,'p',{now}).counts.get('a'),1);
});
test('failed refresh preserves confirmed counts and marks them cached, not zero',async()=>{
 const client=api();await refreshInventoryPopularity(client,'p',{now});client.allRows=async()=>{throw Error('network');};
 const result=await refreshInventoryPopularity(client,'p',{now:now+60000});
 assert.equal(result.cached,true);assert.equal(result.counts.get('a'),1);assert.equal(result.loadedAt,now);assert.ok(result.error);
});
test('offline fresh/stale snapshots remain labeled cached without reads; absent snapshot is unknown',async()=>{
 const client=api();assert.equal((await refreshInventoryPopularity(client,'p',{now,online:false})).counts,null);
 await refreshInventoryPopularity(client,'p',{now});client.allRows=()=>{throw Error('must not read');};
 const result=await refreshInventoryPopularity(client,'p',{now:now+1,online:false});assert.equal(result.cached,true);assert.equal(result.counts.get('a'),1);
});
test('project, API instance, backend URL, role and auth generation isolate prior data',async()=>{
 const client=api();await refreshInventoryPopularity(client,'p',{now});
 assert.equal(readInventoryPopularity(client,'other',{now}).counts,null);assert.equal(readInventoryPopularity(api(),'p',{now}).counts,null);
 client.generation++;assert.equal(readInventoryPopularity(client,'p',{now}).counts,null);
 await refreshInventoryPopularity(client,'p',{now});client.deviceContext.mode='viewer';assert.equal(readInventoryPopularity(client,'p',{now}).counts,null);
 await refreshInventoryPopularity(client,'p',{now});client.config.url='other';assert.equal(readInventoryPopularity(client,'p',{now}).counts,null);
});
test('logout while read is pending cannot install results into a new session',async()=>{
 const client=api();let release;client.allRows=async()=>new Promise(resolve=>release=resolve);
 const pending=refreshInventoryPopularity(client,'p',{now});client.generation++;release(sales);
 await assert.rejects(pending,/جلسة/);assert.equal(readInventoryPopularity(client,'p',{now}).counts,null);
});
test('synchronous loader failure clears in-flight state and permits a successful retry',async()=>{
 const client=api();client.allRows=()=>{throw Error('sync');};assert.ok((await refreshInventoryPopularity(client,'p',{now})).error);
 client.allRows=async()=>sales;assert.equal((await refreshInventoryPopularity(client,'p',{now})).counts.get('a'),1);
});
test('clock rollback forces refresh and accepts its new confirmed timestamp',async()=>{
 const client=api();await refreshInventoryPopularity(client,'p',{now:now+10000});
 assert.equal(readInventoryPopularity(client,'p',{now}).needsRefresh,true);
 assert.equal((await refreshInventoryPopularity(client,'p',{now})).loadedAt,now);
});
test('malformed response cannot replace confirmed snapshot; invalid scope/clock fail explicitly',async()=>{
 const client=api();await refreshInventoryPopularity(client,'p',{now});client.allRows=async()=>({});
 assert.equal((await refreshInventoryPopularity(client,'p',{now:now+60000})).counts.get('a'),1);
 for(const value of [0,NaN,Infinity,'bad'])assert.throws(()=>readInventoryPopularity(client,'p',{now:value}));
 assert.throws(()=>popularitySnapshot('',[],now));assert.throws(()=>popularitySnapshot('p',{},now));
});
