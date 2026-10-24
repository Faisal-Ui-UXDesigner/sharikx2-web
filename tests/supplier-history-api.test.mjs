import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {deviceRequestScope} from '../device-write-gate.js';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
function environment(){
 const api=new Api({url:'https://synthetic.invalid'}),history=supplierHistoryFixture(),calls=[];
 api.setDeviceContext({projectId:'pr',mode:'viewer'});api.session=async()=> 'synthetic-token';
 api.fetch=async(path,options)=>{
  calls.push({path,options});if(path.endsWith('/get_sharikx2_supplier_history_v1'))return history;
  const query=new URL(path,'https://synthetic.invalid').searchParams;
  assert.equal(query.get('project_id'),'eq.pr');assert.equal(query.get('supplier_id'),'eq.s');assert.match(query.get('select'),/credit_applications/);
  return history.purchases.map(row=>({id:row.id,payments:row.payments,credit_applications:row.credit_applications}));
 };
 return {api,history,calls};
}
test('native supplier ledger RPC and complete initial sources stay read-only even for viewer',async()=>{
 const e=environment(),before=JSON.stringify(e.history),result=await e.api.supplierHistory('pr','s');
 assert.equal(e.calls.length,2);assert.deepEqual(JSON.parse(e.calls[0].options.body),{p_project_id:'pr',p_supplier_id:'s'});
 assert.equal(deviceRequestScope(e.calls[0].path,e.calls[0].options).kind,'read');assert.ok(!e.calls.some(row=>/claim_|save_|pay_/.test(row.path)));
 assert.equal(JSON.stringify(e.history),before);assert.notEqual(result,e.history);assert.notEqual(result.purchases[0],e.history.purchases[0]);
});
test('initial source pages are complete, and invoice set drift never mixes histories',async()=>{
 for(const changes of [rows=>rows.slice(1),rows=>[...rows,rows[0]],rows=>rows.map((row,index)=>index?row:{...row,id:'new'}),rows=>rows.map((row,index)=>index?row:{...row,payments:null})]){
  const e=environment(),fetch=e.api.fetch;e.api.fetch=async(path,options)=>{const value=await fetch(path,options);return path.includes('/sharikx2_purchases?')?changes(value):value;};await assert.rejects(e.api.supplierHistory('pr','s'),/تغير/);
 }
});
test('wrong supplier or project snapshot fails before source reads',async()=>{
 for(const change of [s=>s.supplier.id='other',s=>s.supplier.project_id='other',s=>s.purchases=null]){const e=environment();change(e.history);await assert.rejects(e.api.supplierHistory('pr','s'));assert.equal(e.calls.length,1);}
});
test('closed session during either supplier ledger read cannot return a usable snapshot',async()=>{
 for(const phase of ['rpc','sources']){
  const e=environment(),fetch=e.api.fetch;e.api.fetch=async(path,options)=>{const value=await fetch(path,options);if((phase==='rpc')===path.endsWith('/get_sharikx2_supplier_history_v1'))e.api.clearSession();return value;};
  await assert.rejects(e.api.supplierHistory('pr','s'),/SESSION_CLOSED/);
 }
});
test('unavailable history RPC fails explicitly without reconstructing debt from separately timed reads',async()=>{
 const e=environment();e.api.fetch=async()=>{throw Object.assign(new Error('history unavailable'),{status:404});};await assert.rejects(e.api.supplierHistory('pr','s'),/unavailable/);
});
