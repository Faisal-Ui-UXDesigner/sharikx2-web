import test from 'node:test';
import assert from 'node:assert/strict';
import {PAGE_SIZE,requirePage,collectPages} from '../pagination.js';
import {Api} from '../api.js';

test('pagination preserves order, IDs and source rows over full and partial pages',async()=>{
 const rows=Array.from({length:45},(_,id)=>Object.freeze({id})),offsets=[];
 const result=await collectPages(async offset=>{offsets.push(offset);return rows.slice(offset,offset+PAGE_SIZE);});
 assert.deepEqual(offsets,[0,20,40]);assert.deepEqual(result,rows);assert.notEqual(result,rows);assert.equal(result[0],rows[0]);
});

test('pagination reads the terminal empty page after an exact full page',async()=>{
 const offsets=[];
 assert.equal((await collectPages(async offset=>{offsets.push(offset);return offset?[]:Array.from({length:20},(_,id)=>({id}));})).length,20);
 assert.deepEqual(offsets,[0,20]);
});

test('invalid pages fail explicitly instead of becoming empty or partial results',async()=>{
 for(const page of [null,{},[null],[1],[[]],Array(21).fill({})]){
  assert.throws(()=>requirePage(page),/قراءة السجلات/);
  await assert.rejects(collectPages(async()=>page),/قراءة السجلات/);
 }
});

test('repeated IDs within or across pages are not silently summed or deduplicated',async()=>{
 await assert.rejects(collectPages(async()=>[{id:'same'},{id:'same'}]),/تغير ترتيب/);
 let calls=0;
 await assert.rejects(collectPages(async()=>{calls++;return Array.from({length:20},(_,id)=>({id}));}),/تغير ترتيب/);
 assert.equal(calls,2);
});

test('page reads stop when their session generation changes',async()=>{
 const api=new Api({});let calls=0;
 api.rows=async()=>{calls++;api.clearSession();return Array.from({length:20},(_,id)=>({id}));};
 await assert.rejects(api.allRows('sales','project'),/SESSION_CLOSED/);assert.equal(calls,1);
 api.request=async()=>{api.clearSession();return [{id:'purchase-item'}];};
 await assert.rejects(api.productPurchaseHistory('project','product'),/SESSION_CLOSED/);
});

test('allRows captures filters before awaiting and validates every rows response',async()=>{
 const api=new Api({}),filters={status:'neq.pending'};let calls=0;
 api.rows=async(_table,_id,_select,offset,query)=>{
  assert.equal(query.status,'neq.pending');calls++;
  filters.status='eq.cancelled';
  return offset?[]:Array.from({length:20},(_,id)=>({id}));
 };
 await api.allRows('sales','p','*',filters);assert.equal(calls,2);
 const plain=new Api({});
 for(const table of ['sales','products']){
  plain.request=async()=>null;
  await assert.rejects(plain.rows(table,'p'),/قراءة السجلات/);
 }
});
