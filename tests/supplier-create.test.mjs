import test from 'node:test';import assert from 'node:assert/strict';import {Api} from '../api.js';import {openSupplierCreate} from '../supplier-create-ui.js';
import {supplierCreateKey,supplierCreatePayload,supplierCreateResult,supplierCreateJournal,readSupplierCreate,saveSupplierCreate,clearSupplierCreate} from '../supplier-create.js';
const id='11111111-1111-4111-8111-111111111111',supplier={id,name:'مورد',phone:null},payload=supplierCreatePayload('project',supplier),row={...payload,active:true},journal={version:1,payload};
const memory=()=>{const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};};
test('supplier creation captures canonical optional phone, valid UUID and zero opening debt only',()=>{
 const source={...supplier,name:' مورد ',phone:'059 123-4567',opening_debt:50},saved=supplierCreatePayload('project',source);source.name='آخر';assert.equal(saved.name,'مورد');assert.equal(saved.phone,'0591234567');assert.equal(saved.opening_debt,0);assert.equal(Object.isFrozen(saved),true);assert.equal(payload.phone,null);
 for(const input of [{...supplier,id:'bad'},{...supplier,name:'م'},{...supplier,phone:'123'}])assert.throws(()=>supplierCreatePayload('project',input));assert.throws(()=>supplierCreatePayload('',supplier));
});
test('supplier creation acknowledgement verifies one exact scoped active zero-debt record',()=>{
 assert.deepEqual(supplierCreateResult([{...row,opening_debt:'0.00'}],payload),{...row,opening_debt:'0.00'});
 for(const rows of [[],null,[row,row],[{...row,id:'other'}],[{...row,project_id:'other'}],[{...row,name:'آخر'}],[{...row,phone:''}],[{...row,active:false}],[{...row,active:undefined}],[{...row,opening_debt:null}],[{...row,opening_debt:10}]])assert.throws(()=>supplierCreateResult(rows,payload));
});
test('supplier journal rejects wrong scope/version or normalized replacement data',()=>{
 assert.deepEqual(supplierCreateJournal(journal,'project'),journal);assert.equal(Object.isFrozen(supplierCreateJournal(journal,'project').payload),true);
 for(const value of [null,false,{...journal,version:2},{...journal,payload:{...payload,project_id:'other'}},{...journal,payload:{...payload,name:' مورد '}},{...journal,payload:{...payload,phone:''}},{...journal,payload:{...payload,opening_debt:5}}])assert.throws(()=>supplierCreateJournal(value,'project'));
});
test('supplier journal cannot replace or erase another captured request or corrupted storage',()=>{
 const storage=memory(),key=supplierCreateKey('project');assert.equal(readSupplierCreate(storage,'project'),null);saveSupplierCreate(storage,'project',journal);saveSupplierCreate(storage,'project',journal);const before=storage.getItem(key),other={version:1,payload:{...payload,id:'22222222-2222-4222-8222-222222222222'}};
 assert.throws(()=>saveSupplierCreate(storage,'project',other));assert.throws(()=>clearSupplierCreate(storage,'project',other));assert.equal(storage.getItem(key),before);clearSupplierCreate(storage,'project',journal);assert.equal(storage.getItem(key),null);
 for(const raw of ['{bad','false','null']){storage.setItem(key,raw);assert.throws(()=>readSupplierCreate(storage,'project'));assert.throws(()=>clearSupplierCreate(storage,'project',journal));assert.equal(storage.getItem(key),raw);}
});
test('missing supplier storage and failed writes/cleanup propagate instead of claiming persistence',()=>{
 assert.throws(()=>readSupplierCreate(null,'project'));assert.throws(()=>saveSupplierCreate({getItem:()=>null,setItem:()=>{throw Error('write');}},'project',journal),/write/);assert.throws(()=>clearSupplierCreate({getItem:()=>JSON.stringify(journal),removeItem:()=>{throw Error('cleanup');}},'project',journal),/cleanup/);
});
test('supplier API freezes captured POST fields and verifies its returned representation',async()=>{
 const api=new Api({}),source={...supplier};let captured,release;api.request=async(path,options)=>{captured={path,options};await new Promise(resolve=>release=resolve);return [row];};const attempt=api.createSupplier('project',source);source.phone='0590000000';release();assert.deepEqual(await attempt,row);assert.equal(captured.path,'/rest/v1/sharikx2_suppliers');assert.equal(captured.options.headers.Prefer,'return=representation');assert.deepEqual(JSON.parse(captured.options.body),payload);
});
test('supplier UUID conflict recovery is scoped and never accepts a matching name/phone alone',async()=>{
 const api=new Api({});api.request=async()=>{throw Object.assign(Error('conflict'),{status:409});};let lookup;api.rows=async(...args)=>{lookup=args;return [row];};assert.deepEqual(await api.createSupplier('project',supplier),row);assert.deepEqual(lookup,['suppliers','project','*',0,{id:`eq.${id}`}]);
 for(const rows of [[],[{...row,id:'other'}],[{...row,project_id:'other'}],[{...row,opening_debt:5}]]){api.rows=async()=>rows;await assert.rejects(api.createSupplier('project',supplier),/تأكيد/);}
});
test('empty or mismatched supplier POST responses do not report success or retry automatically',async()=>{
 const api=new Api({});let calls=0;api.request=async()=>{calls++;return [];};await assert.rejects(api.createSupplier('project',supplier),/تأكيد/);assert.equal(calls,1);
});
test('supplier creation blocks viewers and stale entries before DOM access',()=>{
 assert.throws(()=>openSupplierCreate({mode:'viewer'}),/للمشاهدة/);assert.equal(openSupplierCreate({mode:'owner',isCurrent:()=>false}),undefined);
});
