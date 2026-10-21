import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptReference,recordedReceiptPath,verifiedReceiptBlob,receiptFileName,RECEIPT_MAX_BYTES} from '../receipt.js';
import {supplierAccountView} from '../supplier-account-view.js';
const projectId='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
const scope=(kind='purchase',folder='purchase-invoices')=>({projectId,kind,path:`${user}/${projectId}/${folder}/1720000000.jpg`});
test('native financial receipt paths are frozen and use only authenticated payment-receipts',()=>{
 for(const [kind,folder] of [['purchase','purchase-invoices'],['expense','expenses'],['payment','supplier-payments'],['old_debt','supplier-old-debts']]){
  const input=scope(kind,folder),result=receiptReference(input);assert.ok(Object.isFrozen(result));assert.equal(result.path,input.path);assert.equal(result.endpoint,'/storage/v1/object/authenticated/payment-receipts/'+input.path);
 }
});
test('receipt paths reject foreign projects, public URLs, traversal, encoding, unknown scopes and executable images',()=>{
 const input=scope();
 for(const path of [input.path.replace(projectId,user),'https://evil.invalid/a.jpg','//evil.invalid/a.jpg',input.path+'/x.jpg',input.path.replace('1720000000','..'),input.path.replace('1720000000','%2e%2e'),input.path.replace('1720000000','a?token=secret'),input.path.replace('1720000000','a\\b'),input.path.replace('.jpg','.svg'),input.path.replace('purchase-invoices','expenses')])assert.throws(()=>receiptReference({...input,path}));
 assert.throws(()=>receiptReference({...input,kind:'subscription'}));assert.throws(()=>receiptReference({...input,projectId:null}));
});
test('plain supplier reference text and non-cash discounts are not file receipts',()=>{
 assert.equal(recordedReceiptPath({reference:'BANK123'},'payment'),'');assert.equal(recordedReceiptPath({reference:scope().path,payment_kind:'discount'},'payment'),'');
 assert.equal(recordedReceiptPath({reference:scope('payment','supplier-payments').path},'payment'),scope('payment','supplier-payments').path);
 assert.equal(recordedReceiptPath({receipt_path:scope().path},'purchase'),scope().path);
 assert.equal(recordedReceiptPath({receipt_path:{url:'x'}},'expense'),'');
});
test('receipt MIME must match JPEG/PNG/WebP signature and canonical filename',async()=>{
 for(const [bytes,type] of [[[255,216,255,0],'image/jpeg'],[[137,80,78,71,13,10,26,10],'image/png'],[[82,73,70,70,0,0,0,0,87,69,66,80],'image/webp']]){
  const result=await verifiedReceiptBlob(new Blob([Uint8Array.from(bytes)],{type}));assert.equal(result.type,type);assert.match(receiptFileName('expense',type),/^SharikX2-expenses\.(jpg|png|webp)$/);
 }
 await assert.rejects(verifiedReceiptBlob(new Blob(['<svg/>'],{type:'image/png'})));
 await assert.rejects(verifiedReceiptBlob(new Blob([Uint8Array.from([255,216,255])],{type:'image/png'})));
 await assert.rejects(verifiedReceiptBlob(new Blob([],{type:'image/png'})));
 await assert.rejects(verifiedReceiptBlob(new Blob([new Uint8Array(RECEIPT_MAX_BYTES+1)],{type:'image/png'})));
 assert.throws(()=>receiptFileName('expense','image/svg+xml'));
});
test('receipt references detach from the supplier source without changing financial amounts or order',()=>{
 const source={projectId,person:{id:'supplier',calculated_debt:2.375},creditAvailable:.125,purchases:[{total:10.005,receipt_path:scope().path}],payments:[{amount:1,reference:'BANK123'}],oldDebts:[{amount:2,receipt_path:scope('old_debt','supplier-old-debts').path}]};
 const before=JSON.stringify(source),view=supplierAccountView(source);assert.equal(JSON.stringify(source),before);assert.equal(view.identity.debt,2.375);assert.equal(view.rows[0].amount,10.005);
 source.purchases[0].receipt_path='changed';assert.equal(view.rows[0].receiptPath,scope().path);assert.equal(view.rows[1].receiptPath,'');assert.ok(Object.isFrozen(view.rows[0]));
});
