import test from 'node:test';import assert from 'node:assert/strict';import {paidCustomerInput,resolvePaidCustomer} from '../sale-customer-input.js';import {validateSaleDraft,saveSaleDraft,readSaleDrafts} from '../sale-drafts.js';
const rows=Array.from({length:45},(_,i)=>({id:`c${i}`,project_id:'project',active:true,name:`زبون ${i}`,phone:`059${String(i).padStart(7,'0')}`}));
test('optional paid customer follows Android empty/invalid rules without requiring a customer',()=>{
 assert.equal(paidCustomerInput('',''),null);assert.equal(paidCustomerInput(' ','---'),null);for(const [name,phone] of [['أ','0590000000'],['زبون',''],['','0590000000'],['زبون','123']])assert.throws(()=>paidCustomerInput(name,phone),/الحقلين/);
});
test('paid customer canonical input is immutable and retains leading-zero identity',()=>{
 const input=paidCustomerInput(' زبون ','(059) 123-4567');assert.deepEqual(input,{name:'زبون',phone:'0591234567'});assert.equal(Object.isFrozen(input),true);assert.throws(()=>input.phone='123');
});
test('paid customer resolution checks all pages before selecting a later matching phone',async()=>{
 const offsets=[],resolution=await resolvePaidCustomer({rows:async(table,project,select,offset,filters)=>{assert.equal(table,'customers');assert.equal(project,'project');assert.deepEqual(filters,{active:'eq.true'});offsets.push(offset);return rows.slice(offset,offset+20);}},'project',{name:'اسم آخر',phone:'059 0000044'});assert.deepEqual(offsets,[0,20,40]);assert.equal(resolution.kind,'existing');assert.equal(resolution.customer.id,'c44');assert.equal(resolution.customer.name,'زبون 44');assert.equal(rows[44].name,'زبون 44');
});
test('paid customer resolution never offers creation after a failed partial catalog read',async()=>{
 await assert.rejects(resolvePaidCustomer({rows:async(table,project,select,offset)=>{if(offset===20)throw Error('network');return rows.slice(0,20);}},'project',{name:'جديد',phone:'0599999999'}),/network/);
});
test('paid customer keeps first normalized phone match and existing name, otherwise proposes creation only',async()=>{
 const matches=[{id:'first',name:'الاسم الأصلي',phone:'(059) 123-4567'},{id:'second',name:'آخر',phone:'0591234567'}];const api={rows:async()=>matches};assert.equal((await resolvePaidCustomer(api,'project',{name:'لا يستبدل',phone:'0591234567'})).customer.id,'first');const resolution=await resolvePaidCustomer(api,'project',{name:'جديد',phone:'0590000000'});assert.equal(resolution.kind,'create');assert.equal(resolution.customer,null);assert.deepEqual(resolution.input,{name:'جديد',phone:'0590000000'});
});
test('empty paid input performs no reads and stale contexts cannot resolve customer identity',async()=>{
 let calls=0,current=true;const api={rows:async()=>{calls++;current=false;return rows.slice(0,20);}};assert.equal((await resolvePaidCustomer(api,'project',{name:'',phone:''})).kind,'none');assert.equal(calls,0);await assert.rejects(resolvePaidCustomer(api,'project',{name:'زبون',phone:'0590000000'},()=>false),/CLOSED/);await assert.rejects(resolvePaidCustomer(api,'project',{name:'زبون',phone:'0590000000'},()=>current),/CLOSED/);assert.equal(calls,1);
});
const draft={version:1,id:'11111111-1111-4111-8111-111111111111',projectId:'project',cart:[{id:'p',name:'صنف',quantity:1,stock:5,price:3,cost:1}],asDebt:false,customer:null,accountId:'cash'};
test('unsent carts preserve partial/raw typed customer intent without creating an identity or changing legacy drafts',()=>{
 assert.deepEqual(validateSaleDraft(draft,'project'),draft);let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};saveSaleDraft(storage,'project',{...draft,customerInput:{name:'أ',phone:'059 '}});assert.deepEqual(readSaleDrafts(storage,'project')[0].customerInput,{name:'أ',phone:'059 '});assert.equal(readSaleDrafts(storage,'project')[0].customer,null);
});
test('unsent carts reject malformed or excessive typed customer metadata',()=>{
 for(const input of [[],{name:'زبون'},{name:'زبون',phone:null},{name:'x'.repeat(121),phone:''},{name:'زبون',phone:'1'.repeat(65)},{name:'زبون',phone:'',extra:1}])assert.throws(()=>validateSaleDraft({...draft,customerInput:input},'project'));
});
