import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerAccountManager,accountSnapshot,transferValues} from '../owner-account-manager.js';
const projectId='11111111-1111-4111-8111-111111111111',cash='22222222-2222-4222-8222-222222222222',bank='33333333-3333-4333-8333-333333333333';
function fixture(){
 const rows=[{id:cash,project_id:projectId,name:'كاش',active:true,opening_balance:'12.34'},{id:bank,project_id:projectId,name:'بنك',active:true,opening_balance:'0'}],balances=[{id:cash,balance:'100.10'},{id:bank,balance:'0'}],values=new Map(),calls=[],receipts=new Map();let lose=false,applied=0,guards=0;
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const api={config:{transfers:true},allRows:async()=>structuredClone(rows),summary:async()=>({accounts:structuredClone(balances)}),rpc:async(name,p)=>{
  calls.push({name,p:structuredClone(p)});
  if(name==='update_sharikx2_account_v2'){assert.equal(p.p_opening_balance,'12.34');rows[0].name=p.p_name;return {...rows[0]};}
  assert.equal(name,'transfer_sharikx2_account_web_v1');assert.ok(values.size,'Persist before dispatch');
  if(receipts.has(p.p_request_id))return receipts.get(p.p_request_id);
  applied++;const result={id:crypto.randomUUID(),amount:p.p_amount};receipts.set(p.p_request_id,result);
  if(lose){lose=false;throw Error('lost response');}return result;
 }};
 const create=()=>createOwnerAccountManager({api,projectId,storage,beforeWrite:async()=>{guards++;}});
 return {api,storage,rows,balances,calls,values,create,setLose:()=>lose=true,applied:()=>applied,guards:()=>guards};
}
test('rename preserves exact opening amount, rereads metadata, and coalesces duplicate submits',async()=>{
 const f=fixture(),manager=f.create(),a=manager.rename(cash,'اسم جديد'),b=manager.rename(cash,'اسم جديد');assert.equal(a,b);await a;
 assert.equal(f.calls.length,1);assert.equal(f.rows[0].opening_balance,'12.34');assert.equal(f.guards(),1);
 await manager.rename(cash,'اسم جديد');assert.equal(f.calls.length,1);
});
test('transfer validates accounts, Arabic decimals, precision and actual available funds',()=>{
 const f=fixture(),accounts=accountSnapshot(projectId,f.rows,{accounts:f.balances});
 assert.equal(transferValues(projectId,accounts,{from:cash,to:bank,amount:'١٠٠.١٠'}).p_amount,'100.10');
 for(const values of [{from:cash,to:cash,amount:1},{from:'foreign',to:bank,amount:1},{from:cash,to:bank,amount:'100.11'},{from:cash,to:bank,amount:'0'},{from:cash,to:bank,amount:'1.001'}])assert.throws(()=>transferValues(projectId,accounts,values));
 assert.throws(()=>accountSnapshot(projectId,[{...f.rows[0],project_id:'foreign'}],{accounts:f.balances}));
});
test('lost transfer survives controller recreation and returns the same receipt without a second transfer',async()=>{
 const f=fixture();f.setLose();const input={from:cash,to:bank,amount:'12.34',note:'ملاحظة'};
 await assert.rejects(f.create().transfer(input),/lost/);const saved=f.create().pending();assert.ok(saved);
 f.balances[0].balance='0';await f.create().transfer({...input,amount:'999'});
 assert.equal(f.applied(),1);assert.equal(f.calls[0].p.p_request_id,f.calls[1].p.p_request_id);assert.deepEqual(f.calls[0].p,f.calls[1].p);assert.equal(f.values.size,0);
});
test('blocked journal, invalid journal, disabled feature and lost device control dispatch no transfer',async()=>{
 const input={from:cash,to:bank,amount:'1'};
 for(const kind of ['blocked','corrupt','disabled','device']){
  const f=fixture();let manager;
  if(kind==='blocked')f.storage.setItem=()=>{throw Error('quota');};
  if(kind==='corrupt')f.values.set(`sharikx2-pending-transfer:${projectId}`,'bad json');
  if(kind==='disabled')f.api.config.transfers=false;
  manager=kind==='device'?createOwnerAccountManager({api:f.api,projectId,storage:f.storage,beforeWrite:async()=>{throw Error('DEVICE_CONTROL_REQUIRED');}}):f.create();
  await assert.rejects(manager.transfer(input));assert.equal(f.calls.length,0);
 }
});
test('definite rejection clears the unexecuted request while unknown replies stay recoverable',async()=>{
 const f=fixture(),input={from:cash,to:bank,amount:'1'};
 f.api.rpc=async()=>{const error=Error('INSUFFICIENT_ACCOUNT_BALANCE');error.status=400;throw error;};
 await assert.rejects(f.create().transfer(input));assert.equal(f.values.size,0);
 f.api.rpc=async()=>({id:crypto.randomUUID(),amount:'2'});await assert.rejects(f.create().transfer(input),/غير مؤكدة/);assert.ok(f.create().pending());
});

test('authorization rejection after an uncertain transfer preserves its receipt identity',async()=>{
 const f=fixture();f.setLose();await assert.rejects(f.create().transfer({from:cash,to:bank,amount:'1'}));const saved=f.create().pending();
 f.api.rpc=async()=>{const error=Error('forbidden');error.status=403;throw error;};
 await assert.rejects(f.create().transfer({}));assert.equal(f.create().pending().requestId,saved.requestId);
});
test('lost rename acknowledgement is confirmed by reading without a second update',async()=>{
 const f=fixture(),send=f.api.rpc;f.api.rpc=async(name,p)=>{await send(name,p);throw Error('lost acknowledgement');};
 await f.create().rename(cash,'اسم محفوظ');assert.equal(f.calls.length,1);assert.equal(f.rows[0].opening_balance,'12.34');
});
