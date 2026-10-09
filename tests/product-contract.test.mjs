import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {requireProductResult,productMatchesPayload} from '../product-contract.js';

const input=()=>({id:'product',project_id:'project',name:'سكر',barcode:'100',category:'مواد',base_unit:'قطعة',purchase_unit:'كرتونة',pieces_per_purchase_unit:3,default_sale_price:4,low_stock_level:6,notes:''});
const conflict=()=>Object.assign(new Error('conflict'),{status:409});

test('product mutation representations must contain exactly the requested identity',()=>{
 for(const rows of [null,{},[],[null],[{}],[{id:1}],[{id:'a'},{id:'b'}]]){
  assert.throws(()=>requireProductResult(rows,'a'),/تأكيد حفظ/);
 }
 assert.throws(()=>requireProductResult([{id:'b'}],'a'),/لا يطابق/);
 assert.equal(requireProductResult([{id:'a'}],'a').id,'a');
});

test('retry matching respects persisted scales, identity, text and active state',()=>{
 const payload=input(),row={...payload,active:true,default_sale_price:'4.00',low_stock_level:'6.000'};
 assert.equal(productMatchesPayload(row,payload),true);
 assert.equal(productMatchesPayload({...row,default_sale_price:4.33},{...payload,default_sale_price:13/3}),true);
 for(const change of [{id:'other'},{project_id:'other'},{barcode:'101'},{notes:'different'},{active:false},{default_sale_price:4.34},{low_stock_level:null}]){
  assert.equal(productMatchesPayload({...row,...change},payload),false);
 }
 assert.equal(productMatchesPayload(null,payload),false);
});

test('product POST and PATCH fail on empty or mismatched successful responses',async()=>{
 const api=new Api({});
 for(const response of [null,[],[{id:'other'}]]){
  api.request=async()=>response;
  await assert.rejects(api.createProduct(input()));
  await assert.rejects(api.updateProduct('product',{name:'new'}));
 }
 api.request=async()=>[{id:'product'}];
 assert.equal((await api.createProduct(input())).id,'product');
 assert.equal((await api.updateProduct('product',{name:'new'})).id,'product');
});

test('creation retry after lost response recovers only the matching project-scoped row',async()=>{
 const api=new Api({});let attempts=0;
 api.request=async()=>{if(++attempts===1)throw new Error('timeout');throw conflict();};
 api.rows=async(table,project,select,offset,filters)=>{
  assert.equal(table,'products');assert.equal(project,'project');assert.deepEqual(filters,{id:'eq.product'});
  return [{...input(),active:true}];
 };
 await assert.rejects(api.createProduct(input()),/timeout/);
 assert.equal((await api.createProduct(input())).id,'product');
});

test('creation conflicts never overwrite or accept another barcode, project or archived row',async()=>{
 const api=new Api({});api.request=async()=>{throw conflict();};
 for(const rows of [[],[{...input(),active:false}],[{...input(),active:true,name:'another'}],[{...input(),active:true,project_id:'other'}],[{...input(),active:true},{...input(),active:true}]]){
  api.rows=async()=>rows;
  await assert.rejects(api.createProduct(input()),/تعارض/);
 }
});

test('creation captures its payload before waiting and does not probe on authorization failures',async()=>{
 const api=new Api({}),payload=input();let release;
 api.request=()=>new Promise((_,reject)=>{release=()=>reject(conflict());});
 api.rows=async()=>[{...input(),active:true}];
 const pending=api.createProduct(payload);payload.name='changed';release();
 assert.equal((await pending).name,'سكر');
 api.request=async()=>{throw Object.assign(new Error('forbidden'),{status:403});};
 api.rows=async()=>{assert.fail('must not query on a non-conflict error');};
 await assert.rejects(api.createProduct(input()),/forbidden/);
});

test('archival requires a confirmed deactivated row of the requested identity',async()=>{
 const api=new Api({});
 for(const rows of [[{id:'product',active:true}],[{id:'other',active:false}],[{id:'product'}]]){
  api.request=async()=>rows;
  await assert.rejects(api.archiveProduct('product'));
 }
});
