import test from 'node:test';import assert from 'node:assert/strict';
import {Api} from '../api.js';import {deviceRequestScope} from '../device-write-gate.js';import {deviceIdentityKey} from '../device-control.js';import {createDeviceRegistration,deviceRegistrationKey} from '../device-registration.js';
const id='project',device='web-v1-11111111-1111-4111-8111-111111111111',url='https://synthetic.test';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
const source=()=>({project_id:id,active_device_id:device,active_device_name:'Web',generation:3,last_seen_at:'2026-10-12T12:00:00Z',requested_device_id:null,requested_device_name:null,requested_at:null});
const payload=(active=true,generation=3)=>({is_active:active,active_device_name:'Web',generation,last_seen_at:'2026-10-12T12:00:00Z',requested_device_id:'',requested_device_name:'',requested_at:null});
function env(mode='owner'){
 const api=new Api({url}),storage=memory(),calls=[];storage.setItem(deviceIdentityKey(url),device);api.setDeviceContext({projectId:id,mode,identityStorage:storage});api.session=async()=> 'synthetic-token';
 let row=source();api.fetch=async(path,options)=>{calls.push({path,options});if(path.startsWith('/rest/v1/sharikx2_device_control?'))return row?[structuredClone(row)]:[];if(path.endsWith('/claim_sharikx2_device_control_v1'))return payload();return {revision:5};};
 return {api,storage,calls,row:()=>row,setRow:value=>row=value};
}
test('explicit RPC read allowlist cannot be bypassed with new get-prefixed mutations',()=>{
 assert.equal(deviceRequestScope('/rest/v1/rpc/get_sharikx2_finance_state_v1',{method:'POST',body:'{}'}).kind,'read');
 assert.deepEqual(deviceRequestScope('/rest/v1/rpc/get_sharikx2_unknown_v1',{method:'POST',body:'{"p_project_id":"project"}'}),{kind:'write',projectId:id});
 assert.throws(()=>deviceRequestScope('/rest/v1/rpc/get_sharikx2_unknown_v1',{method:'POST',body:'{}'}));
 assert.throws(()=>deviceRequestScope('/rest/v1/rpc/save_sharikx2_finance_state_v1'));
});
test('supplier refund uses owner device renewal and cannot bypass other-device or viewer gate',async()=>{
 const body={p_project_id:id,p_supplier_id:'s',p_account_id:'a',p_amount:1,p_note:'',p_request_id:'11111111-1111-4111-8111-111111111111'},rpc='refund_sharikx2_supplier_credit_v1';
 const e=env();await e.api.rpc(rpc,body);assert.equal(e.calls.length,3);assert.deepEqual(JSON.parse(e.calls.at(-1).options.body),body);
 const other=env();other.setRow({...source(),active_device_id:'web-v1-22222222-2222-4222-8222-222222222222'});await assert.rejects(other.api.rpc(rpc,body),error=>error.notDispatched);assert.equal(other.calls.length,1);
 const viewer=env('viewer');await assert.rejects(viewer.api.rpc(rpc,body));assert.equal(viewer.calls.length,0);
});
test('purchase return uses native owner device preflight and blocks viewer before dispatch',async()=>{
 const body={p_project_id:id,p_purchase_id:'invoice',p_items:[{purchase_item_id:'line',product_id:'product',quantity_pieces:1}],p_request_id:'11111111-1111-4111-8111-111111111111'},rpc='return_sharikx2_purchase_v1';
 const e=env();await e.api.rpc(rpc,body);assert.equal(e.calls.length,3);assert.deepEqual(JSON.parse(e.calls.at(-1).options.body),body);
 const other=env();other.setRow({...source(),active_device_id:'web-v1-22222222-2222-4222-8222-222222222222'});await assert.rejects(other.api.rpc(rpc,body),error=>error.notDispatched);assert.equal(other.calls.length,1);
 const viewer=env('viewer');await assert.rejects(viewer.api.rpc(rpc,body));assert.equal(viewer.calls.length,0);
});
test('all cash capital sale purchase return expense collection transfer sharing writes share scope gate',()=>{
 for(const rpc of ['save_sharikx2_finance_state_v1','save_sharikx2_partner_cash_movement_v1','confirm_sharikx2_sale_web_v1','confirm_sharikx2_purchase_v3','return_sharikx2_sale_web_v1','confirm_sharikx2_expense_web_v1','collect_sharikx2_customer_debt_web_v1','transfer_sharikx2_account_web_v1','set_sharikx2_share_pin_v1'])assert.deepEqual(deviceRequestScope(`/rest/v1/rpc/${rpc}`,{method:'POST',body:'{"p_project_id":"project"}'}),{kind:'write',projectId:id});
});
test('direct table writes and currency require one project and prohibit project reassignment',()=>{
 assert.equal(deviceRequestScope('/rest/v1/sharikx2_products',{method:'POST',body:'{"project_id":"project"}'}).projectId,id);
 assert.equal(deviceRequestScope('/rest/v1/sharikx2_projects?id=eq.project',{method:'PATCH',body:'{"currency":"ILS"}'}).projectId,id);
 for(const path of ['/rest/v1/sharikx2_products?id=eq.item','/rest/v1/sharikx2_products?project_id=in.(a,b)','/rest/v1/sharikx2_products?project_id=eq.project&project_id=eq.other'])assert.throws(()=>deviceRequestScope(path,{method:'PATCH',body:'{}'}));
 assert.throws(()=>deviceRequestScope('/rest/v1/sharikx2_products?project_id=eq.project',{method:'PATCH',body:'{"project_id":"other"}'}));
});

