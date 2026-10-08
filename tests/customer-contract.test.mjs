import test from 'node:test';import assert from 'node:assert/strict';
import {customerInput,customerCreatePayload,requireCreatedCustomer,customerJournal,clearCustomerJournal} from '../customer-contract.js';
import {Api} from '../api.js';import {openCustomer} from '../customer.js';
const id='11111111-1111-4111-8111-111111111111',customer={id,name:'زبون',phone:'0590000000'},payload=customerCreatePayload('project',customer),row={...payload,active:true};
test('customer create requires Android two-letter name and retains exact leading-zero phone',()=>{
 assert.deepEqual(customerInput(' زبون ',' 0590000000 ',id),customer);
 for(const [name,phone] of [['أ','0590000000'],['','0590000000'],['زبون','059 0000000'],['زبون','123']])assert.throws(()=>customerInput(name,phone,id));
 assert.throws(()=>customerInput('زبون','0590000000',''));
});
test('customer payload freezes the captured zero-opening-debt identity without source mutation',()=>{
 const source={...customer,opening_debt:500,project_id:'other'},captured=customerCreatePayload('project',source);source.name='متغير';
 assert.equal(Object.isFrozen(captured),true);assert.deepEqual(captured,payload);assert.throws(()=>customerCreatePayload('',customer));
});
test('customer create acknowledgements must match exactly one scoped active zero-debt record',()=>{
 assert.deepEqual(requireCreatedCustomer([{...row,opening_debt:'0.00'}],payload),{...row,opening_debt:'0.00'});
 for(const rows of [null,[],[row,row],[{...row,id:'other'}],[{...row,project_id:'other'}],[{...row,name:'آخر'}],[{...row,phone:'0591111111'}],[{...row,active:false}],[{...row,opening_debt:null}],[{...row,opening_debt:10}]])assert.throws(()=>requireCreatedCustomer(rows,payload));
});
test('customer journal restores a fixed UUID and rejects incompatible or cross-project requests',()=>{
 const journal={version:1,payload:{...payload}};assert.deepEqual(customerJournal(journal,'project'),journal);assert.equal(Object.isFrozen(customerJournal(journal,'project').payload),true);
 for(const value of [null,{version:2,payload}, {...journal,payload:{...payload,id:'bad'}},{...journal,payload:{...payload,name:' زبون '}},{...journal,payload:{...payload,opening_debt:5}}])assert.throws(()=>customerJournal(value,'project'));
 assert.throws(()=>customerJournal(journal,'other'));
});
test('customer API captures creation before awaiting and validates returned representation',async()=>{
 const api=new Api({}),source={...customer};let captured,release;
 api.request=async(path,options)=>{captured={path,options};await new Promise(resolve=>release=resolve);return [row];};
 const attempt=api.createCustomer('project',source);source.name='آخر';release();assert.deepEqual(await attempt,row);
 assert.deepEqual(JSON.parse(captured.options.body),payload);assert.equal(captured.options.headers.Prefer,'return=representation');
 api.request=async()=>[];await assert.rejects(api.createCustomer('project',customer),/تأكيد/);
});
test('customer conflict recovery verifies the same ID and project, never a matching phone alone',async()=>{
 const api=new Api({});api.request=async()=>{throw Object.assign(Error('conflict'),{status:409});};let read;
 api.rows=async(...args)=>{read=args;return [row];};assert.deepEqual(await api.createCustomer('project',customer),row);
 assert.deepEqual(read,['customers','project','*',0,{id:`eq.${id}`}]);
 for(const result of [[],[{...row,id:'other'}],[{...row,project_id:'other'}],[{...row,opening_debt:5}]]){api.rows=async()=>result;await assert.rejects(api.createCustomer('project',customer),/تأكيد/);}
});
test('customer entry rejects viewers and stale contexts before accessing browser state',()=>{
 assert.throws(()=>openCustomer({mode:'viewer'}),/للمشاهدة/);assert.equal(openCustomer({isCurrent:()=>false}),undefined);
});
test('customer completion clears only the captured journal, never a newer or corrupted request',()=>{
 let stored=JSON.stringify({version:1,payload});const storage={getItem:()=>stored,removeItem:()=>stored=null};
 clearCustomerJournal(storage,'project',payload);assert.equal(stored,null);clearCustomerJournal(storage,'project',payload);
 for(const value of ['{bad',JSON.stringify({version:1,payload:{...payload,id:'22222222-2222-4222-8222-222222222222'}})]){stored=value;assert.throws(()=>clearCustomerJournal(storage,'project',payload));assert.equal(stored,value);}
});
