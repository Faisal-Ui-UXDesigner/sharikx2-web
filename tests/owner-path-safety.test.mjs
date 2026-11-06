import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerSaleSubtotal,ownerSaleTotal} from '../owner-path-money.js';
import {readOwnerJournal,writeOwnerJournal} from '../owner-path-storage.js';
import {createOwnerPath,createOpeningMoney,createOpeningStock,createOpeningProject} from '../owner-path-store.js';
import {projectAccountingVersion} from '../project-session.js';

const project='11111111-1111-4111-8111-111111111111';
function storage(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function fixture(store=storage()){
 const calls=[],state={project_id:project,accounting_version:2,revision:1};
 const api={config:{url:'https://fixture.invalid'},request:async()=>[],rpc:async(name,p)=>{
  calls.push({name,p:structuredClone(p)});
  if(p.p_action==='state')return state;
  return {...state,status:'confirmed',request_id:p.p_payload.request_id,action:p.p_action};
 }};
 return {api,calls,store,flow:createOwnerPath({api,project,device:'web',storage:store})};
}
test('owner sale matches native per-line BigDecimal HALF_UP, not binary Math.round or rounding the sum',()=>{
 assert.equal(ownerSaleSubtotal([{quantity:'1.005',unit_sale_price:'1.00'}]),1.01);
 assert.equal(ownerSaleSubtotal([{quantity:'1.005',unit_sale_price:'1.00'},{quantity:'1.005',unit_sale_price:'1.00'}]),2.02);
 assert.equal(ownerSaleSubtotal([{quantity:0.001,unit_sale_price:5},{quantity:0.001,unit_sale_price:5}]),0.02);
 assert.equal(ownerSaleTotal(0.30,'0.10'),0.20);
 assert.equal(ownerSaleTotal(1.01,'1.01'),0);
 assert.throws(()=>ownerSaleTotal(1,'1.01'));assert.throws(()=>ownerSaleSubtotal([{quantity:'bad',unit_sale_price:1}]));
});
test('exact journal verification rejects no-op or changed writes even with an older cached value',async()=>{
 const f=fixture();await f.flow.load();const before=f.store.getItem(`owner-path-v2:${project}`);
 f.store.setItem=()=>{};
 await assert.rejects(f.flow.command('sale',{items:[]}),/تأكيد حفظ/);
 assert.equal(f.calls.length,1);assert.equal(f.store.getItem(`owner-path-v2:${project}`),before);
});
test('corruption and blocked reads are not treated as an empty journal',()=>{
 for(const raw of ['{bad','null','[]','12','"x"']){const s=storage();s.map.set('k',raw);assert.throws(()=>readOwnerJournal(s,'k'),/قراءة/);}
 assert.throws(()=>readOwnerJournal({getItem(){throw Error('blocked');}},'k'),/قراءة/);
 const s=storage();writeOwnerJournal(s,'k',{pending:{id:'a'}});assert.deepEqual(readOwnerJournal(s,'k'),{pending:{id:'a'}});
 assert.throws(()=>writeOwnerJournal({...s,setItem(){throw Error('quota');}},'k',{pending:{id:'b'}}),/تأكيد حفظ/);
 assert.throws(()=>writeOwnerJournal({...s,setItem(k){s.map.set(k,'{}');}},'k',{pending:{id:'b'}}),/تأكيد حفظ/);
});
test('lost reply retains the original request and immutable payload across restoration',async()=>{
 const f=fixture();await f.flow.load();const values={items:[{quantity:'1.005',unit_sale_price:'1.00'}]};
 const original=f.api.rpc;let lost=true;
 f.api.rpc=async(name,p)=>{const reply=await original(name,p);if(p.p_action==='sale'&&lost)throw Error('lost');return reply;};
 await assert.rejects(f.flow.command('sale',values),/lost/);values.items[0].quantity='99';
 const first=f.calls.at(-1).p.p_payload;await assert.rejects(f.flow.command('sale',values),/السابق/);
 lost=false;const restored=createOwnerPath({api:f.api,project,device:'web',storage:f.store});await restored.retry();
 assert.deepEqual(f.calls.at(-1).p.p_payload,first);assert.equal(first.values.items[0].quantity,'1.005');
});
test('opening money and stock cannot prepare when journal write is not retained',async()=>{
 for(const kind of ['money','stock']){
  const s=storage(),calls=[];const state={project_id:project,accounting_version:2,revision:1,source_token:'s',accounts:[],products:[],opening_locked:false};
  const api={rpc:async(name,p)=>{calls.push({name,p});return state;}};
  const flow=(kind==='money'?createOpeningMoney:createOpeningStock)({api,project,device:'web',storage:s});await flow.load();
  s.setItem=()=>{};await assert.rejects(flow.prepare(['product']),/تأكيد حفظ/);assert.equal(calls.length,1);
 }
});
test('new shop creation never sends an RPC with an unconfirmed or corrupt journal',async()=>{
 const s=storage();s.setItem=()=>{};let calls=0;
 // Identity is pre-seeded so this case isolates creation-journal persistence.
 s.map.set('sharikx2-device:v1:'+encodeURIComponent('https://fixture.invalid'),'web-v1-22222222-2222-4222-8222-222222222222');
 const api={config:{url:'https://fixture.invalid'},rpc:async()=>{calls++;}};
 const flow=createOpeningProject({api,storage:s});await assert.rejects(flow.create('محل','0591234567','1234'),/تأكيد حفظ/);assert.equal(calls,0);
 const key='opening-creation-v2:web-v1-22222222-2222-4222-8222-222222222222';s.map.set(key,'{broken');
 await assert.rejects(flow.create('محل','0591234567','1234'),/قراءة سجل/);assert.equal(calls,0);
});
test('accounting routing requires explicit project/version/enabled metadata and fails closed on read errors',async()=>{
 for(const version of [1,2])assert.equal(await projectAccountingVersion({rpc:async()=>({project_id:project,accounting_version:version,enabled:false})},project,'owner'),version);
 for(const value of [null,{}, {project_id:'foreign',accounting_version:1,enabled:true},{project_id:project,accounting_version:3,enabled:true},{project_id:project,accounting_version:'1',enabled:true}]){
  await assert.rejects(projectAccountingVersion({rpc:async()=>value},project,'owner'),/لن يُفتح النظام القديم/);
 }
 await assert.rejects(projectAccountingVersion({rpc:async()=>{throw Error('offline');}},project,'owner'),/لن يُفتح النظام القديم/);
 assert.equal(await projectAccountingVersion({rpc:()=>{throw Error('viewer must not read owner metadata');}},project,'viewer'),null);
});
