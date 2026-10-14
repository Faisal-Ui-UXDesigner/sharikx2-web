import test from 'node:test';import assert from 'node:assert/strict';
import {customerEditSource,customerEditChanges,customerUpdateResult,createCustomerEditSave} from '../customer-edit.js';import {openCustomerEditor} from '../customer-mutation.js';import {Api} from '../api.js';
const original={id:'c',project_id:'project',active:true,name:'قديم',phone:'(059) 123-4567'},changes={name:'جديد',phone:'0590000000'},updated={...original,...changes},source=customerEditSource('project',original);
test('customer edit captures raw comparison fields and canonical changes without mutating debt/source',()=>{
 const record={...original,calculated_debt:25},saved=customerEditSource('project',record),patch=customerEditChanges({name:' جديد ',phone:'059 000-0000'});record.id='other';record.phone='other';assert.equal(saved.id,'c');assert.equal(saved.expected.phone,original.phone);assert.deepEqual(patch,changes);assert.equal(Object.isFrozen(saved.expected),true);assert.equal(Object.isFrozen(patch),true);
 for(const value of [null,{id:'c',name:'قديم',active:false},{...original,project_id:'other'}])assert.throws(()=>customerEditSource('project',value));
 for(const value of [null,[],{name:'جديد'},{...changes,opening_debt:5}])assert.throws(()=>customerEditChanges(value));
});
test('customer edit acknowledgement requires a single exact active project/customer/name/phone row',()=>{
 assert.deepEqual(customerUpdateResult([updated],'project','c',changes),updated);
 for(const rows of [null,[],[updated,updated],[{...updated,id:'other'}],[{...updated,project_id:'other'}],[{...updated,name:'آخر'}],[{...updated,phone:original.phone}],[{...updated,active:false}]])assert.throws(()=>customerUpdateResult(rows,'project','c',changes));
});
test('customer PATCH captures expected raw fields and current active state with encoded project scoping',async()=>{
 const api=new Api({}),mutable={...changes},expected={...source.expected};let request,release;api.request=async(path,options)=>{request={path,options};await new Promise(resolve=>release=resolve);return [updated];};const attempt=api.updateCustomer('project','c',mutable,expected);mutable.name='آخر';expected.phone='other';release();assert.deepEqual(await attempt,updated);
 const query=new URL(request.path,'https://example.invalid').searchParams;assert.equal(query.get('project_id'),'eq.project');assert.equal(query.get('id'),'eq.c');assert.equal(query.get('name'),'eq.قديم');assert.equal(query.get('phone'),'eq.(059) 123-4567');assert.equal(query.get('active'),'eq.true');assert.deepEqual(JSON.parse(request.options.body),changes);
 api.request=async(path)=>{assert.equal(new URL(path,'https://example.invalid').searchParams.get('phone'),'is.null');return [updated];};await api.updateCustomer('project','c',changes,{name:'قديم',phone:null});
});
test('empty conditional PATCH and malformed acknowledgement never become success or automatic retries',async()=>{
 const api=new Api({});let calls=0;api.request=async()=>{calls++;return [];};await assert.rejects(api.updateCustomer('project','c',changes,source.expected),/تأكيد/);assert.equal(calls,1);assert.throws(()=>api.updateCustomer('project','c',changes,{name:'قديم'}));
});
test('customer save concurrent calls share the captured dispatch and cache verified completion',async()=>{
 let calls=0,release;const operation=createCustomerEditSave({updateCustomer:async(project,id,patch,expected)=>{calls++;assert.equal(id,'c');assert.deepEqual(patch,changes);assert.deepEqual(expected,source.expected);await new Promise(resolve=>release=resolve);return updated;}},source,changes);
 const first=operation.run(),second=operation.run();assert.equal(first,second);release();await first;await operation.run();assert.equal(calls,1);assert.equal(operation.state(),'confirmed');
});
test('lost or malformed customer save replies recover with a scoped read only',async()=>{
 for(const malformed of [false,true]){let writes=0,reads=0;const operation=createCustomerEditSave({updateCustomer:async()=>{writes++;if(!malformed)throw Error('network');return {...updated,phone:'123'};},rows:async(...args)=>{reads++;assert.deepEqual(args,['customers','project','*',0,{id:'eq.c'}]);return [updated];}},source,changes);await assert.rejects(operation.run());assert.equal(operation.state(),'uncertain');assert.deepEqual(await operation.run(),updated);await operation.run();assert.equal(writes,1);assert.equal(reads,1);}
});
test('unchanged verification enables only a later explicit conditional resend, not an automatic write',async()=>{
 let writes=0,reads=0;const operation=createCustomerEditSave({updateCustomer:async()=>{if(++writes===1)throw Error('network');return updated;},rows:async()=>{reads++;return [original];}},source,changes);await assert.rejects(operation.run());await assert.rejects(operation.run(),/إعادة إرسال/);assert.equal(writes,1);assert.equal(reads,1);assert.equal(operation.state(),'ready');await operation.run();assert.equal(writes,2);
});
test('conflicting, foreign, inactive and malformed verification reads preserve uncertainty without overwrites',async()=>{
 for(const rows of [[],null,[updated,updated],[{...updated,id:'other'}],[{...updated,project_id:'other'}],[{...updated,active:false}],[{...original,name:'متزامن'}]]){let writes=0;const operation=createCustomerEditSave({updateCustomer:async()=>{writes++;throw Error('network');},rows:async()=>rows},source,changes);await assert.rejects(operation.run());await assert.rejects(operation.run());await assert.rejects(operation.run());assert.equal(writes,1);assert.equal(operation.state(),'uncertain');}
});
test('customer editor rejects viewer and stale context before DOM and validates source identity',()=>{
 assert.throws(()=>openCustomerEditor({mode:'viewer'}),/للمشاهدة/);assert.equal(openCustomerEditor({isCurrent:()=>false}),undefined);assert.throws(()=>openCustomerEditor({projectId:'project',customer:{...original,active:false}}),/صالحة/);
});
