import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceiptUpload,receiptUploadIntent,receiptUploadKey,receiptUploadTarget,receiptAttachmentRow} from '../receipt-upload.js';
const projectId='11111111-1111-4111-8111-111111111111',recordId='33333333-3333-4333-8333-333333333333',userId='22222222-2222-4222-8222-222222222222';
const target={projectId,kind:'expense',recordId};
const image=()=>new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1])],{type:'image/png'});
function fixture(){
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const state={record:null,blob:null,uploads:0,links:0,reads:0,user:userId,loseUpload:false,loseLink:false};
 const api={receiptOwner:async()=>state.user,receiptRecord:async()=>({value:state.record}),receiptBlob:async()=>{state.reads++;if(!state.blob){const e=Error('missing');e.status=404;throw e;}return state.blob;},uploadReceiptObject:async(intent,file)=>{assert.ok(storage.getItem(receiptUploadKey(target)));state.uploads++;state.blob=file;if(state.loseUpload)throw Error('lost upload response');},linkReceipt:async intent=>{state.links++;if(state.record!==intent.expected)throw Error('conflict');state.record=intent.path;if(state.loseLink)throw Error('lost link response');return {value:intent.path};}};
 const make=options=>createReceiptUpload({api,target,storage,mode:'owner',...options});return {storage,state,api,make,values};
}
test('new receipt is journaled before one upload and one metadata link; no financial API exists in controller',async()=>{
 const f=fixture(),op=f.make();const result=await op.run(image());assert.equal(result.state,'linked');assert.equal(f.state.uploads,1);assert.equal(f.state.links,1);assert.equal(f.values.size,0);assert.ok(f.state.record.includes('/expenses/'));assert.ok(!f.state.record.includes('token'));
});
test('single flight spans separate controllers for the same session record',async()=>{
 const f=fixture(),a=f.make(),b=f.make();await Promise.all([a.run(image()),b.run(image())]);assert.equal(f.state.uploads,1);assert.equal(f.state.links,1);
});
test('lost upload response survives controller recreation; verification reads only then explicit link without reupload',async()=>{
 const f=fixture();f.state.loseUpload=true;await assert.rejects(f.make().run(image()));const saved=f.make().pending();assert.ok(Object.isFrozen(saved));assert.ok(Object.isFrozen(saved.target));assert.equal(JSON.stringify(saved).includes('data:image'),false);
 f.state.loseUpload=false;assert.equal((await f.make().verify()).state,'uploaded');assert.equal(f.state.uploads,1);assert.equal(f.state.links,0);
 await f.make().run();assert.equal(f.state.uploads,1);assert.equal(f.state.links,1);assert.equal(f.state.record,saved.path);
});
test('lost metadata acknowledgement recovers by reads without another PATCH or object POST',async()=>{
 const f=fixture();f.state.loseLink=true;await assert.rejects(f.make().run(image()));assert.equal((await f.make().verify()).state,'linked');assert.equal(f.state.links,1);assert.equal(f.state.uploads,1);assert.equal(f.values.size,0);
});
test('original request and bytes survive missing-object retry; a replacement image is rejected',async()=>{
 const f=fixture();f.api.uploadReceiptObject=async()=>{throw Error('network');};await assert.rejects(f.make().run(image()));const intent=f.make().pending();assert.equal((await f.make().verify()).state,'missing');
 await assert.rejects(f.make().run(new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,2])],{type:'image/png'})),/نفس الصورة/);assert.deepEqual(f.make().pending(),intent);assert.equal(f.state.links,0);
});
test('conflicting metadata, mismatched stored bytes and changed auth owner cannot link or overwrite',async()=>{
 for(const change of [f=>f.state.record='other/reference',f=>f.state.blob=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,2])],{type:'image/png'}),f=>f.state.user=recordId]){
  const f=fixture();f.state.loseUpload=true;await assert.rejects(f.make().run(image()));change(f);await assert.rejects(f.make().verify());assert.equal(f.state.links,0);assert.equal(f.state.uploads,1);assert.equal(f.values.size,1);
 }
});
test('storage unavailable/corrupt and foreign journals reject before upload',async()=>{
 const f=fixture();f.storage.setItem=()=>{throw Error('storage blocked');};await assert.rejects(f.make().run(image()));assert.equal(f.state.uploads,0);
 const g=fixture();g.values.set(receiptUploadKey(target),'broken');await assert.rejects(g.make().run(image()));assert.equal(g.state.uploads,0);
 assert.throws(()=>createReceiptUpload({api:f.api,target,mode:'viewer',storage:f.storage}));assert.throws(()=>createReceiptUpload({api:f.api,target,mode:'owner',storage:null}));
});
test('cleanup failure verifies original link without any replacement write',async()=>{
 const f=fixture(),remove=f.storage.removeItem;f.storage.removeItem=()=>{throw Error('cleanup');};await assert.rejects(f.make().run(image()));f.storage.removeItem=remove;await f.make().verify();assert.equal(f.state.uploads,1);assert.equal(f.state.links,1);assert.equal(f.values.size,0);
});
test('stale context after upload preserves intent and suppresses linking',async()=>{
 const f=fixture();let current=true;const upload=f.api.uploadReceiptObject;f.api.uploadReceiptObject=async(...args)=>{await upload(...args);current=false;};await assert.rejects(f.make({isCurrent:()=>current}).run(image()));assert.equal(f.state.links,0);assert.equal(f.values.size,1);
});
test('empty reference or existing attachment is never overwritten; verification cannot create an intent',async()=>{
 const f=fixture();await assert.rejects(f.make().verify());assert.equal(f.values.size,0);f.state.record='BANK123';await assert.rejects(f.make().run(image()));assert.equal(f.state.uploads,0);
});
test('metadata contract requires exact identity/column and current native purchase/payment states',()=>{
 for(const [kind,extra] of [['expense',{}],['purchase',{status:'paid'}],['payment',{payment_kind:'cash'}],['old_debt',{}]]){
  const t={...target,kind},field=kind==='payment'?'reference':'receipt_path';assert.deepEqual(receiptAttachmentRow([{id:recordId,project_id:projectId,[field]:null,...extra}],t),{value:null});
 }
 assert.equal(receiptAttachmentRow([{id:recordId,project_id:projectId,receipt_path:null,status:'draft'}],{...target,kind:'purchase'}).blocked,true);
 assert.equal(receiptAttachmentRow([{id:recordId,project_id:projectId,reference:null,payment_kind:'discount'}],{...target,kind:'payment'}).blocked,true);
 assert.throws(()=>receiptAttachmentRow([{id:recordId,project_id:recordId,receipt_path:null}],target));assert.throws(()=>receiptUploadTarget({...target,recordId:'bad'}));
 assert.throws(()=>receiptUploadIntent({version:99},target));
});
test('record state changes block new linking but do not replay an already linked acknowledgement',async()=>{
 const f=fixture();f.state.loseLink=true;await assert.rejects(f.make().run(image()));f.api.receiptRecord=async()=>({value:f.state.record,blocked:true});assert.equal((await f.make().verify()).state,'linked');assert.equal(f.state.links,1);
 const g=fixture();g.state.loseUpload=true;await assert.rejects(g.make().run(image()));g.api.receiptRecord=async()=>({value:null,blocked:true});await assert.rejects(g.make().run(),/السجل/);assert.equal(g.state.links,0);
});
test('a non-durable storage setter cannot authorize an object upload',async()=>{
 const f=fixture();f.storage.setItem=()=>{};await assert.rejects(f.make().run(image()));assert.equal(f.state.uploads,0);assert.equal(f.state.links,0);
});
