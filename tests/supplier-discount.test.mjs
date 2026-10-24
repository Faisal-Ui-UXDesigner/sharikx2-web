import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierDiscountDraft,supplierDiscountAfter,supplierDiscountJournal,validateSupplierDiscountJournal,supplierDiscountKey,readSupplierDiscount,persistSupplierDiscount,clearSupplierDiscount,supplierDiscountAction,verifySupplierDiscount,supplierDiscountDebtChanged,SUPPLIER_DISCOUNT_RPC} from '../supplier-discount.js';
import {deviceRequestScope} from '../device-write-gate.js';
import {createOperation} from '../operations.js';
const id='11111111-1111-4111-8111-111111111111',person=()=>({id:'s',project_id:'pr',name:'مورد <img>',calculated_debt:10.3,active:true});
const draft=()=>supplierDiscountDraft('pr',person(),.1,'  تسوية دين  '),journal=()=>supplierDiscountJournal(draft(),id);
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};};

test('supplier discount captures only non-cash RPC intent, frozen source-isolated metadata and exact before/after',()=>{
 const source=person(),before=JSON.stringify(source),value=supplierDiscountDraft('pr',source,'0.100','  تسوية دين  ');
 assert.deepEqual(value,{debtBefore:10.3,supplierName:'مورد <img>',payload:{p_project_id:'pr',p_supplier_id:'s',p_amount:.1,p_reason:'تسوية دين'}});
 assert.equal(supplierDiscountAfter(.3,.1),.2);assert.equal(supplierDiscountAfter(.3,''),.3);assert.equal(supplierDiscountAfter(.3,.4),0);
 assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.payload));assert.equal(JSON.stringify(source),before);assert.equal(Object.isFrozen(source),false);
 assert.ok(!JSON.stringify(value.payload).includes('account'));assert.ok(!JSON.stringify(value.payload).includes('sources'));
});
test('discount strictly requires positive canonical cents within debt and the server monetary range',()=>{
 for(const amount of [0,-1,.001,.30000000000000004,NaN,Infinity,true,null,'',1e12])assert.throws(()=>supplierDiscountDraft('pr',person(),amount,'تسوية دين'));
 assert.equal(supplierDiscountDraft('pr',{...person(),calculated_debt:.01},'1e-2','تسوية').payload.p_amount,.01);
 assert.throws(()=>supplierDiscountDraft('pr',{...person(),calculated_debt:.299},.3,'تسوية'));
 for(const changes of [{active:false},{calculated_debt:0},{calculated_debt:-1},{calculated_debt:null},{calculated_debt:NaN},{project_id:'other'},{id:''}])assert.throws(()=>supplierDiscountDraft('pr',{...person(),...changes},.1,'تسوية دين'));
});
test('reason matches native trimmed UTF-16 length and backend Unicode minimum without coercing objects',()=>{
 for(const reason of ['',null,{},'  أ ب'.slice(0,3),'  ab  ','a'.repeat(501),'😀a'])assert.throws(()=>supplierDiscountDraft('pr',person(),.1,reason));
 assert.equal(supplierDiscountDraft('pr',person(),.1,'  abc  ').payload.p_reason,'abc');
 assert.equal(supplierDiscountDraft('pr',person(),.1,'😀'.repeat(250)).payload.p_reason.length,500);
 assert.throws(()=>supplierDiscountDraft('pr',person(),.1,'😀'.repeat(251)));
});
test('journal round trip is fully frozen and validates its original scope, debt, UUID and exact payload contract',()=>{
 const value=journal(),restored=validateSupplierDiscountJournal(JSON.parse(JSON.stringify(value)),'pr');assert.deepEqual(restored,value);assert.ok(Object.isFrozen(restored));assert.ok(Object.isFrozen(restored.payload));
 for(const change of [{version:2},{requestId:'bad'},{debtBefore:.01},{debtBefore:'10.3'},{supplierName:null},{other:1}])assert.throws(()=>validateSupplierDiscountJournal({...value,...change},'pr'));
 for(const change of [{p_project_id:'other'},{p_supplier_id:''},{p_amount:'0.1'},{p_amount:.111},{p_reason:' تسوية دين '},{p_account_id:'cash'}])assert.throws(()=>validateSupplierDiscountJournal({...value,payload:{...value.payload,...change}},'pr'));
 assert.throws(()=>validateSupplierDiscountJournal(value,'other'));assert.throws(()=>supplierDiscountJournal(draft(),'bad'));
});
test('one encoded project journal never overwrites an existing or corrupt operation',()=>{
 const storage=memory(),value=journal();assert.equal(readSupplierDiscount(storage,'pr'),null);persistSupplierDiscount(storage,'pr',value);assert.deepEqual(readSupplierDiscount(storage,'pr'),value);
 assert.throws(()=>persistSupplierDiscount(storage,'pr',value));assert.equal(storage.data.size,1);assert.notEqual(supplierDiscountKey('p/r'),supplierDiscountKey('p%2Fr'));
 storage.setItem(supplierDiscountKey('pr'),'{bad');assert.throws(()=>readSupplierDiscount(storage,'pr'));assert.throws(()=>persistSupplierDiscount(storage,'pr',value));assert.equal(storage.getItem(supplierDiscountKey('pr')),'{bad');
});
test('cleanup compares the complete original operation and cannot erase a newer request',()=>{
 const storage=memory(),value=journal();persistSupplierDiscount(storage,'pr',value);
 const other=supplierDiscountJournal(draft(),'22222222-2222-4222-8222-222222222222');storage.setItem(supplierDiscountKey('pr'),JSON.stringify(other));assert.throws(()=>clearSupplierDiscount(storage,'pr',value));assert.deepEqual(readSupplierDiscount(storage,'pr'),other);
 clearSupplierDiscount(storage,'pr',other);assert.equal(readSupplierDiscount(storage,'pr'),null);assert.throws(()=>clearSupplierDiscount(storage,'pr',other));
});
test('unavailable, failing and dishonest storage cannot authorize a new request or claim successful cleanup',()=>{
 const value=journal();assert.throws(()=>readSupplierDiscount(null,'pr'));assert.throws(()=>persistSupplierDiscount(null,'pr',value));
 assert.throws(()=>persistSupplierDiscount({getItem:()=>null,setItem:()=>{}},'pr',value));
 const storage=memory();persistSupplierDiscount(storage,'pr',value);storage.removeItem=()=>{};assert.throws(()=>clearSupplierDiscount(storage,'pr',value));
 assert.throws(()=>readSupplierDiscount({getItem:()=>{throw Error('blocked');}},'pr'));
});
test('matching original journal can recover after settlement or archive without accepting a fresh discount',()=>{
 const storage=memory();persistSupplierDiscount(storage,'pr',journal());
 assert.deepEqual(supplierDiscountAction(storage,'pr',{...person(),active:false,calculated_debt:0}),{retry:true,blocked:false,enabled:true});
 assert.equal(supplierDiscountAction(storage,'pr',{...person(),id:'other',active:false,calculated_debt:0}).enabled,false);
 const restored=readSupplierDiscount(storage,'pr');assert.equal(restored.debtBefore,10.3);assert.equal(restored.payload.p_amount,.1);
 storage.setItem(supplierDiscountKey('pr'),'{bad');assert.deepEqual(supplierDiscountAction(storage,'pr',person()),{retry:false,blocked:true,enabled:true});
});
test('fresh acknowledgement reconciles authoritative server debt, not a possibly stale preview balance',()=>{
 const payload=draft().payload;verifySupplierDiscount({id:'discount',amount:'0.10',debt_before:4.3,remaining_debt:4.2,replayed:false},payload);
 verifySupplierDiscount({id:'discount',amount:.1,replayed:true},payload);
 for(const value of [null,{id:'x',amount:.1},{id:'x',amount:.1,replayed:false},{id:'x',amount:null,replayed:true},{id:'x',amount:.11,replayed:true},{id:'x',amount:.1,replayed:false,debt_before:4.3,remaining_debt:4.21},{id:'x',amount:.1,replayed:true,project_id:'other'}])assert.throws(()=>verifySupplierDiscount(value,payload));
});
test('only an exact scoped atomic debt-change HTTP rejection is safe to discard',()=>{
 assert.equal(supplierDiscountDebtChanged({status:400,message:'DISCOUNT_EXCEEDS_SUPPLIER_DEBT'}),true);
 for(const error of [{message:'DISCOUNT_EXCEEDS_SUPPLIER_DEBT'},{status:500,message:'DISCOUNT_EXCEEDS_SUPPLIER_DEBT'},{status:400,message:'request timed out: DISCOUNT_EXCEEDS_SUPPLIER_DEBT'},{status:403,message:'OWNER_REQUIRED'}])assert.equal(supplierDiscountDebtChanged(error),false);
});
test('discount dispatch has one immutable UUID and never opts out of the project write gate',async()=>{
 const captured=journal(),payload={...captured.payload},operation=createOperation(SUPPLIER_DISCOUNT_RPC,payload,captured.requestId),calls=[];
 payload.p_amount=9;
 const api={rpc:async(name,args)=>{calls.push({name,args});if(calls.length===1)throw Error('lost');return {id:'x',amount:.1,replayed:true};}};
 await assert.rejects(operation.run(api));await operation.run(api);await operation.run(api);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].args.p_amount,.1);assert.equal(calls[0].args.p_request_id,id);
 assert.deepEqual(deviceRequestScope('/rest/v1/rpc/'+SUPPLIER_DISCOUNT_RPC,{method:'POST',body:JSON.stringify(calls[0].args)}),{kind:'write',projectId:'pr'});
});
