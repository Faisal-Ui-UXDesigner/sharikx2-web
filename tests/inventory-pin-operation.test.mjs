import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryPinChange,applyInventoryPinChange,inventoryPinChangeMatches,inventoryPinRevision,inventoryPinMetadata} from '../inventory-pin-change.js';
import {createInventoryPinOperation} from '../inventory-pin-operation.js';
const base=()=>({inventoryPinnedIds:['old'],inventoryPinnedAt:{old:10},partners:[{name:'شريك',capital:7.25}],cashBalance:10.125});
test('pin delta preserves unrelated pins and all raw financial fields with frozen source-isolated state',()=>{
 const source=base(),before=JSON.stringify(source),change=inventoryPinChange('new',true,20),next=applyInventoryPinChange(source,change);
 assert.deepEqual(next.inventoryPinnedIds,['old','new']);assert.deepEqual(next.inventoryPinnedAt,{old:10,new:20});assert.equal(next.cashBalance,10.125);assert.ok(Object.isFrozen(next)&&Object.isFrozen(next.partners)&&Object.isFrozen(next.partners[0]));assert.equal(JSON.stringify(source),before);assert.equal(Object.isFrozen(source.partners),false);
});
test('native unpin removes timestamp without changing others and computed keys cannot pollute prototypes',()=>{
 const source=base(),next=applyInventoryPinChange(source,inventoryPinChange('old',false));assert.deepEqual(next.inventoryPinnedIds,[]);assert.deepEqual(next.inventoryPinnedAt,{});
 const safe=applyInventoryPinChange(source,inventoryPinChange('__proto__',true,20));assert.ok(Object.hasOwn(safe.inventoryPinnedAt,'__proto__'));assert.equal(safe.inventoryPinnedAt.__proto__,20);assert.equal({}.polluted,undefined);
});
test('malformed pin metadata revisions identities and clocks cannot become a destructive empty save',()=>{
 for(const state of [null,[],{inventoryPinnedIds:{}},{inventoryPinnedIds:[{}]},{inventoryPinnedAt:[]}])assert.throws(()=>inventoryPinMetadata(state));
 for(const revision of [-1,NaN,'1',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>inventoryPinRevision({state:base(),revision}));assert.equal(inventoryPinRevision({state:base(),revision:Number.MAX_SAFE_INTEGER}),Number.MAX_SAFE_INTEGER);
 for(const [id,pinned,at] of [['',true,1],['a','yes',1],['a',true,0],['a',true,Infinity]])assert.throws(()=>inventoryPinChange(id,pinned,at));
});
test('single flight ignores rapid same and different IDs and merges one change into latest remote state',async()=>{
 let release,writes=0;const latest={...base(),inventoryPinnedIds:['old','remote'],inventoryPinnedAt:{old:10,remote:30},cashBalance:99};
 const api={financeState:async()=>{await new Promise(resolve=>release=resolve);return {state:latest,revision:3};},saveFinanceState:async(id,state,revision)=>{writes++;assert.equal(revision,3);assert.deepEqual(state.inventoryPinnedIds,['old','remote','new']);assert.equal(state.cashBalance,99);return {revision:4};}};
 const operation=createInventoryPinOperation({api,projectId:'p',mode:'owner',state:base(),isCurrent:()=>true});const first=operation.toggle('new',40);assert.equal(operation.toggle('other',50),first);release();await first;assert.equal(writes,1);assert.equal(operation.model().busy,false);assert.equal(operation.model().pending,null);
});
test('fresh read already showing the exact desired pin requires no save request',async()=>{
 let writes=0;const state=applyInventoryPinChange(base(),inventoryPinChange('new',true,40));
 for(const revision of [2,Number.MAX_SAFE_INTEGER]){const operation=createInventoryPinOperation({api:{financeState:async()=>({state,revision}),saveFinanceState:async()=>writes++},projectId:'p',mode:'owner',state:base(),isCurrent:()=>true});const result=await operation.toggle('new',40);assert.equal(result.busy,false);assert.equal(writes,0);assert.equal(operation.model().pending,null);}
});
test('read failure or proven not-dispatched error rolls back only the captured display and permits a new explicit action',async()=>{
 for(const api of [{financeState:async()=>{throw Error('read');}},{financeState:async()=>{throw null;}},{financeState:async()=>({state:base(),revision:0}),saveFinanceState:async()=>{throw Object.assign(Error('gate'),{notDispatched:true});}}]){
  const operation=createInventoryPinOperation({api,projectId:'p',mode:'owner',state:base(),isCurrent:()=>true});await operation.toggle('new',40);assert.equal(operation.model().pending,null);assert.deepEqual(operation.model().state,base());assert.ok(operation.model().error);
 }
});
test('lost acknowledgement remains pending and explicit verification only reads the recorded effect without retransmission',async()=>{
 let state=base(),revision=0,writes=0,reads=0;
 const api={financeState:async()=>{reads++;return {state,revision};},saveFinanceState:async(id,next)=>{writes++;state=next;revision++;throw Error('lost');}};
 const operation=createInventoryPinOperation({api,projectId:'p',mode:'owner',state:base(),isCurrent:()=>true});await operation.toggle('new',40);assert.ok(operation.model().pending);await operation.toggle('other',50);assert.equal(writes,1);await operation.verify();assert.equal(operation.model().pending,null);assert.equal(reads,2);assert.equal(writes,1);
});
test('unmatched read or malformed save acknowledgement cannot falsely clear pending intent',async()=>{
 let writes=0;const api={financeState:async()=>({state:base(),revision:0}),saveFinanceState:async()=>{writes++;return {revision:99};}};
 const operation=createInventoryPinOperation({api,projectId:'p',mode:'owner',state:base(),isCurrent:()=>true});await operation.toggle('new',40);await operation.verify();assert.ok(operation.model().pending);assert.equal(writes,1);assert.match(operation.model().error,/تأكيد/);
});
test('viewer and stale-before-dispatch cannot save and late completion never updates another screen',async()=>{
 let release,active=true,writes=0,notifications=0;const api={financeState:async()=>{await new Promise(resolve=>release=resolve);return {state:base(),revision:0};},saveFinanceState:async()=>{writes++;return {revision:1};}};
 const viewer=createInventoryPinOperation({api,projectId:'p',mode:'viewer',state:base(),isCurrent:()=>true});await viewer.toggle('new',40);assert.equal(release,undefined);
 const operation=createInventoryPinOperation({api,projectId:'p',mode:'owner',state:base(),isCurrent:()=>active,onChange:()=>notifications++});const pending=operation.toggle('new',40);active=false;release();await pending;assert.equal(writes,0);assert.equal(notifications,1);assert.deepEqual(operation.model().state,base());
});
test('auth/device epoch change rejects old dispatch and presentation callback failure never repeats a confirmed request',async()=>{
 let release,writes=0;const api={generation:1,deviceEpoch:1,financeState:async()=>{await new Promise(resolve=>release=resolve);return {state:base(),revision:0};},saveFinanceState:async()=>{writes++;return {revision:1};}};
 const operation=createInventoryPinOperation({api,projectId:'p',mode:'owner',state:base(),isCurrent:()=>true});const pending=operation.toggle('new',40);api.deviceEpoch++;release();await pending;assert.equal(writes,0);
 const confirmed=createInventoryPinOperation({api:{financeState:async()=>({state:base(),revision:0}),saveFinanceState:async()=>{writes++;return {revision:1};}},projectId:'p',mode:'owner',state:base(),isCurrent:()=>true,onChange:()=>{throw Error('presentation');}});await confirmed.toggle('new',40);assert.equal(writes,1);assert.equal(confirmed.model().pending,null);
});
