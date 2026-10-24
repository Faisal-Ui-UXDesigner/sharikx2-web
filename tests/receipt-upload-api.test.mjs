import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {newReceiptUpload,receiptDigest} from '../receipt-upload.js';
const projectId='11111111-1111-4111-8111-111111111111',recordId='33333333-3333-4333-8333-333333333333',userId='22222222-2222-4222-8222-222222222222';
const target={projectId,kind:'expense',recordId},file=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1])],{type:'image/png'});
function client(){const api=new Api({url:'https://fixture.invalid',publicKey:'public-fixture'});api.deviceContext={projectId,mode:'owner'};api.session=async()=>'fixture-token';api.fetch=async()=>({id:userId});return api;}
test('upload uses owner/device gate, verified auth folder and POST without upsert; digest mismatch cannot dispatch',async t=>{
 const api=client(),intent=newReceiptUpload(target,userId,await receiptDigest(file),null),calls=[];let gates=0;api.assertDeviceWrite=async id=>{assert.equal(id,projectId);gates++;};
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return new Response('{}');});await api.uploadReceiptObject(intent,file);assert.equal(gates,1);assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-token');assert.equal(calls[0].options.headers['x-upsert'],undefined);assert.ok(calls[0].url.endsWith(intent.path));assert.equal(calls[0].options.body,file);
 await assert.rejects(api.uploadReceiptObject(intent,new Blob(['bad'],{type:'image/png'})));assert.equal(calls.length,1);
});
test('missing owner context, other device and mismatched auth user reject object writes',async t=>{
 const api=client(),intent=newReceiptUpload(target,userId,await receiptDigest(file),null);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}');});
 api.deviceContext=null;await assert.rejects(api.uploadReceiptObject(intent,file));api.deviceContext={projectId,mode:'viewer'};await assert.rejects(api.uploadReceiptObject(intent,file));api.deviceContext={projectId,mode:'owner'};
 api.assertDeviceWrite=async()=>{throw Error('other device');};await assert.rejects(api.uploadReceiptObject(intent,file));api.fetch=async()=>({id:recordId});await assert.rejects(api.uploadReceiptObject(intent,file));assert.equal(calls,0);
});
test('record metadata and conditional link scope the exact project/record and only attachment column',async()=>{
 for(const kind of ['expense','purchase','payment','old_debt']){
  const api=client(),t={...target,kind},intent=newReceiptUpload(t,userId,await receiptDigest(file),null),field=kind==='payment'?'reference':'receipt_path',calls=[];
  api.request=async(path,options={})=>{calls.push({path,options});return [{id:recordId,project_id:projectId,[field]:options.method?intent.path:null,status:'paid',payment_kind:'cash'}];};
  assert.deepEqual(await api.receiptRecord(t),{value:null});assert.deepEqual(await api.linkReceipt(intent),{value:intent.path});assert.ok(calls[1].path.includes(`project_id=eq.${projectId}&id=eq.${recordId}`));assert.ok(calls[1].path.includes(`${field}=is.null`));assert.deepEqual(JSON.parse(calls[1].options.body),{[field]:intent.path});assert.equal(calls[1].options.method,'PATCH');if(kind==='purchase')assert.ok(calls[1].path.includes('&status=in.('));if(kind==='payment')assert.ok(calls[1].path.includes('&payment_kind=eq.cash'));
 }
});
test('identity drift after device verification and the central metadata gate prevent dispatch',async t=>{
 const api=client(),intent=newReceiptUpload(target,userId,await receiptDigest(file),null);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}');});
 api.deviceContext={projectId,mode:'owner',identityStorage:{getItem:()=>`web-v1-${userId}`}};api.assertDeviceWrite=async()=>`web-v1-${recordId}`;
 await assert.rejects(api.uploadReceiptObject(intent,file),error=>error.code==='RECEIPT_DEVICE_CHANGED');assert.equal(calls,0);
 api.assertDeviceWrite=async()=>{throw Error('other controlling device');};await assert.rejects(api.linkReceipt(intent),/other controlling device/);assert.equal(calls,0);
});
test('malformed/empty/wrong-column acknowledgements never certify linking',async()=>{
 const api=client(),intent=newReceiptUpload(target,userId,await receiptDigest(file),null);
 for(const rows of [[],[{}],[{id:recordId,project_id:projectId,receipt_path:'other'}],[{id:recordId,project_id:userId,receipt_path:intent.path}]]){api.request=async()=>rows;await assert.rejects(api.linkReceipt(intent));}
});
test('Storage denial remains a failure, 409 is not an acknowledged link and session drift suppresses success',async t=>{
 const api=client(),intent=newReceiptUpload(target,userId,await receiptDigest(file),null);api.assertDeviceWrite=async()=>{};
 t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:403}));await assert.rejects(api.uploadReceiptObject(intent,file),error=>error.status===403);t.mock.restoreAll();
 t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:409}));assert.equal(await api.uploadReceiptObject(intent,file),undefined);t.mock.restoreAll();
 t.mock.method(globalThis,'fetch',async()=>{api.clearSession();return new Response('{}');});await assert.rejects(api.uploadReceiptObject(intent,file),/SESSION_CLOSED/);
});
