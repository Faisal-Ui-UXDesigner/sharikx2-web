import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplierPaymentReceipt,newPaymentReceipt,paymentReceiptIntent,paymentReceiptKey} from '../supplier-payment-receipt.js';
import {receiptDigest,receiptUploadKey,receiptUploadIntent} from '../receipt-upload.js';
const projectId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222',recordId='33333333-3333-4333-8333-333333333333',supplierId='44444444-4444-4444-8444-444444444444',requestId='55555555-5555-4555-8555-555555555555';
const scope={projectId,supplierId,requestId},file=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1])],{type:'image/png'}),target={projectId,kind:'payment',recordId};
function fixture(){
 const map=new Map(),events=[];let object=null,value=null;
 const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>{events.push('journal');map.set(key,value);},removeItem:key=>map.delete(key)};
 const api={paymentReceiptOwner:async s=>{assert.deepEqual(s,scope);return userId;},receiptBlob:async()=>{events.push('read');if(!object)throw Object.assign(Error('missing'),{status:404});return object;},uploadPaymentReceipt:async(intent,blob)=>{assert.ok(map.has(paymentReceiptKey(scope)));events.push('upload');object=blob;},paymentReceiptRecord:async(s,id,amount)=>{assert.equal(id,recordId);assert.equal(amount,3.5);events.push('record');return {value};}};
 return {map,storage,api,events,setObject:blob=>object=blob,setValue:path=>value=path,create:(isCurrent=()=>true)=>createSupplierPaymentReceipt({api,storage,scope,isCurrent})};
}
test('pre-payment intent is frozen, request-scoped and has no fabricated financial record ID',async()=>{
 const v=newPaymentReceipt(scope,userId,await receiptDigest(file));assert.ok(Object.isFrozen(v));assert.equal(v.target,undefined);assert.ok(v.path.includes('/supplier-payments/'+requestId+'-'));assert.equal(v.scope.requestId,requestId);
 for(const bad of [{...v,path:'https://evil.invalid/photo'},{...v,size:0},{...v,type:'image/heic'},{...v,scope:{...scope,supplierId:userId}},{...v,sha256:'bad'}])assert.throws(()=>paymentReceiptIntent(bad,scope));
});
test('durable pre-upload and proven hash precede adoption to the real saved payment only',async()=>{
 const f=fixture(),op=f.create(),intent=await op.prepare(file);assert.equal(f.events[0],'journal');assert.equal(f.events.filter(x=>x==='upload').length,1);assert.equal(f.events.includes('record'),false);
 assert.deepEqual(await op.adopt(recordId,3.5),target);assert.equal(f.map.has(paymentReceiptKey(scope)),false);const adopted=receiptUploadIntent(JSON.parse(f.map.get(receiptUploadKey(target))),target);assert.equal(adopted.path,intent.path);assert.equal(adopted.requestId,requestId);
 assert.deepEqual(await op.adopt(recordId,3.5),target);assert.equal(f.events.filter(x=>x==='upload').length,1);
});
test('lost upload reply is verified without re-upload; missing file and mismatched bytes cannot be replaced',async()=>{
 const f=fixture(),put=f.api.uploadPaymentReceipt;f.api.uploadPaymentReceipt=async(...args)=>{await put(...args);throw Error('Lost');};await assert.rejects(f.create().prepare(file),/Lost/);await f.create().prepare();assert.equal(f.events.filter(x=>x==='upload').length,1);
 f.setObject(null);await assert.rejects(f.create().prepare(),/نفس الملف/);await assert.rejects(f.create().prepare(new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,2])],{type:'image/png'})),/نفس الصورة/);
});
test('no-op/blocked storage, owner changes and corrupt intents never dispatch another object',async()=>{
 const f=fixture();f.storage.setItem=()=>{};await assert.rejects(f.create().prepare(file));assert.equal(f.events.includes('upload'),false);
 const g=fixture();await g.create().prepare(file);g.api.paymentReceiptOwner=async()=>recordId;await assert.rejects(g.create().prepare());assert.equal(g.events.filter(x=>x==='upload').length,1);
 g.map.set(paymentReceiptKey(scope),'bad json');await assert.rejects(g.create().prepare());
});
test('real record eligibility, reference conflicts and stale context prevent adoption, not replay money',async()=>{
 const f=fixture(),op=f.create();const intent=await op.prepare(file);f.setValue('bank-reference');await assert.rejects(op.adopt(recordId,3.5));f.setValue(null);f.api.paymentReceiptRecord=async()=>({value:null,blocked:true});await assert.rejects(op.adopt(recordId,3.5));assert.equal(f.map.has(receiptUploadKey(target)),false);
 f.api.paymentReceiptRecord=async()=>({value:intent.path});assert.deepEqual(await op.adopt(recordId,3.5),target);
 const g=fixture();let current=true;const put=g.api.uploadPaymentReceipt;g.api.uploadPaymentReceipt=async(...args)=>{await put(...args);current=false;};await assert.rejects(g.create(()=>current).prepare(file));assert.equal(g.map.has(paymentReceiptKey(scope)),true);
});
test('cleanup failure retains an adopted actual-record journal; retry never POSTs or changes its path',async()=>{
 const f=fixture(),op=f.create(),intent=await op.prepare(file),remove=f.storage.removeItem;f.storage.removeItem=()=>{};await assert.rejects(op.adopt(recordId,3.5));assert.ok(f.map.has(receiptUploadKey(target)));f.storage.removeItem=remove;await op.adopt(recordId,3.5);assert.equal(JSON.parse(f.map.get(receiptUploadKey(target))).path,intent.path);assert.equal(f.events.filter(x=>x==='upload').length,1);
 const g=fixture(),next=g.create(),image=await next.prepare(file),clear=g.storage.removeItem;g.setValue('');g.storage.removeItem=()=>{};await assert.rejects(next.adopt(recordId,3.5));g.setValue(image.path);g.storage.removeItem=clear;await next.adopt(recordId,3.5);assert.equal(JSON.parse(g.map.get(receiptUploadKey(target))).expected,'');assert.equal(g.events.filter(x=>x==='upload').length,1);
});
test('single flight across controllers prevents concurrent reservation uploads',async()=>{
 const f=fixture();let release;const put=f.api.uploadPaymentReceipt;f.api.uploadPaymentReceipt=async(...args)=>{await new Promise(resolve=>release=resolve);await put(...args);};const first=f.create().prepare(file),second=f.create().prepare(file);assert.equal(first,second);for(let i=0;!release&&i<100;i++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(release);release();await first;assert.equal(f.events.filter(x=>x==='upload').length,1);
});
