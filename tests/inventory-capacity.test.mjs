import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryCreationCapacity as capacity,FREE_INVENTORY_LIMIT} from '../inventory-capacity.js';
const now=Date.parse('2026-10-13T12:00:00Z'),projectId='p';
test('native free inventory boundary permits twenty-four and rejects twenty-five',()=>{
 assert.equal(FREE_INVENTORY_LIMIT,25);for(const count of [0,24])assert.equal(capacity({count,projectId,now}).allowed,true);for(const count of [25,26,1000])assert.equal(capacity({count,projectId,now}).allowed,false);
});
test('free trial suspended and unknown status never grant unlimited inventory',()=>{
 for(const subscription_status of ['free','trial','suspended','unknown',undefined])assert.equal(capacity({count:25,projectId,now,project:{id:projectId,subscription_status}}).allowed,false);
});
test('native paid expiry is strict at exact boundary and one millisecond later remains eligible',()=>{
 for(const [expires,allowed] of [[now,false],[now-1,false],[now+1,true]])assert.equal(capacity({count:25,projectId,now,project:{id:projectId,subscription_status:'active',subscription_expires_at:expires}}).allowed,allowed);
});
test('native indefinite active subscription accepts absent zero and negative finite expiry',()=>{
 for(const expires of [undefined,null,'',0,-1])assert.equal(capacity({count:100,projectId,now,project:{id:projectId,subscription_status:'active',subscription_expires_at:expires}}).allowed,true);
});
test('API expiry strings retain instant semantics',()=>{
 assert.equal(capacity({count:25,projectId,now,project:{id:projectId,subscription_status:'active',subscription_expires_at:'2026-10-13T16:00:00+03:00'}}).allowed,true);
});
test('malformed explicit active expiry cannot silently become an indefinite plan',()=>{
 for(const expires of ['bad',NaN,Infinity,true,{}])assert.throws(()=>capacity({count:25,projectId,now,project:{id:projectId,subscription_status:'active',subscription_expires_at:expires}}),/تاريخ/);
});
test('foreign project invalid counts and invalid clocks are rejected',()=>{
 assert.throws(()=>capacity({count:25,projectId,now,project:{id:'q',subscription_status:'active'}}));for(const count of [-1,1.5,'24',NaN,Infinity])assert.throws(()=>capacity({count,projectId,now}));assert.throws(()=>capacity({count:24,projectId,now:NaN}));
});
test('capacity schema is frozen serializable source-isolated and contains no project metadata',()=>{
 const project={id:projectId,subscription_status:'free'},before=JSON.stringify(project),model=capacity({count:25,projectId,project,now});assert.ok(Object.isFrozen(model));assert.deepEqual(JSON.parse(JSON.stringify(model)),model);assert.equal(JSON.stringify(project),before);assert.equal('project' in model,false);assert.equal('projectId' in model,false);
});
