import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierRefundSnapshot,supplierRefundDraft,supplierRefundKey,supplierRefundJournal,validateSupplierRefundJournal,readSupplierRefund,persistSupplierRefund,clearSupplierRefund,verifySupplierRefund,supplierRefundAction,supplierRefundRejected,supplierRefundRejectionMessage,SUPPLIER_REFUND_RPC} from '../supplier-refund.js';
import {createOperation} from '../operations.js';
import {deviceRequestScope} from '../device-write-gate.js';
const credits=()=>[{id:'c1',project_id:'pr',supplier_id:'s',amount:.1,remaining_amount:.1},{id:'c2',project_id:'pr',supplier_id:'s',amount:.2,remaining_amount:.2}];
const accounts=()=>[{id:'a',project_id:'pr',name:'نقد <img>',active:true},{id:'b',project_id:'pr',name:'بنك',active:true}];
const supplier=()=>({id:'s',project_id:'pr',name:'المورد',active:true});
const snapshot=()=>supplierRefundSnapshot('pr','s',credits(),accounts());
const draft=()=>supplierRefundDraft('pr',supplier(),snapshot(),'a',.1,'  ملاحظة  ');
const id='11111111-1111-4111-8111-111111111111';
const journal=()=>supplierRefundJournal(draft(),id);
function memory(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}

