import test from 'node:test';import assert from 'node:assert/strict';
import {createInventoryViewState,changeInventoryViewState as change,createInventoryViewStore,INVENTORY_PAGE_SIZE} from '../inventory-view-state.js';
import {visibleInventoryRows} from '../inventory.js';
test('native screen begins with current/all/empty query and forty rows',()=>{
 assert.equal(INVENTORY_PAGE_SIZE,40);assert.deepEqual(createInventoryViewState(),{tab:'current',query:'',category:'الكل',visibleLimit:40,categoryScroll:0});
 assert.equal(visibleInventoryRows(Array.from({length:50})).length,40);
});
test('more adds forty and changing query or category resets page limit only when changed',()=>{
 const more=change(createInventoryViewState(),{type:'more'});assert.equal(more.visibleLimit,80);
 assert.equal(change(more,{type:'query',value:''}),more);assert.equal(change(more,{type:'category',value:'الكل'}),more);
 assert.equal(change(more,{type:'query',value:' باركود '}).visibleLimit,40);assert.equal(change(more,{type:'category',value:'مواد'}).visibleLimit,40);
 assert.equal(change(more,{type:'restore-category',value:'الكل'}).visibleLimit,80);
 assert.equal(change({...more,category:'مواد'},{type:'restore-category',value:'الكل'}).visibleLimit,80);
});
test('native tab navigation preserves query category pagination and signed RTL strip scroll',()=>{
 let state=createInventoryViewState();for(const action of [{type:'query',value:'<svg>'},{type:'category',value:'أ'},{type:'more'},{type:'scroll',value:-120},{type:'tab',value:'history'},{type:'tab',value:'current'}])state=change(state,action);
 assert.deepEqual(state,{tab:'current',query:'<svg>',category:'أ',visibleLimit:80,categoryScroll:-120});
});
test('state transitions are frozen serializable and never mutate prior state',()=>{
 const before=createInventoryViewState(),next=change(before,{type:'query',value:'سكر'});assert.ok(Object.isFrozen(next));assert.equal(before.query,'');assert.deepEqual(JSON.parse(JSON.stringify(next)),next);
});
test('invalid actions fail without changing the prior state',()=>{
 const state=createInventoryViewState();for(const action of [null,{type:'tab',value:'bad'},{type:'query',value:1},{type:'category',value:' '},{type:'scroll',value:NaN},{type:'scroll',value:Infinity}])assert.throws(()=>change(state,action));assert.equal(state.visibleLimit,40);
});
test('same project and role reuse a screen handle without persistent storage',()=>{
 const store=createInventoryViewStore(),first=store.forScope('p','viewer');first.dispatch({type:'query',value:'سكر'});assert.equal(store.forScope('p','viewer'),first);assert.equal(first.getState().query,'سكر');assert.ok(Object.isFrozen(store));
});
test('different project or role resets and old scope handles cannot be revived',()=>{
 const store=createInventoryViewStore(),old=store.forScope('p','owner');old.dispatch({type:'query',value:'old'});
 assert.equal(store.forScope('q','owner').getState().query,'');const fresh=store.forScope('p','owner');old.dispatch({type:'query',value:'stale'});
 assert.equal(old.getState().query,'old');assert.equal(fresh.getState().query,'');assert.equal(store.forScope('p','viewer').getState().category,'الكل');
});
test('new lifecycle stores reset even when same project is reopened',()=>{
 const old=createInventoryViewStore().forScope('p','owner');old.dispatch({type:'tab',value:'history'});assert.equal(createInventoryViewStore().forScope('p','owner').getState().tab,'current');
});
