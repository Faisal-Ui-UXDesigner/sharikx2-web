import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {newPaymentReceipt} from '../supplier-payment-receipt.js';
import {receiptDigest} from '../receipt-upload.js';
const projectId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222',recordId='33333333-3333-4333-8333-333333333333',supplierId='44444444-4444-4444-8444-444444444444',requestId='55555555-5555-4555-8555-555555555555',scope={projectId,supplierId,requestId},file=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1])],{type:'image/png'});
function client(){const api=new Api({url:'https://fixture.invalid',publicKey:'public-fixture'});api.deviceContext={projectId,mode:'owner'};api.session=async()=>'fixture-token';api.fetch=async()=>({id:userId});return api;}
test('reservation uses verified owner/project/device, native POST bucket and no row query or upsert',async t=>{
 const api=client(),intent=newPaymentReceipt(scope,userId,await receiptDigest(file));let gates=0,puts=0;api.assertDeviceWrite=async()=>{gates++;};api.request=async()=>{throw Error('No financial row exists yet');};
 t.mock.method(globalThis,'fetch',async(url,options)=>{puts++;assert.ok(url.endsWith(intent.path));assert.equal(options.body,file);assert.equal(options.method,'POST');assert.equal(options.headers['x-upsert'],undefined);assert.equal(options.credentials,'omit');return new Response('{}');});await api.uploadPaymentReceipt(intent,file);assert.equal(gates,1);assert.equal(puts,1);
 api.deviceContext.mode='viewer';await assert.rejects(api.uploadPaymentReceipt(intent,file));api.deviceContext.mode='owner';api.assertDeviceWrite=async()=>{throw Error('other device');};await assert.rejects(api.uploadPaymentReceipt(intent,file));assert.equal(puts,1);
});
test('post-payment lookup filters and validates actual record supplier request amount type and project',async()=>{
 const api=client(),valid={id:recordId,project_id:projectId,supplier_id:supplierId,client_request_id:requestId,amount:3.5,reference:null,payment_kind:'cash'};
 api.request=async path=>{for(const part of [`supplier_id=eq.${supplierId}`,`client_request_id=eq.${requestId}`,`project_id=eq.${projectId}`,`id=eq.${recordId}`])assert.ok(path.includes(part));return [valid];};assert.deepEqual(await api.paymentReceiptRecord(scope,recordId,3.5),{value:null});
 for(const change of [{supplier_id:userId},{client_request_id:userId},{project_id:userId},{amount:null},{amount:4},{id:userId},{payment_kind:'invalid'}]){api.request=async()=>[{...valid,...change}];await assert.rejects(api.paymentReceiptRecord(scope,recordId,3.5));}
});
test('owner drift, malformed file, invalid scope and session drift reject pre-payment transport',async t=>{
 const api=client(),intent=newPaymentReceipt(scope,userId,await receiptDigest(file));let calls=0;api.assertDeviceWrite=async()=>{};t.mock.method(globalThis,'fetch',async()=>{calls++;api.clearSession();return new Response('{}');});
 api.fetch=async()=>({id:recordId});await assert.rejects(api.uploadPaymentReceipt(intent,file));api.fetch=async()=>({id:userId});await assert.rejects(api.uploadPaymentReceipt(intent,new Blob(['bad'])));await assert.rejects(api.paymentReceiptOwner({...scope,supplierId:'bad'}));assert.equal(calls,0);await assert.rejects(api.uploadPaymentReceipt(intent,file),/SESSION_CLOSED/);
});
