import test from 'node:test';import assert from 'node:assert/strict';
import {customerEditKey,validateCustomerEditJournal,readCustomerEditJournal,saveCustomerEditJournal,clearCustomerEditJournal} from '../customer-edit-journal.js';import {customerEditSource,createCustomerEditSave} from '../customer-edit.js';
const id='11111111-1111-4111-8111-111111111111',source=customerEditSource('project',{id:'c',name:'قديم',phone:'(059) 123-4567'}),changes={name:'جديد',phone:'0590000000'},journal={version:1,id,source,changes};
function memory(){const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}
test('customer edit journal freezes scoped source and canonical desired data without source mutation',()=>{
 const input=structuredClone(journal),saved=validateCustomerEditJournal(input,'project','c');input.changes.name='آخر';input.source.expected.phone='123';assert.deepEqual(saved,journal);assert.equal(Object.isFrozen(saved),true);assert.equal(Object.isFrozen(saved.source.expected),true);assert.equal(Object.isFrozen(saved.changes),true);
});
test('customer edit journal rejects wrong identities, versions and noncanonical desired fields',()=>{
 for(const value of [null,false,{...journal,version:2},{...journal,id:'bad'},{...journal,source:{...source,projectId:'other'}},{...journal,source:{...source,id:'other'}},{...journal,source:{...source,expected:{name:'قديم'}}},{...journal,changes:{...changes,name:' جديد '}},{...journal,changes:{...changes,phone:'059 0000000'}},{...journal,changes:{...changes,opening_debt:5}}])assert.throws(()=>validateCustomerEditJournal(value,'project','c'));
});
test('customer edit keys isolate encoded project/customer identities and reject missing scope',()=>{
 assert.notEqual(customerEditKey('a:b','c'),customerEditKey('a','b:c'));assert.notEqual(customerEditKey('project','c'),customerEditKey('project','other'));assert.notEqual(customerEditKey('project','c'),customerEditKey('other','c'));assert.throws(()=>customerEditKey('','c'));
});
test('journal reads reject malformed storage rather than treating it as an empty request',()=>{
 const storage=memory(),key=customerEditKey('project','c');assert.equal(readCustomerEditJournal(storage,'project','c'),null);for(const raw of ['{bad','null','false','[]']){storage.setItem(key,raw);assert.throws(()=>readCustomerEditJournal(storage,'project','c'));assert.equal(storage.getItem(key),raw);}assert.throws(()=>readCustomerEditJournal(null,'project','c'));assert.throws(()=>readCustomerEditJournal({getItem:()=>{throw Error('unavailable');}},'project','c'));
});
test('journal save is idempotent for its captured request and never replaces another or corrupted request',()=>{
 const storage=memory(),key=customerEditKey('project','c');saveCustomerEditJournal(storage,journal);saveCustomerEditJournal(storage,journal);const before=storage.getItem(key);for(const value of [{...journal,id:'22222222-2222-4222-8222-222222222222'},{...journal,changes:{...changes,name:'بديل'}}]){assert.throws(()=>saveCustomerEditJournal(storage,value));assert.equal(storage.getItem(key),before);}storage.setItem(key,'{bad');assert.throws(()=>saveCustomerEditJournal(storage,journal));assert.equal(storage.getItem(key),'{bad');
});
test('verified cleanup removes only the same complete journal, never a newer or corrupt request',()=>{
 const storage=memory(),key=customerEditKey('project','c');saveCustomerEditJournal(storage,journal);clearCustomerEditJournal(storage,journal);assert.equal(storage.getItem(key),null);clearCustomerEditJournal(storage,journal);
 for(const raw of ['{bad',JSON.stringify({...journal,id:'22222222-2222-4222-8222-222222222222'}),JSON.stringify({...journal,changes:{...changes,name:'بديل'}})]){storage.setItem(key,raw);assert.throws(()=>clearCustomerEditJournal(storage,journal));assert.equal(storage.getItem(key),raw);}
});
test('storage write and cleanup errors propagate without claiming local persistence',()=>{
 assert.throws(()=>saveCustomerEditJournal({getItem:()=>null,setItem:()=>{throw Error('write');}},journal),/write/);assert.throws(()=>clearCustomerEditJournal({getItem:()=>JSON.stringify(journal),removeItem:()=>{throw Error('cleanup');}},journal),/cleanup/);
});
test('restored confirmed customer edits perform one scoped verification read and no PATCH',async()=>{
 let writes=0,reads=0;const operation=createCustomerEditSave({updateCustomer:async()=>writes++,rows:async()=>{reads++;return [{id:'c',project_id:'project',active:true,...changes}];}},source,changes,{verifyFirst:true});assert.equal(operation.state(),'uncertain');await operation.run();await operation.run();assert.equal(writes,0);assert.equal(reads,1);
});
test('restored unchanged customer requires a separate explicit resend using the original comparison',async()=>{
 let writes=0;const operation=createCustomerEditSave({rows:async()=>[{id:'c',project_id:'project',...source.expected}],updateCustomer:async(project,id,patch,expected)=>{writes++;assert.deepEqual(expected,source.expected);return {id,project_id:project,...patch};}},source,changes,{verifyFirst:true});await assert.rejects(operation.run(),/إعادة إرسال/);assert.equal(writes,0);await operation.run();assert.equal(writes,1);
});