test('exact complete source sum and frozen receiving catalog never change raw credit/accounts',()=>{
 const c=credits(),a=accounts(),before=JSON.stringify([c,a]),s=supplierRefundSnapshot('pr','s',c,a);assert.equal(s.available,.3);assert.equal(JSON.stringify([c,a]),before);a[0].name='changed';assert.equal(s.accounts[0].name,'نقد <img>');assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.accounts)&&Object.isFrozen(s.accounts[0]));assert.equal(supplierRefundSnapshot('pr','s',[],[]).available,0);
});
test('malformed duplicate foreign inactive and missing source records fail closed',()=>{
 for(const c of [null,[...credits(),credits()[0]],credits().map(x=>({...x,project_id:'other'})),[{...credits()[0],supplier_id:'other'}],[{...credits()[0],remaining_amount:null}],[{...credits()[0],remaining_amount:.11}],[{...credits()[0],amount:'NaN'}]])assert.throws(()=>supplierRefundSnapshot('pr','s',c,accounts()));
 for(const a of [null,[...accounts(),accounts()[0]],[{...accounts()[0],active:false}],[{...accounts()[0],project_id:'other'}],[{...accounts()[0],name:''}]])assert.throws(()=>supplierRefundSnapshot('pr','s',credits(),a));
});
test('refund intent copies only non-sale contract, exact cents and account from captured catalog',()=>{
 const d=draft();assert.deepEqual(d.payload,{p_project_id:'pr',p_supplier_id:'s',p_account_id:'a',p_amount:.1,p_note:'ملاحظة'});assert.equal(d.availableBefore,.3);assert.equal(d.accountName,'نقد <img>');assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.payload));
 assert.equal(supplierRefundDraft('pr',supplier(),snapshot(),'b','.30','').payload.p_amount,.3);
 for(const value of [0,-1,.001,.301,.31,Infinity,NaN,null,true,'',1e12])assert.throws(()=>supplierRefundDraft('pr',supplier(),snapshot(),'a',value,''));
 assert.throws(()=>supplierRefundDraft('pr',supplier(),snapshot(),'unknown',.1,''));assert.throws(()=>supplierRefundDraft('pr',{...supplier(),active:false},snapshot(),'a',.1,''));assert.throws(()=>supplierRefundDraft('foreign',supplier(),snapshot(),'a',.1,''));
});
test('journal strict identities shape and canonical values prevent substitution',()=>{
 const value=journal();assert.deepEqual(validateSupplierRefundJournal(structuredClone(value),'pr'),value);assert.notEqual(validateSupplierRefundJournal(value,'pr').payload,value.payload);
 for(const mutate of [j=>j.version=2,j=>j.requestId='invalid',j=>j.availableBefore='0.3',j=>j.extra=1,j=>j.payload.extra=1,j=>j.payload.p_project_id='other',j=>j.payload.p_amount='0.1',j=>j.payload.p_amount=.4,j=>j.payload.p_note=' changed ',j=>j.accountName='']){const bad=structuredClone(value);mutate(bad);assert.throws(()=>validateSupplierRefundJournal(bad,'pr'));}
 assert.notEqual(supplierRefundKey('a:b'),supplierRefundKey('a%3Ab'));
});
test('pending refund requires durable readback, cannot overwrite corrupt/other supplier or erase newer operation',()=>{
 const storage=memory(),value=journal();persistSupplierRefund(storage,'pr',value);assert.deepEqual(readSupplierRefund(storage,'pr'),value);assert.throws(()=>persistSupplierRefund(storage,'pr',value));
 const next={...value,requestId:'22222222-2222-4222-8222-222222222222'};storage.setItem(supplierRefundKey('pr'),JSON.stringify(next));assert.throws(()=>clearSupplierRefund(storage,'pr',value));assert.equal(readSupplierRefund(storage,'pr').requestId,next.requestId);
 clearSupplierRefund(storage,'pr',next);assert.equal(readSupplierRefund(storage,'pr'),null);storage.setItem(supplierRefundKey('pr'),'broken');assert.throws(()=>persistSupplierRefund(storage,'pr',value));assert.equal(storage.getItem(supplierRefundKey('pr')),'broken');
});
test('blocked and dishonest session storage never permits unprotected refund',()=>{
 assert.throws(()=>readSupplierRefund(null,'pr'));assert.throws(()=>persistSupplierRefund({getItem:()=>null,setItem:()=>{}},'pr',journal()));const storage=memory();persistSupplierRefund(storage,'pr',journal());storage.removeItem=()=>{};assert.throws(()=>clearSupplierRefund(storage,'pr',journal()));
});
test('original refund remains reachable after settlement or archive, never opens fresh archived credit action',()=>{
 const storage=memory();assert.equal(supplierRefundAction(storage,'pr',{...supplier(),available_supplier_credit:0}).visible,false);persistSupplierRefund(storage,'pr',journal());assert.deepEqual(supplierRefundAction(storage,'pr',{...supplier(),active:false,available_supplier_credit:0}),{retry:true,blocked:false,visible:true});assert.equal(supplierRefundAction(storage,'pr',{id:'other',active:false,available_supplier_credit:0}).visible,false);
 storage.setItem(supplierRefundKey('pr'),'bad');assert.equal(supplierRefundAction(storage,'pr',supplier()).blocked,true);
});
test('minimal replay and authoritative remaining credit accepted, malformed or mismatched receipt retained',()=>{
 const p=draft().payload;verifySupplierRefund({id:'r',amount:.1,remaining_credit:50,replayed:false},p);verifySupplierRefund({id:'r',amount:'0.10',replayed:true},p);
 for(const value of [null,{id:'r',amount:.1,replayed:false},{id:'r',amount:.1,remaining_credit:-1,replayed:false},{id:'r',amount:.11,replayed:true},{id:'r',amount:.1,replayed:true,account_id:'b'},{id:'r',amount:.1,replayed:true,remaining_credit:null}])assert.throws(()=>verifySupplierRefund(value,p));
});
test('only exact atomic pre-recording refund rejections release captured request',()=>{
 for(const message of ['REFUND_EXCEEDS_AVAILABLE_CREDIT','INVALID_REFUND_ACCOUNT','INVALID_REFUND_AMOUNT','INVALID_SUPPLIER'])assert.equal(supplierRefundRejected({status:400,message}),true);
 for(const error of [{status:500,message:'INVALID_REFUND_AMOUNT'},{status:400,message:'REFUND_REQUEST_PAYLOAD_MISMATCH'},{status:403,message:'OWNER_REQUIRED'},{status:400,message:'timeout INVALID_SUPPLIER'},{message:'INVALID_SUPPLIER'}])assert.equal(supplierRefundRejected(error),false);
 assert.match(supplierRefundRejectionMessage({message:'INVALID_REFUND_ACCOUNT'}),/حساب الاستلام/);assert.match(supplierRefundRejectionMessage({message:'REFUND_EXCEEDS_AVAILABLE_CREDIT'}),/تغيّر الرصيد/);assert.doesNotMatch(supplierRefundRejectionMessage({message:'<img src=x>'}),/<img/);
});
test('one immutable refund UUID shares central financial gate and cached acknowledgement',async()=>{
 const source={...draft().payload},op=createOperation(SUPPLIER_REFUND_RPC,source,id),calls=[];source.p_amount=99;const api={rpc:async(name,payload)=>{calls.push({name,payload});if(calls.length===1)throw Error('lost');return {id:'r',amount:.1,replayed:true};}};
 await assert.rejects(op.run(api));await op.run(api);await op.run(api);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[1].payload.p_amount,.1);assert.deepEqual(deviceRequestScope('/rest/v1/rpc/'+SUPPLIER_REFUND_RPC,{method:'POST',body:JSON.stringify(calls[0].payload)}),{kind:'write',projectId:'pr'});
});
