import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerDeviceControl,ownerDevicePayload,pendingDeviceOperations} from '../owner-device-control.js';
import {deviceIdentityKey} from '../device-control.js';
const projectId='project',deviceId='web-v1-11111111-1111-4111-8111-111111111111',other='android-v2-other',url='https://fixture.invalid';
function fixture(){
 const values=new Map([[deviceIdentityKey(url),deviceId]]),calls=[],storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 let source={project_id:projectId,active_device_id:deviceId,active_device_name:'متصفح',generation:3,last_seen_at:'2026-11-14T10:00:00Z',requested_device_id:other,requested_device_name:'جوال جديد',requested_at:'2026-11-14T09:00:00.123456Z'};
 let lose=false;
 const api={config:{url},deviceControl:async()=>structuredClone(source),rpc:async(name,p)=>{
  calls.push({name,p});
  if(name==='reject_sharikx2_device_transfer_v1'){assert.equal(p.p_requested_device_id,source.requested_device_id);assert.equal(p.p_requested_at,source.requested_at);assert.equal(p.p_generation,source.generation);}
  if(name==='approve_sharikx2_device_transfer_v1'){source.active_device_id=source.requested_device_id;source.active_device_name=source.requested_device_name;source.generation++;}
  source.requested_device_id=null;source.requested_device_name=null;source.requested_at=null;
  if(lose){lose=false;throw Error('lost reply');}return ownerDevicePayload(source,deviceId);
 },requestDeviceTransfer:async()=>{calls.push({name:'request'});source.requested_device_id=deviceId;source.requested_device_name='متصفح SharikX2';source.requested_at='2026-11-14T11:00:00Z';if(lose){lose=false;throw Error('lost request reply');}return ownerDevicePayload(source,deviceId);}};
 const manager=createOwnerDeviceControl({api,projectId,deviceId,storage});
 return {source,values,calls,storage,manager,lose:()=>lose=true,snapshot:()=>ownerDevicePayload(source,deviceId)};
}
test('reject fences the shown microsecond request and coalesces duplicate clicks',async()=>{
 const f=fixture(),shown=f.snapshot(),a=f.manager.reject(shown),b=f.manager.reject(shown);assert.equal(a,b);assert.equal((await a).requested_device_id,'');assert.equal(f.calls.length,1);assert.equal(f.source.active_device_id,deviceId);
});
test('changed request or generation blocks rejection and approval before dispatch',async()=>{
 for(const method of ['approve','reject'])for(const field of ['requested_device_id','requested_at','generation']){
  const f=fixture(),shown=f.snapshot();f.source[field]=field==='generation'?4:field==='requested_at'?'2026-11-14T09:00:00.123457Z':'android-newer';
  await assert.rejects(f.manager[method](shown));assert.equal(f.calls.length,0);
 }
});
test('lost rejection and approval replies are confirmed by reads without a second decision RPC',async()=>{
 for(const method of ['approve','reject']){const f=fixture(),shown=f.snapshot();f.lose();await assert.rejects(f.manager[method](shown),/lost/);const result=await f.manager[method](shown);assert.equal(result.is_active,method==='reject');assert.equal(f.calls.length,1);}
});
test('financial journals and unreadable storage block approval but do not block rejecting a request',async()=>{
 for(const key of ['owner-path-v2:','opening-money-v2:','opening-stock-v2:','sharikx2-pending-transfer:']){const f=fixture();f.values.set(key+projectId,JSON.stringify({pending:{request_id:'pending'}}));assert.equal(pendingDeviceOperations(f.storage,projectId),1);await assert.rejects(f.manager.approve(f.snapshot()));assert.equal(f.calls.length,0);await f.manager.reject(f.snapshot());assert.equal(f.calls.length,1);}
 const f=fixture();f.values.set('owner-path-v2:'+projectId,'invalid');assert.throws(()=>f.manager.count());await assert.rejects(f.manager.approve(f.snapshot()));assert.equal(f.calls.length,0);
});
test('a lost transfer request is verified after retry without replacing or repeating it',async()=>{
 const f=fixture();f.source.active_device_id=other;f.source.requested_device_id=null;f.source.requested_device_name=null;f.source.requested_at=null;
 f.lose();await assert.rejects(f.manager.request(),/lost/);assert.equal(f.manager.pending(),true);const result=await f.manager.request();assert.equal(result.requested_device_id,deviceId);assert.equal(f.manager.pending(),false);assert.equal(f.calls.length,1);
});
test('stale page and changed browser identity cannot send decisions',async()=>{
 const f=fixture(),shown=f.snapshot();await assert.rejects(f.manager.reject(shown,()=>false));f.values.set(deviceIdentityKey(url),'web-v1-22222222-2222-4222-8222-222222222222');await assert.rejects(f.manager.approve(shown));assert.equal(f.calls.length,0);
});

test('empty, null and scalar journals are corrupt; unacknowledged stock saves also block handoff',async()=>{
 for(const raw of ['', 'null', '0', 'false', '[]']){const f=fixture();f.values.set('owner-path-v2:'+projectId,raw);assert.throws(()=>f.manager.count());await assert.rejects(f.manager.approve(f.snapshot()));assert.equal(f.calls.length,0);}
 const f=fixture();f.values.set('opening-stock-v2:'+projectId,JSON.stringify({saves:{a:{},b:{}}}));assert.equal(f.manager.count(),2);await assert.rejects(f.manager.approve(f.snapshot()));assert.equal(f.calls.length,0);
});
