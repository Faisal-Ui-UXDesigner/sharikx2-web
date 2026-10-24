import test from 'node:test';import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {readDeviceIdentity,deviceIdentityKey,deviceControlRows,deviceControlPayload,deviceControlView,createDeviceTransfer,deviceTransferKey} from '../device-control.js';
import {openDeviceControl} from '../device-control-ui.js';
const projectId='project',deviceId='web-v1-11111111-1111-4111-8111-111111111111',scope='https://example.test';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};};
const row=()=>({project_id:projectId,active_device_id:'android-v2-current',active_device_name:'Android',generation:3,last_seen_at:'2026-10-12T12:00:00Z',requested_device_id:null,requested_device_name:null,requested_at:null});
const payload=source=>({is_active:source.active_device_id===deviceId,active_device_name:source.active_device_name,generation:source.generation,last_seen_at:source.last_seen_at,requested_device_id:source.requested_device_id??'',requested_device_name:source.requested_device_name??'',requested_at:source.requested_at});
function environment(){let source=row(),writes=0,reads=0;const storage=memory(),api={deviceControl:async()=>{reads++;return deviceControlRows([structuredClone(source)],projectId);},requestDeviceTransfer:async(id,device,name)=>{assert.equal(id,projectId);writes++;source.requested_device_id=device;source.requested_device_name=name;source.requested_at='2026-10-12T12:01:00Z';return payload(source);}};const operation=()=>createDeviceTransfer({api,storage,projectId,deviceId,mode:'owner'});return {api,storage,operation,get:()=>source,writes:()=>writes,reads:()=>reads};}
test('browser identity persists before use and survives recreation without Android impersonation',()=>{
 const storage=memory();let generated=0;const options={create:true,uuid:()=>{generated++;return deviceId.slice(7);}};
 assert.equal(readDeviceIdentity(storage,scope,options),deviceId);assert.equal(readDeviceIdentity(storage,scope,options),deviceId);assert.equal(generated,1);assert.equal(storage.data.size,1);assert.equal(storage.getItem(deviceIdentityKey(scope)),deviceId);
});
test('missing corrupt blocked and unverified identity fails without in-memory fallback',()=>{
 for(const value of [null,'android-v2-current','web-v1-invalid']){const storage=memory();if(value!==null)storage.setItem(deviceIdentityKey(scope),value);assert.throws(()=>readDeviceIdentity(storage,scope));}
 assert.throws(()=>readDeviceIdentity({getItem:()=>null,setItem:()=>{}},scope,{create:true}));assert.throws(()=>readDeviceIdentity({getItem:()=>{throw Error();}},scope,{create:true}));assert.throws(()=>readDeviceIdentity(memory(),scope,{create:true,uuid:()=>''}));
});
test('scoped row validator accepts absence and rejects duplicate foreign incomplete or malformed status',()=>{
 assert.equal(deviceControlRows([],projectId),null);assert.equal(deviceControlRows([row()],projectId).generation,3);
 for(const changes of [{project_id:'foreign'},{active_device_id:'short'},{generation:0},{generation:'3'},{last_seen_at:'2026-02-30T12:00:00Z'},{requested_device_name:'orphan'},{requested_device_id:'other-device',requested_device_name:'Other',requested_at:null}])assert.throws(()=>deviceControlRows([{...row(),...changes}],projectId));assert.throws(()=>deviceControlRows([row(),row()],projectId));
});
test('payload and view distinguish pending request, other request and actual controller without permission grant',()=>{
 const source=row();assert.equal(deviceControlView(source,deviceId).active,false);source.requested_device_id=deviceId;source.requested_device_name='Web';source.requested_at='2026-10-12T12:00:00Z';assert.equal(deviceControlView(source,deviceId).requested,true);assert.equal(deviceControlPayload(payload(source)).is_active,false);
 source.active_device_id=deviceId;assert.equal(deviceControlView(source,deviceId).active,true);assert.equal(Object.hasOwn(deviceControlView(source,deviceId),'canExecute'),false);
 for(const changes of [{is_active:'true'},{generation:NaN},{requested_device_id:'short'},{requested_at:null}])assert.throws(()=>deviceControlPayload({...payload({...source,requested_device_id:'other-device'}),...changes}));
});
test('one confirmed request persists before POST then verifies authoritative row without changing active controller',async()=>{
 const env=environment(),send=env.api.requestDeviceTransfer;env.api.requestDeviceTransfer=async(...args)=>{assert.ok(env.storage.getItem(deviceTransferKey(projectId)));return send(...args);};
 const result=await env.operation().run(row());assert.equal(result.requested_device_id,deviceId);assert.equal(result.active_device_id,'android-v2-current');assert.equal(result.generation,3);assert.equal(env.writes(),1);assert.equal(env.storage.data.size,0);
});
test('duplicate submissions share the exact original preflight and request',async()=>{
 const env=environment(),op=env.operation(),first=op.run(row()),second=op.run({...row(),generation:99});assert.equal(first,second);await first;assert.equal(env.writes(),1);
});
test('lost reply recreates from original durable request and only reads, never replaces/resends',async()=>{
 const env=environment(),send=env.api.requestDeviceTransfer;env.api.requestDeviceTransfer=async(...args)=>{await send(...args);throw Error('lost');};const op=env.operation();await assert.rejects(op.run(row()));assert.equal(op.pending(),true);
 const recreated=env.operation(),result=await recreated.run(null);assert.equal(result.requested_device_id,deviceId);assert.equal(env.writes(),1);assert.equal(recreated.pending(),false);
});
test('unconfirmed read keeps original journal even when another request replaces it',async()=>{
 const env=environment();env.api.requestDeviceTransfer=async()=>{throw Error('lost');};const op=env.operation();await assert.rejects(op.run(row()));const original=env.storage.getItem(deviceTransferKey(projectId));
 env.get().requested_device_id='other-request';env.get().requested_device_name='Other';env.get().requested_at='2026-10-12T12:02:00Z';await assert.rejects(env.operation().run(null),/لم يتأكد/);assert.equal(env.storage.getItem(deviceTransferKey(projectId)),original);
});
test('readback accepts approval by original controller only with successor generation and never approves itself',async()=>{
 const env=environment(),send=env.api.requestDeviceTransfer;env.api.requestDeviceTransfer=async(...args)=>{await send(...args);env.get().active_device_id=deviceId;env.get().generation++;env.get().requested_device_id=null;env.get().requested_device_name=null;env.get().requested_at=null;throw Error('lost');};await assert.rejects(env.operation().run(row()));assert.equal((await env.operation().run(null)).active_device_id,deviceId);assert.equal(env.writes(),1);
});
test('fresh controller generation and different outstanding request fail before persistence',async()=>{
 for(const change of [s=>s.generation++,s=>s.active_device_id='android-v2-other',s=>{s.requested_device_id='other-request';s.requested_device_name='Other';s.requested_at='2026-10-12T12:00:00Z';}]){const env=environment();change(env.get());await assert.rejects(env.operation().run(row()),/تغيّرت/);assert.equal(env.writes(),0);assert.equal(env.storage.data.size,0);}
});
test('absent device row cannot trigger implicit claim; self controller or existing self request performs no POST',async()=>{
 const env=environment();await assert.rejects(env.operation().run(null),/تلقائيًا/);env.api.deviceControl=async()=>null;await assert.rejects(env.operation().run(row()));assert.equal(env.writes(),0);
 for(const active of [true,false]){const env=environment();if(active)env.get().active_device_id=deviceId;else{env.get().requested_device_id=deviceId;env.get().requested_device_name='Web';env.get().requested_at='2026-10-12T12:00:00Z';}await env.operation().run(structuredClone(env.get()));assert.equal(env.writes(),0);}
});
test('offline, changed browser identity, stale asynchronous preflight and unavailable storage prevent sending',async()=>{
 const env=environment();await assert.rejects(createDeviceTransfer({api:env.api,storage:env.storage,projectId,deviceId,mode:'owner',online:()=>false}).run(row()),/الإنترنت/);
 await assert.rejects(createDeviceTransfer({api:env.api,storage:env.storage,projectId,deviceId,mode:'owner',assertIdentity:()=>{throw Error('identity');}}).run(row()),/identity/);
 let current=true;env.api.deviceControl=async()=>{current=false;return row();};await assert.rejects(env.operation().run(row(),()=>current));assert.equal(env.writes(),0);assert.equal(env.storage.data.size,0);
 const fresh=environment();const bad={getItem:()=>null,setItem:()=>{throw Error('storage');}};await assert.rejects(createDeviceTransfer({api:fresh.api,storage:bad,projectId,deviceId,mode:'owner'}).run(row()));assert.equal(fresh.writes(),0);
});
test('corrupt foreign or changed-identity journal cannot be overwritten or dispatch',async()=>{
 for(const raw of ['bad',JSON.stringify({version:1,projectId:'other',deviceId}),JSON.stringify({version:1,projectId,deviceId:'web-v1-22222222-2222-4222-8222-222222222222'})]){const env=environment();env.storage.setItem(deviceTransferKey(projectId),raw);await assert.rejects(env.operation().run(row()));assert.equal(env.writes(),0);assert.equal(env.storage.getItem(deviceTransferKey(projectId)),raw);}
});
test('wrong acknowledgement and wrong readback retain immutable pending request',async()=>{
 for(const error of ['ack','read']){const env=environment(),send=env.api.requestDeviceTransfer;env.api.requestDeviceTransfer=async(...args)=>{const result=await send(...args);if(error==='ack')return {...result,requested_device_id:'wrong-device'};env.get().requested_device_id='wrong-device';return result;};await assert.rejects(env.operation().run(row()));assert.ok(env.storage.getItem(deviceTransferKey(projectId)));assert.equal(env.writes(),1);}
});
test('device GET and request APIs isolate scope, validate results and guard closed sessions',async()=>{
 const api=new Api({}),calls=[];api.request=async path=>{calls.push(path);return [row()];};assert.equal((await api.deviceControl(projectId)).generation,3);assert.match(calls[0],/^\/rest\/v1\/sharikx2_device_control\?project_id=eq.project&select=/);assert.match(calls[0],/limit=2$/);
 const requested={...row(),requested_device_id:deviceId,requested_device_name:'Web',requested_at:'2026-10-12T12:00:00Z'};api.rpc=async(name,body)=>{calls.push({name,body});return payload(requested);};await api.requestDeviceTransfer(projectId,deviceId,'Web');assert.deepEqual(calls[1],{name:'request_sharikx2_device_transfer_v1',body:{p_project_id:projectId,p_device_id:deviceId,p_device_name:'Web'}});
 api.request=async()=>{api.clearSession();return [row()];};await assert.rejects(api.deviceControl(projectId),/SESSION_CLOSED/);await assert.rejects(api.requestDeviceTransfer(projectId,'short','Web'));
});
test('viewer cannot create controller or access device UI before DOM or owner reads',()=>{
 assert.throws(()=>createDeviceTransfer({api:{},storage:memory(),projectId,deviceId,mode:'viewer'}));assert.throws(()=>openDeviceControl({api:{},projectId,mode:'viewer'}));
});
test('controller preflight and recovery independently reject foreign or incomplete device rows',async()=>{
 for(const value of [{...row(),project_id:'foreign'},{...row(),generation:'3'},undefined]){const env=environment();env.api.deviceControl=async()=>value;await assert.rejects(env.operation().run(row()));assert.equal(env.writes(),0);assert.equal(env.storage.data.size,0);}
 const env=environment();env.api.requestDeviceTransfer=async()=>{throw Error('lost');};await assert.rejects(env.operation().run(row()));env.api.deviceControl=async()=>({...row(),project_id:'foreign',requested_device_id:deviceId,requested_device_name:'Web',requested_at:'2026-10-12T12:00:00Z'});await assert.rejects(env.operation().run(null));assert.ok(env.storage.getItem(deviceTransferKey(projectId)));
});
