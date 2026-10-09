import test from 'node:test';import assert from 'node:assert/strict';
import {supplierChanges,supplierUpdateResult,openSupplierEditor} from '../supplier-mutation.js';import {Api} from '../api.js';
const changes={name:'مورد',phone:'0591234567'},row={id:'supplier',project_id:'project',...changes};
test('supplier updates capture only canonical name/phone or explicit archival fields',()=>{
 const source={name:' مورد ',phone:'059 123-4567'},captured=supplierChanges(source);source.name='آخر';assert.deepEqual(captured,changes);assert.equal(Object.isFrozen(captured),true);assert.deepEqual(supplierChanges({active:false}),{active:false});
 for(const value of [null,[],{active:true},{name:'مورد'},{...changes,opening_debt:100}])assert.throws(()=>supplierChanges(value));
});
test('supplier acknowledgement validates all captured fields and exact scoped single row',()=>{
 assert.deepEqual(supplierUpdateResult([row],'project','supplier',changes),row);
 for(const rows of [null,[],[row,row],[{...row,id:'other'}],[{...row,project_id:'other'}],[{...row,name:'آخر'}],[{...row,phone:null}]])assert.throws(()=>supplierUpdateResult(rows,'project','supplier',changes));
 assert.throws(()=>supplierUpdateResult([{...row,active:true}],'project','supplier',{active:false}));
});
test('supplier API freezes PATCH fields and checks the returned changes rather than identity alone',async()=>{
 const api=new Api({}),source={...changes};let captured,release;api.request=async(path,options)=>{captured={path,options};await new Promise(resolve=>release=resolve);return [row];};const attempt=api.updateSupplier('project','supplier',source);source.phone='0590000000';release();assert.deepEqual(await attempt,row);assert.deepEqual(JSON.parse(captured.options.body),changes);assert.match(captured.path,/project_id=eq.project/);
 api.request=async()=>[{...row,name:'آخر'}];await assert.rejects(api.updateSupplier('project','supplier',changes),/تأكيد/);
});
test('supplier archive requires an explicitly inactive acknowledgement',async()=>{
 const api=new Api({});api.request=async()=>[{...row,active:false}];assert.equal((await api.archiveSupplier('project','supplier')).active,false);api.request=async()=>[{...row,active:true}];await assert.rejects(api.archiveSupplier('project','supplier'),/تأكيد/);
});
test('supplier editor rejects viewer, stale, inactive and foreign contexts before opening',()=>{
 assert.throws(()=>openSupplierEditor({mode:'viewer'}),/للمشاهدة/);assert.equal(openSupplierEditor({isCurrent:()=>false}),undefined);assert.throws(()=>openSupplierEditor({projectId:'project',supplier:{id:'s',active:false}}),/صالحة/);assert.throws(()=>openSupplierEditor({projectId:'project',supplier:{id:'s',project_id:'other'}}),/صالحة/);
});