test('supplier non-cash discount uses ordinary controller renewal and cannot bypass viewer or other-device protection',async()=>{
 const name='discount_sharikx2_supplier_debt_v1',body={p_project_id:id,p_supplier_id:'supplier',p_amount:.1,p_reason:'تسوية دين',p_request_id:'11111111-1111-4111-8111-111111111111'};
 const owner=env();await owner.api.rpc(name,body);assert.equal(owner.calls.length,3);assert.match(owner.calls[0].path,/device_control/);assert.match(owner.calls[1].path,/claim_sharikx2/);assert.ok(owner.calls[2].path.endsWith('/'+name));assert.deepEqual(JSON.parse(owner.calls[2].options.body),body);
 const other=env();other.setRow({...source(),active_device_id:'web-v1-22222222-2222-4222-8222-222222222222'});await assert.rejects(other.api.rpc(name,body),error=>error.notDispatched===true);assert.equal(other.calls.length,1);
 const viewer=env('viewer');await assert.rejects(viewer.api.rpc(name,body));assert.equal(viewer.calls.length,0);
});
test('matching controller reads renews native heartbeat then sends one unchanged finance write',async()=>{
 const e=env();await e.api.saveFinanceState(id,{partners:[]},4);assert.equal(e.calls.length,3);assert.match(e.calls[0].path,/device_control/);assert.match(e.calls[1].path,/claim_sharikx2/);assert.match(e.calls[2].path,/save_sharikx2/);assert.deepEqual(JSON.parse(e.calls[2].options.body),{p_project_id:id,p_state:{partners:[]},p_expected_revision:4});
});
test('other controller or no row blocks financial write but preserves finance reads',async()=>{
 for(const row of [null,{...source(),active_device_id:'android-v2-other'}]){const e=env();e.setRow(row);await assert.rejects(e.api.saveFinanceState(id,{},4),error=>error.code==='DEVICE_READ_ONLY'&&error.notDispatched);assert.equal(e.calls.length,1);await e.api.financeState(id);assert.equal(e.calls.length,2);}
});
test('viewer and foreign project writes fail before network while viewer reads stay available',async()=>{
 const e=env('viewer');await assert.rejects(e.api.saveFinanceState(id,{},4));assert.equal(e.calls.length,0);await e.api.financeState(id);assert.equal(e.calls.length,1);
 const owner=env();await assert.rejects(owner.api.saveFinanceState('other',{},4));assert.equal(owner.calls.length,0);
});
test('missing persisted identity is never generated implicitly by saving',async()=>{
 const e=env();e.storage.removeItem(deviceIdentityKey(url));await assert.rejects(e.api.saveFinanceState(id,{},4),/هوية/);assert.equal(e.calls.length,0);assert.equal(e.storage.map.size,0);
});
test('changed control generation or inactive renewal blocks the later money write',async()=>{
 for(const ack of [payload(false),payload(true,4)]){const e=env(),fetch=e.api.fetch;e.api.fetch=(path,options)=>path.endsWith('/claim_sharikx2_device_control_v1')?Promise.resolve(ack):fetch(path,options);await assert.rejects(e.api.saveFinanceState(id,{},4),/انتقل/);assert.equal(e.calls.filter(c=>c.path.includes('/save_')).length,0);}
});
test('project context or identity changes during preflight stop later dispatch',async()=>{
 for(const change of [e=>e.api.setDeviceContext({projectId:'other',mode:'owner',identityStorage:e.storage}),e=>e.storage.removeItem(deviceIdentityKey(url))]){const e=env(),fetch=e.api.fetch;e.api.fetch=async(...args)=>{const result=await fetch(...args);if(args[0].includes('device_control?'))change(e);return result;};await assert.rejects(e.api.saveFinanceState(id,{},4));assert.equal(e.calls.length,1);}
});
test('context change AFTER dispatch stays uncertain and is not marked notDispatched',async()=>{
 const e=env(),fetch=e.api.fetch;e.api.fetch=async(...args)=>{const result=await fetch(...args);if(args[0].includes('/save_'))e.api.clearDeviceContext();return result;};await assert.rejects(e.api.saveFinanceState(id,{},4),error=>error.code==='DEVICE_CONTEXT_CHANGED'&&!error.notDispatched);
});
test('device request avoids recursive gate but viewer cannot claim; onboarding remains unchanged',async()=>{
 const e=env();await e.api.rpc('request_sharikx2_device_transfer_v1',{p_project_id:id,p_device_id:device});assert.equal(e.calls.length,1);
 const viewer=env('viewer');await assert.rejects(viewer.api.rpc('claim_sharikx2_device_control_v1',{p_project_id:id}));assert.equal(viewer.calls.length,0);
 e.api.clearDeviceContext();await e.api.saveFinanceState(id,{},0);assert.equal(e.calls.length,2);e.api.clearSession();assert.equal(e.api.deviceContext,null);
});
test('product edit and archive dispatch include explicit project predicates',async()=>{
 const e=env(),fetch=e.api.fetch,paths=[];e.api.fetch=async(path,options)=>{if(path.includes('/sharikx2_products?')){paths.push(path);return [{id:'item',active:JSON.parse(options.body).active??true}];}return fetch(path,options);};
 await e.api.updateProduct('item',{name:'Name'});await e.api.archiveProduct('item');assert.equal(paths.length,2);paths.forEach(path=>assert.match(path,/project_id=eq.project/));
});
function registration(){const storage=memory();let row=null,writes=0;const api={deviceControl:async()=>row?structuredClone(row):null,claimDeviceControl:async()=>{writes++;row=source();return payload();}};const operation=()=>createDeviceRegistration({api,storage,projectId:id,deviceId:device,mode:'owner'});return {api,storage,operation,writes:()=>writes,setRow:r=>row=r};}
test('explicit first registration persists before claim and verifies independent readback',async()=>{
 const e=registration(),claim=e.api.claimDeviceControl;e.api.claimDeviceControl=async()=>{assert.ok(e.storage.getItem(deviceRegistrationKey(id)));return claim();};assert.equal((await e.operation().run()).active_device_id,device);assert.equal(e.writes(),1);assert.equal(e.storage.map.size,0);
});
test('lost first registration restores original request and never repeats claim',async()=>{
 const e=registration(),claim=e.api.claimDeviceControl;e.api.claimDeviceControl=async()=>{await claim();throw Error('lost');};await assert.rejects(e.operation().run());assert.equal(e.operation().pending(),true);await e.operation().run();assert.equal(e.writes(),1);assert.equal(e.storage.map.size,0);
});
test('existing other controller and corrupt registration cannot be displaced or overwritten',async()=>{
 const e=registration();e.setRow({...source(),active_device_id:'android-v2-other'});await assert.rejects(e.operation().run(),/نقل التحكم/);assert.equal(e.writes(),0);
 e.storage.setItem(deviceRegistrationKey(id),'broken');await assert.rejects(e.operation().run());assert.equal(e.storage.getItem(deviceRegistrationKey(id)),'broken');
});
test('concurrent registration winner and stale context keep no replay intent',async()=>{
 const e=registration();e.api.claimDeviceControl=async()=>{e.setRow({...source(),active_device_id:'android-v2-other'});return payload(false);};await assert.rejects(e.operation().run());await assert.rejects(e.operation().run());assert.equal(e.operation().pending(),true);
 const stale=registration();let active=true;stale.api.deviceControl=async()=>{active=false;return null;};await assert.rejects(stale.operation().run(()=>active));assert.equal(stale.writes(),0);assert.equal(stale.storage.map.size,0);
});
test('identity deletion during session refresh prevents financial dispatch after valid device preflight',async()=>{
 const e=env();let sessions=0;e.api.session=async()=>{if(++sessions===3)e.storage.removeItem(deviceIdentityKey(url));return 'mock';};await assert.rejects(e.api.saveFinanceState(id,{},4));assert.equal(e.calls.filter(c=>c.path.includes('/save_')).length,0);
});
test('request options are captured before async preflight and cannot switch money after review',async()=>{
 const e=env(),options={method:'POST',body:'{"p_project_id":"project","p_amount":1}'};const pending=e.api.request('/rest/v1/rpc/transfer_sharikx2_account_web_v1',options);options.body='{"p_project_id":"other","p_amount":999}';await pending;assert.equal(JSON.parse(e.calls.at(-1).options.body).p_amount,1);
});
